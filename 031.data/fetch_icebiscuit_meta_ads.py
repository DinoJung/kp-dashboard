from __future__ import annotations

import argparse
import json
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Literal

import psycopg
from dotenv import dotenv_values

ROOT = Path('/home/j1nu/workspace/10.work/03.KPdash')
ENV_PATH = ROOT / '.env'
SCHEMA = 'icebiscuit_meta'
DEFAULT_META_API_VERSION = 'v23.0'
PURCHASE_ACTION_TYPES = {
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
    'onsite_web_purchase',
    'omni_complete_payment',
}
PURCHASE_ACTION_PRIORITY = (
    'purchase',
    'onsite_web_purchase',
    'offsite_conversion.fb_pixel_purchase',
    'omni_purchase',
    'omni_complete_payment',
)
CONVERSION_ACTION_TYPES = {
    'complete_registration',
    'lead',
    'omni_activate_app',
    'link_click',
}
LANDING_PAGE_VIEW_TYPES = {
    'landing_page_view',
    'omni_landing_page_view',
}
LINK_CLICK_TYPES = {
    'link_click',
    'inline_link_click',
}
InsightLevel = Literal['campaign', 'ad']


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Fetch Icebiscuit META insights and upsert into Supabase/Postgres.')
    parser.add_argument('--since', help='Inclusive start date YYYY-MM-DD. Default: first day of current month.')
    parser.add_argument('--until', help='Inclusive end date YYYY-MM-DD. Default: yesterday.')
    parser.add_argument('--account-id', help='Override META_ICEBISCUIT_AD_ACCOUNT_ID from .env')
    parser.add_argument('--dry-run', action='store_true', help='Fetch and summarize only, without writing to DB.')
    parser.add_argument('--level', choices=['campaign', 'ad'], default='campaign', help='Meta insights level to fetch. Default: campaign')
    return parser.parse_args()


def parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    return datetime.strptime(value, '%Y-%m-%d').date()


def default_since(today: date) -> date:
    return today.replace(day=1)


def default_until(today: date) -> date:
    return today - timedelta(days=1)


def load_config() -> dict[str, str]:
    if not ENV_PATH.exists():
        raise FileNotFoundError(f'.env not found: {ENV_PATH}')
    return {key: value for key, value in dotenv_values(ENV_PATH).items() if value is not None}


def meta_account_id(raw_value: str) -> str:
    account = raw_value.strip()
    if account.startswith('act_'):
        return account
    return f'act_{account}'


def build_insights_url(account_id: str, access_token: str, api_version: str, since: date, until: date, level: InsightLevel, after: str | None = None) -> str:
    fields = [
        'date_start',
        'date_stop',
        'account_id',
        'account_name',
        'campaign_id',
        'campaign_name',
        'objective',
        'buying_type',
        'impressions',
        'reach',
        'clicks',
        'spend',
        'cpc',
        'ctr',
        'actions',
        'action_values',
        'conversions',
    ]
    if level == 'ad':
        fields.extend(['adset_id', 'adset_name', 'ad_id', 'ad_name'])

    params = {
        'access_token': access_token,
        'level': level,
        'time_increment': '1',
        'time_range': json.dumps({'since': since.isoformat(), 'until': until.isoformat()}),
        'limit': '100',
        'fields': ','.join(fields),
    }
    if after:
        params['after'] = after
    query = urllib.parse.urlencode(params)
    return f'https://graph.facebook.com/{api_version}/{account_id}/insights?{query}'


def fetch_json(url: str) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={'Accept': 'application/json'})
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = response.read().decode('utf-8')
    return json.loads(payload)


def sum_action_values(items: list[dict[str, Any]] | None, action_types: set[str]) -> float:
    total = 0.0
    for item in items or []:
        if str(item.get('action_type', '')).strip() in action_types:
            try:
                total += float(item.get('value', 0) or 0)
            except (TypeError, ValueError):
                continue
    return total


def select_primary_action_value(
    items: list[dict[str, Any]] | None,
    action_types: set[str],
    priority: tuple[str, ...],
) -> float:
    candidates: dict[str, float] = {}
    for item in items or []:
        action_type = str(item.get('action_type', '')).strip()
        if action_type not in action_types:
            continue
        try:
            value = float(item.get('value', 0) or 0)
        except (TypeError, ValueError):
            continue
        candidates[action_type] = value

    for action_type in priority:
        if action_type in candidates:
            return candidates[action_type]

    if candidates:
        return max(candidates.values())
    return 0.0


def rows_account_ids(rows: list[dict[str, Any]], fallback_account_id: str) -> list[str]:
    account_ids = sorted({str(row.get('account_id')).strip() for row in rows if row.get('account_id')})
    if account_ids:
        return account_ids
    return [fallback_account_id.removeprefix('act_')]


def normalize_int(value: Any) -> int | None:
    if value in {None, ''}:
        return None
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return None


def normalize_float(value: Any) -> float | None:
    if value in {None, ''}:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def build_rows(
    payload: dict[str, Any],
    level: InsightLevel,
    account_id: str,
    access_token: str,
    api_version: str,
    since: date,
    until: date,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    after: str | None = None
    while True:
        page = payload if after is None else fetch_json(build_insights_url(account_id, access_token, api_version, since, until, level, after))
        for item in page.get('data', []):
            actions = item.get('actions') or []
            action_values = item.get('action_values') or []
            purchase_count = normalize_int(select_primary_action_value(actions, PURCHASE_ACTION_TYPES, PURCHASE_ACTION_PRIORITY))
            purchase_value = normalize_float(select_primary_action_value(action_values, PURCHASE_ACTION_TYPES, PURCHASE_ACTION_PRIORITY))
            report_date = parse_iso_date(item.get('date_start'))
            if not report_date:
                continue
            row = {
                'report_date': report_date,
                'account_id': item.get('account_id'),
                'account_name': item.get('account_name'),
                'campaign_id': item.get('campaign_id'),
                'campaign_name': item.get('campaign_name'),
                'campaign_status': item.get('campaign_status'),
                'objective': item.get('objective'),
                'buying_type': item.get('buying_type'),
                'impressions': normalize_int(item.get('impressions')),
                'reach': normalize_int(item.get('reach')),
                'clicks': normalize_int(item.get('clicks')),
                'inline_link_clicks': normalize_int(sum_action_values(actions, LINK_CLICK_TYPES)),
                'landing_page_views': normalize_int(sum_action_values(actions, LANDING_PAGE_VIEW_TYPES)),
                'spend': normalize_float(item.get('spend')),
                'cpc': normalize_float(item.get('cpc')),
                'ctr': (normalize_float(item.get('ctr')) or 0.0) / 100 if item.get('ctr') not in {None, ''} else None,
                'purchase_count': purchase_count,
                'purchase_value': purchase_value,
                'conversions': normalize_int(sum_action_values(actions, CONVERSION_ACTION_TYPES) + (purchase_count or 0)),
                'conversion_value': normalize_float(sum_action_values(action_values, CONVERSION_ACTION_TYPES) + (purchase_value or 0.0)),
                'raw_actions': json.dumps(actions, ensure_ascii=False),
                'raw_action_values': json.dumps(action_values, ensure_ascii=False),
                'raw_payload': json.dumps(item, ensure_ascii=False),
                'adset_id': item.get('adset_id') if level == 'ad' else None,
                'adset_name': item.get('adset_name') if level == 'ad' else None,
                'ad_id': item.get('ad_id') if level == 'ad' else None,
                'ad_name': item.get('ad_name') if level == 'ad' else None,
            }
            rows.append(row)
        paging = page.get('paging') or {}
        cursors = paging.get('cursors') or {}
        after = cursors.get('after')
        next_url = paging.get('next')
        if not after or not next_url:
            break
    return rows


def print_summary(rows: list[dict[str, Any]], account_id: str, since: date, until: date, level: InsightLevel) -> None:
    monthly = defaultdict(lambda: {'spend': 0.0, 'impressions': 0, 'clicks': 0, 'purchase_value': 0.0})
    for row in rows:
        month_key = row['report_date'].replace(day=1).isoformat()
        monthly[month_key]['spend'] += row.get('spend') or 0.0
        monthly[month_key]['impressions'] += row.get('impressions') or 0
        monthly[month_key]['clicks'] += row.get('clicks') or 0
        monthly[month_key]['purchase_value'] += row.get('purchase_value') or 0.0

    print('LEVEL', level)
    print('ACCOUNT_ID', account_id)
    print('SINCE', since.isoformat())
    print('UNTIL', until.isoformat())
    print('RAW_ROWS', len(rows))
    for month_key in sorted(monthly):
        month = monthly[month_key]
        roas = month['purchase_value'] / month['spend'] if month['spend'] else 0.0
        print('MONTH', month_key, 'SPEND', round(month['spend'], 2), 'IMPRESSIONS', month['impressions'], 'CLICKS', month['clicks'], 'PURCHASE_VALUE', round(month['purchase_value'], 2), 'ROAS', round(roas, 4))


def persist_campaign_rows(rows: list[dict[str, Any]], cur: psycopg.Cursor[Any], import_batch_id: int, delete_account_ids: list[str], report_dates: list[date]) -> None:
    if report_dates:
        cur.execute(
            f'delete from {SCHEMA}.raw_campaign_insights_daily where account_id = any(%s) and report_date = any(%s)',
            (delete_account_ids, report_dates),
        )

    if rows:
        cur.executemany(
            f'''
            insert into {SCHEMA}.raw_campaign_insights_daily (
                import_batch_id, report_date, account_id, account_name, campaign_id, campaign_name,
                campaign_status, objective, buying_type, impressions, reach, clicks,
                inline_link_clicks, landing_page_views, spend, cpc, ctr, purchase_count,
                purchase_value, conversions, conversion_value, raw_actions, raw_action_values,
                raw_payload
            ) values (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s
            )
            ''',
            [
                (
                    import_batch_id,
                    row['report_date'],
                    row['account_id'],
                    row['account_name'],
                    row['campaign_id'],
                    row['campaign_name'],
                    row['campaign_status'],
                    row['objective'],
                    row['buying_type'],
                    row['impressions'],
                    row['reach'],
                    row['clicks'],
                    row['inline_link_clicks'],
                    row['landing_page_views'],
                    row['spend'],
                    row['cpc'],
                    row['ctr'],
                    row['purchase_count'],
                    row['purchase_value'],
                    row['conversions'],
                    row['conversion_value'],
                    row['raw_actions'],
                    row['raw_action_values'],
                    row['raw_payload'],
                )
                for row in rows
            ],
        )


def persist_ad_rows(rows: list[dict[str, Any]], cur: psycopg.Cursor[Any], import_batch_id: int, delete_account_ids: list[str], report_dates: list[date]) -> None:
    if report_dates:
        cur.execute(
            f'delete from {SCHEMA}.raw_ad_insights_daily where account_id = any(%s) and report_date = any(%s)',
            (delete_account_ids, report_dates),
        )

    if rows:
        cur.executemany(
            f'''
            insert into {SCHEMA}.raw_ad_insights_daily (
                import_batch_id, report_date, account_id, account_name, campaign_id, campaign_name,
                adset_id, adset_name, ad_id, ad_name, objective, buying_type, impressions, reach,
                clicks, inline_link_clicks, landing_page_views, spend, cpc, ctr, purchase_count,
                purchase_value, conversions, conversion_value, raw_actions, raw_action_values, raw_payload
            ) values (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s
            )
            ''',
            [
                (
                    import_batch_id,
                    row['report_date'],
                    row['account_id'],
                    row['account_name'],
                    row['campaign_id'],
                    row['campaign_name'],
                    row['adset_id'],
                    row['adset_name'],
                    row['ad_id'],
                    row['ad_name'],
                    row['objective'],
                    row['buying_type'],
                    row['impressions'],
                    row['reach'],
                    row['clicks'],
                    row['inline_link_clicks'],
                    row['landing_page_views'],
                    row['spend'],
                    row['cpc'],
                    row['ctr'],
                    row['purchase_count'],
                    row['purchase_value'],
                    row['conversions'],
                    row['conversion_value'],
                    row['raw_actions'],
                    row['raw_action_values'],
                    row['raw_payload'],
                )
                for row in rows
            ],
        )


def persist_rows(rows: list[dict[str, Any]], cfg: dict[str, str], account_id: str, since: date, until: date, level: InsightLevel) -> None:
    db_url = cfg.get('DATABASE_URL')
    if not db_url:
        raise RuntimeError('DATABASE_URL is missing in /10.work/03.KPdash/.env')

    report_dates = sorted({row['report_date'] for row in rows})
    delete_account_ids = rows_account_ids(rows, account_id)
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f'''
                insert into {SCHEMA}.import_batches
                    (source_account_id, source_note, requested_since, requested_until, imported_by, status)
                values (%s, %s, %s, %s, %s, %s)
                returning id
                ''',
                (
                    account_id,
                    f'META {level} insights sync {since.isoformat()}~{until.isoformat()}',
                    since,
                    until,
                    'hermes',
                    'completed',
                ),
            )
            import_batch_id = cur.fetchone()[0]

            if level == 'campaign':
                persist_campaign_rows(rows, cur, import_batch_id, delete_account_ids, report_dates)
            else:
                persist_ad_rows(rows, cur, import_batch_id, delete_account_ids, report_dates)
        conn.commit()


def main() -> None:
    args = parse_args()
    cfg = load_config()
    today = date.today()
    since = parse_iso_date(args.since) or default_since(today)
    until = parse_iso_date(args.until) or default_until(today)
    if since > until:
        raise ValueError('--since must be earlier than or equal to --until')

    raw_account_id = args.account_id or cfg.get('META_ICEBISCUIT_AD_ACCOUNT_ID')
    access_token = cfg.get('META_ACCESS_TOKEN')
    api_version = cfg.get('META_API_VERSION', DEFAULT_META_API_VERSION)
    if not raw_account_id:
        raise RuntimeError('META_ICEBISCUIT_AD_ACCOUNT_ID is missing in /10.work/03.KPdash/.env')
    if not access_token:
        raise RuntimeError('META_ACCESS_TOKEN is missing in /10.work/03.KPdash/.env')

    account_id = meta_account_id(raw_account_id)
    first_url = build_insights_url(account_id, access_token, api_version, since, until, args.level)
    first_payload = fetch_json(first_url)
    rows = build_rows(first_payload, args.level, account_id, access_token, api_version, since, until)
    print_summary(rows, account_id, since, until, args.level)
    if args.dry_run:
        return
    persist_rows(rows, cfg, account_id, since, until, args.level)


if __name__ == '__main__':
    main()
