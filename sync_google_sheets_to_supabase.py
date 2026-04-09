from __future__ import annotations

import argparse
import json
import subprocess
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any

import psycopg
from dotenv import dotenv_values

ROOT = Path('/home/j1nu/workspace/hermes/KP_monthly-report')
ENV_PATH = ROOT / '.env'
SCHEMA = 'thekary_point'
SPREADSHEET_ID = '1bALRM_uxx4UbVdjIDuk8JE5-hGp1rjyy0Xuf3gHS8gQ'
SPREADSHEET_URL = f'https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit'

SHEET_RANGES = {
    'guide': 'guide!A:D',
    'raw_member': 'raw_member!A:J',
    'raw_event': 'raw_event!A:J',
    'raw_ad': 'raw_ad!A:T',
    'raw_optin': 'raw_optin!A:D',
    'daily_activity': 'daily_activity!A:C',
    'monthly_activity': 'monthly_activity!A:C',
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Sync Dashboard-main Google Sheets data into Supabase.')
    parser.add_argument('--dry-run', action='store_true', help='Parse the sheet and print counts without writing to Supabase.')
    parser.add_argument('--spreadsheet-id', default=SPREADSHEET_ID)
    return parser.parse_args()


def gws_read(spreadsheet_id: str, a1_range: str) -> list[list[str]]:
    cmd = [
        'gws', 'sheets', '+read',
        '--spreadsheet', spreadsheet_id,
        '--range', a1_range,
        '--format', 'json',
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    payload = json.loads(result.stdout)
    return payload.get('values', [])


def rows_from_sheet(spreadsheet_id: str, a1_range: str) -> list[dict[str, str]]:
    values = gws_read(spreadsheet_id, a1_range)
    if not values:
        return []
    headers = [str(cell).strip() for cell in values[0]]
    rows: list[dict[str, str]] = []
    for raw_row in values[1:]:
        row = {
            headers[index]: str(raw_row[index]).strip() if index < len(raw_row) else ''
            for index in range(len(headers))
            if headers[index]
        }
        if any(value != '' for value in row.values()):
            rows.append(row)
    return rows


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    value = value.strip()
    for fmt in ('%Y-%m-%d', '%Y.%m.%d', '%Y/%m/%d', '%Y-%m', '%Y.%m', '%Y/%m'):
        try:
            parsed = datetime.strptime(value, fmt).date()
            return parsed.replace(day=1) if fmt in {'%Y-%m', '%Y.%m', '%Y/%m'} else parsed
        except ValueError:
            continue
    return None


def to_int(value: str | None) -> int | None:
    if value is None:
        return None
    cleaned = str(value).strip().replace(',', '')
    if cleaned == '':
        return None
    try:
        return int(round(float(cleaned)))
    except ValueError:
        return None


def to_float(value: str | None) -> float | None:
    if value is None:
        return None
    cleaned = str(value).strip().replace(',', '')
    if cleaned == '':
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def to_bool(value: str | None) -> bool:
    if value is None:
        return False
    cleaned = str(value).strip().lower()
    return cleaned in {'true', 't', '1', 'y', 'yes'}


def month_start(value: date) -> date:
    return value.replace(day=1)


def is_demo_row(row: dict[str, str]) -> bool:
    text = ' '.join(v.lower() for v in row.values() if isinstance(v, str))
    return 'example' in text or 'fill when available' in text


def build_payloads(spreadsheet_id: str) -> dict[str, Any]:
    raw_member_rows = [row for row in rows_from_sheet(spreadsheet_id, SHEET_RANGES['raw_member']) if not is_demo_row(row)]
    raw_event_rows = [row for row in rows_from_sheet(spreadsheet_id, SHEET_RANGES['raw_event']) if not is_demo_row(row)]
    raw_ad_rows = [row for row in rows_from_sheet(spreadsheet_id, SHEET_RANGES['raw_ad']) if not is_demo_row(row)]
    raw_optin_rows = [row for row in rows_from_sheet(spreadsheet_id, SHEET_RANGES['raw_optin']) if not is_demo_row(row)]
    daily_activity_rows = [row for row in rows_from_sheet(spreadsheet_id, SHEET_RANGES['daily_activity']) if not is_demo_row(row)]
    monthly_activity_rows = [row for row in rows_from_sheet(spreadsheet_id, SHEET_RANGES['monthly_activity']) if not is_demo_row(row)]

    member_raw: list[dict[str, Any]] = []
    by_month_member: dict[date, list[dict[str, Any]]] = defaultdict(list)

    for row in raw_member_rows:
        report_date = parse_date(row.get('report_date'))
        if not report_date:
            continue
        item = {
            'report_date': report_date,
            'weekday_text': row.get('weekday_text') or None,
            'member_count': to_int(row.get('member_count')),
            'app_downloads': to_int(row.get('app_downloads')),
            'withdrawals': to_int(row.get('withdrawals')),
            'net_growth': to_int(row.get('net_growth')),
            'cumulative_conversion': to_int(row.get('cumulative_conversion')),
            'active_members': to_int(row.get('active_members')),
            'is_month_end': to_bool(row.get('is_month_end')),
            'issue_note': row.get('issue_note') or None,
        }
        member_raw.append(item)
        by_month_member[month_start(report_date)].append(item)

    optin_by_month: dict[date, dict[str, int | None]] = {}
    for row in raw_optin_rows:
        report_month = parse_date(row.get('report_month'))
        if not report_month:
            continue
        optin_by_month[month_start(report_month)] = {
            'report_month': month_start(report_month),
            'sms_opt_in_members': to_int(row.get('sms_opt_in_members')),
            'push_opt_in_members': to_int(row.get('push_opt_in_members')),
        }

    monthly_member: dict[date, dict[str, Any]] = {}
    for report_month, items in sorted(by_month_member.items()):
        ordered = sorted(items, key=lambda x: x['report_date'])
        eom_row = next((row for row in reversed(ordered) if row['is_month_end']), ordered[-1])
        optin_row = optin_by_month.get(report_month, {})
        monthly_member[report_month] = {
            'report_month': report_month,
            'new_members': sum(row['member_count'] or 0 for row in ordered),
            'app_downloads': sum(row['app_downloads'] or 0 for row in ordered),
            'withdrawals': sum(row['withdrawals'] or 0 for row in ordered),
            'net_growth': sum(row['net_growth'] or 0 for row in ordered),
            'cumulative_conversion_eom': eom_row['cumulative_conversion'],
            'active_members_eom': eom_row['active_members'],
            'sms_opt_in_members': optin_row.get('sms_opt_in_members'),
            'push_opt_in_members': optin_row.get('push_opt_in_members'),
        }

    event_raw: list[dict[str, Any]] = []
    monthly_event_current: dict[date, dict[str, Any]] = {}
    for row in raw_event_rows:
        report_month = parse_date(row.get('report_month'))
        if not report_month:
            continue
        report_month = month_start(report_month)
        item = {
            'report_month': report_month,
            'promotion_type': row.get('promotion_type') or '',
            'point_amount': to_int(row.get('point_amount')),
            'participant_count': to_int(row.get('participant_count')),
            'probability': to_float(row.get('probability')),
            'total_points_issued': to_int(row.get('total_points_issued')),
            'points_used': to_int(row.get('points_used')),
            'point_usage_rate': to_float(row.get('point_usage_rate')),
            'linked_sales_amount': to_int(row.get('linked_sales_amount')),
        }
        event_raw.append(item)
        if item['promotion_type'] == 'TTL':
            monthly_event_current[report_month] = {
                'report_month': report_month,
                'participant_count': item['participant_count'],
                'total_points_issued': item['total_points_issued'],
                'points_used': item['points_used'],
                'point_usage_rate': item['point_usage_rate'],
                'linked_sales_amount': item['linked_sales_amount'],
            }

    ad_raw: list[dict[str, Any]] = []
    monthly_ad: dict[date, dict[str, Any]] = {}
    for row in raw_ad_rows:
        report_month = parse_date(row.get('report_month'))
        if not report_month:
            continue
        report_month = month_start(report_month)
        item = {
            'report_month': report_month,
            'media': row.get('media') or None,
            'placement_name': row.get('placement_name') or None,
            'period_text': row.get('period_text') or None,
            'campaign_goal': row.get('campaign_goal') or None,
            'impressions': to_int(row.get('impressions')),
            'clicks': to_int(row.get('clicks')),
            'cpc': to_float(row.get('cpc')),
            'ctr': to_float(row.get('ctr')),
            'conversions': to_int(row.get('conversions')),
            'conversion_rate': to_float(row.get('conversion_rate')),
            'revenue': to_int(row.get('revenue')),
            'average_order_value': to_float(row.get('average_order_value')),
            'ad_spend_vat_inclusive': to_float(row.get('ad_spend_vat_inclusive')),
            'ad_spend_vat_exclusive': to_float(row.get('ad_spend_vat_exclusive')),
            'ad_spend_markup_vat_exclusive': to_float(row.get('ad_spend_markup_vat_exclusive')),
            'roas_vat_exclusive': to_float(row.get('roas_vat_exclusive')),
            'roas_markup_vat_exclusive': to_float(row.get('roas_markup_vat_exclusive')),
            'creative_text': row.get('creative_text') or None,
            'note': row.get('note') or None,
        }
        ad_raw.append(item)
        if item['placement_name'] == 'TTL':
            monthly_ad[report_month] = {
                'report_month': report_month,
                'media': item['media'],
                'impressions': item['impressions'],
                'clicks': item['clicks'],
                'cpc': item['cpc'],
                'ctr': item['ctr'],
                'conversions': item['conversions'],
                'conversion_rate': item['conversion_rate'],
                'revenue': item['revenue'],
                'average_order_value': item['average_order_value'],
                'ad_spend_vat_exclusive': item['ad_spend_vat_exclusive'],
                'ad_spend_markup_vat_exclusive': item['ad_spend_markup_vat_exclusive'],
                'roas_vat_exclusive': item['roas_vat_exclusive'],
                'roas_markup_vat_exclusive': item['roas_markup_vat_exclusive'],
            }

    daily_activity = []
    for row in daily_activity_rows:
        report_date = parse_date(row.get('report_date'))
        if not report_date:
            continue
        daily_activity.append({
            'report_date': report_date,
            'dau': to_int(row.get('dau')),
            'source_note': row.get('source_note') or 'google_sheets_sync',
        })

    monthly_activity = []
    for row in monthly_activity_rows:
        report_month = parse_date(row.get('report_month'))
        if not report_month:
            continue
        monthly_activity.append({
            'report_month': month_start(report_month),
            'mau': to_int(row.get('mau')),
            'source_note': row.get('source_note') or 'google_sheets_sync',
        })

    return {
        'member_raw': member_raw,
        'monthly_member': [monthly_member[key] for key in sorted(monthly_member)],
        'monthly_optin': [optin_by_month[key] for key in sorted(optin_by_month)],
        'event_raw': event_raw,
        'monthly_event_current': [monthly_event_current[key] for key in sorted(monthly_event_current)],
        'ad_raw': ad_raw,
        'monthly_ad': [monthly_ad[key] for key in sorted(monthly_ad)],
        'daily_activity': sorted(daily_activity, key=lambda x: x['report_date']),
        'monthly_activity': sorted(monthly_activity, key=lambda x: x['report_month']),
    }


def print_summary(payloads: dict[str, Any], spreadsheet_id: str) -> None:
    print('SPREADSHEET_ID', spreadsheet_id)
    print('SPREADSHEET_URL', f'https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit')
    print('RAW_MEMBER_ROWS', len(payloads['member_raw']))
    print('MONTHLY_MEMBER_ROWS', len(payloads['monthly_member']))
    print('RAW_EVENT_ROWS', len(payloads['event_raw']))
    print('MONTHLY_OPTIN_ROWS', len(payloads['monthly_optin']))
    print('MONTHLY_EVENT_CURRENT_ROWS', len(payloads['monthly_event_current']))
    print('RAW_AD_ROWS', len(payloads['ad_raw']))
    print('MONTHLY_AD_ROWS', len(payloads['monthly_ad']))
    print('DAILY_ACTIVITY_ROWS', len(payloads['daily_activity']))
    print('MONTHLY_ACTIVITY_ROWS', len(payloads['monthly_activity']))


def run_sync(spreadsheet_id: str, dry_run: bool) -> None:
    cfg = dotenv_values(ENV_PATH)
    db_url = cfg.get('DATABASE_URL')
    payloads = build_payloads(spreadsheet_id)
    print_summary(payloads, spreadsheet_id)
    if dry_run:
        return
    if not db_url:
        raise RuntimeError('DATABASE_URL is missing in /hermes/KP_monthly-report/.env')

    member_dates = sorted({row['report_date'] for row in payloads['member_raw']})
    event_months = sorted({row['report_month'] for row in payloads['event_raw']})
    ad_months = sorted({row['report_month'] for row in payloads['ad_raw']})
    member_months = sorted({row['report_month'] for row in payloads['monthly_member']})
    activity_dates = sorted({row['report_date'] for row in payloads['daily_activity']})
    activity_months = sorted({row['report_month'] for row in payloads['monthly_activity']})

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f'''
                insert into {SCHEMA}.import_batches
                    (source_file_name, source_file_path, source_type, source_note, imported_by, status)
                values (%s, %s, %s, %s, %s, %s)
                returning id
                ''',
                (
                    'Dashboard-main',
                    SPREADSHEET_URL,
                    'google_sheets',
                    f'gws sync from {spreadsheet_id}',
                    'hermes',
                    'completed',
                ),
            )
            import_batch_id = cur.fetchone()[0]

            if member_dates:
                cur.execute(f'delete from {SCHEMA}.raw_member_daily where report_date = any(%s)', (member_dates,))
            if event_months:
                cur.execute(f'delete from {SCHEMA}.raw_event_monthly_detail where report_month = any(%s)', (event_months,))
            if ad_months:
                cur.execute(f'delete from {SCHEMA}.raw_ad_monthly_detail where report_month = any(%s)', (ad_months,))
            if activity_dates:
                cur.execute(f'delete from {SCHEMA}.daily_activity_metrics where report_date = any(%s)', (activity_dates,))
            if activity_months:
                cur.execute(f'delete from {SCHEMA}.monthly_activity_metrics where report_month = any(%s)', (activity_months,))

            if payloads['member_raw']:
                cur.executemany(
                    f'''
                    insert into {SCHEMA}.raw_member_daily
                    (import_batch_id, report_date, weekday_text, member_count, app_downloads, withdrawals, net_growth,
                     cumulative_conversion, active_members, is_month_end, issue_note)
                    values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ''',
                    [
                        (
                            import_batch_id,
                            row['report_date'],
                            row['weekday_text'],
                            row['member_count'],
                            row['app_downloads'],
                            row['withdrawals'],
                            row['net_growth'],
                            row['cumulative_conversion'],
                            row['active_members'],
                            row['is_month_end'],
                            row['issue_note'],
                        )
                        for row in payloads['member_raw']
                    ],
                )

            if payloads['event_raw']:
                cur.executemany(
                    f'''
                    insert into {SCHEMA}.raw_event_monthly_detail
                    (import_batch_id, report_month, promotion_type, point_amount, participant_count, probability,
                     total_points_issued, points_used, point_usage_rate, linked_sales_amount)
                    values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ''',
                    [
                        (
                            import_batch_id,
                            row['report_month'],
                            row['promotion_type'],
                            row['point_amount'],
                            row['participant_count'],
                            row['probability'],
                            row['total_points_issued'],
                            row['points_used'],
                            row['point_usage_rate'],
                            row['linked_sales_amount'],
                        )
                        for row in payloads['event_raw']
                    ],
                )

            if payloads['ad_raw']:
                cur.executemany(
                    f'''
                    insert into {SCHEMA}.raw_ad_monthly_detail
                    (import_batch_id, report_month, media, placement_name, period_text, campaign_goal,
                     impressions, clicks, cpc, ctr, conversions, conversion_rate, revenue, average_order_value,
                     ad_spend_vat_inclusive, ad_spend_vat_exclusive, ad_spend_markup_vat_exclusive,
                     roas_vat_exclusive, roas_markup_vat_exclusive, creative_text, note)
                    values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ''',
                    [
                        (
                            import_batch_id,
                            row['report_month'],
                            row['media'],
                            row['placement_name'],
                            row['period_text'],
                            row['campaign_goal'],
                            row['impressions'],
                            row['clicks'],
                            row['cpc'],
                            row['ctr'],
                            row['conversions'],
                            row['conversion_rate'],
                            row['revenue'],
                            row['average_order_value'],
                            row['ad_spend_vat_inclusive'],
                            row['ad_spend_vat_exclusive'],
                            row['ad_spend_markup_vat_exclusive'],
                            row['roas_vat_exclusive'],
                            row['roas_markup_vat_exclusive'],
                            row['creative_text'],
                            row['note'],
                        )
                        for row in payloads['ad_raw']
                    ],
                )

            if payloads['monthly_member']:
                cur.executemany(
                    f'''
                    insert into {SCHEMA}.monthly_member_summary
                    (report_month, new_members, app_downloads, withdrawals, net_growth,
                     cumulative_conversion_eom, active_members_eom, sms_opt_in_members, push_opt_in_members, source_import_batch_id)
                    values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    on conflict (report_month) do update set
                      new_members = excluded.new_members,
                      app_downloads = excluded.app_downloads,
                      withdrawals = excluded.withdrawals,
                      net_growth = excluded.net_growth,
                      cumulative_conversion_eom = excluded.cumulative_conversion_eom,
                      active_members_eom = excluded.active_members_eom,
                      sms_opt_in_members = excluded.sms_opt_in_members,
                      push_opt_in_members = excluded.push_opt_in_members,
                      source_import_batch_id = excluded.source_import_batch_id,
                      updated_at = now()
                    ''',
                    [
                        (
                            row['report_month'],
                            row['new_members'],
                            row['app_downloads'],
                            row['withdrawals'],
                            row['net_growth'],
                            row['cumulative_conversion_eom'],
                            row['active_members_eom'],
                            row['sms_opt_in_members'],
                            row['push_opt_in_members'],
                            import_batch_id,
                        )
                        for row in payloads['monthly_member']
                    ],
                )

            if payloads['monthly_optin']:
                cur.executemany(
                    f'''
                    insert into {SCHEMA}.monthly_member_summary
                    (report_month, new_members, app_downloads, withdrawals, net_growth,
                     cumulative_conversion_eom, active_members_eom, sms_opt_in_members, push_opt_in_members, source_import_batch_id)
                    values (%s,0,0,0,0,null,null,%s,%s,%s)
                    on conflict (report_month) do update set
                      sms_opt_in_members = excluded.sms_opt_in_members,
                      push_opt_in_members = excluded.push_opt_in_members,
                      source_import_batch_id = excluded.source_import_batch_id,
                      updated_at = now()
                    ''',
                    [
                        (
                            row['report_month'],
                            row['sms_opt_in_members'],
                            row['push_opt_in_members'],
                            import_batch_id,
                        )
                        for row in payloads['monthly_optin']
                    ],
                )

            if payloads['monthly_event_current']:
                cur.executemany(
                    f'''
                    insert into {SCHEMA}.monthly_event_current
                    (report_month, participant_count, total_points_issued, points_used, point_usage_rate,
                     linked_sales_amount, as_of_date, source_import_batch_id)
                    values (%s,%s,%s,%s,%s,%s,%s,%s)
                    on conflict (report_month) do update set
                      participant_count = excluded.participant_count,
                      total_points_issued = excluded.total_points_issued,
                      points_used = excluded.points_used,
                      point_usage_rate = excluded.point_usage_rate,
                      linked_sales_amount = excluded.linked_sales_amount,
                      as_of_date = excluded.as_of_date,
                      source_import_batch_id = excluded.source_import_batch_id,
                      updated_at = now()
                    ''',
                    [
                        (
                            row['report_month'],
                            row['participant_count'],
                            row['total_points_issued'],
                            row['points_used'],
                            row['point_usage_rate'],
                            row['linked_sales_amount'],
                            date.today(),
                            import_batch_id,
                        )
                        for row in payloads['monthly_event_current']
                    ],
                )

                cur.executemany(
                    f'''
                    insert into {SCHEMA}.monthly_event_snapshot
                    (report_month, snapshot_date, participant_count, total_points_issued, points_used,
                     point_usage_rate, linked_sales_amount, is_final, snapshot_reason, source_import_batch_id)
                    values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    on conflict (report_month, snapshot_date) do update set
                      participant_count = excluded.participant_count,
                      total_points_issued = excluded.total_points_issued,
                      points_used = excluded.points_used,
                      point_usage_rate = excluded.point_usage_rate,
                      linked_sales_amount = excluded.linked_sales_amount,
                      is_final = excluded.is_final,
                      snapshot_reason = excluded.snapshot_reason,
                      source_import_batch_id = excluded.source_import_batch_id
                    ''',
                    [
                        (
                            row['report_month'],
                            date.today(),
                            row['participant_count'],
                            row['total_points_issued'],
                            row['points_used'],
                            row['point_usage_rate'],
                            row['linked_sales_amount'],
                            False,
                            'google_sheets_sync',
                            import_batch_id,
                        )
                        for row in payloads['monthly_event_current']
                    ],
                )

            if payloads['monthly_ad']:
                cur.executemany(
                    f'''
                    insert into {SCHEMA}.monthly_ad_summary
                    (report_month, media, impressions, clicks, cpc, ctr, conversions, conversion_rate,
                     revenue, average_order_value, ad_spend_vat_exclusive, ad_spend_markup_vat_exclusive,
                     roas_vat_exclusive, roas_markup_vat_exclusive, source_import_batch_id)
                    values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    on conflict (report_month) do update set
                      media = excluded.media,
                      impressions = excluded.impressions,
                      clicks = excluded.clicks,
                      cpc = excluded.cpc,
                      ctr = excluded.ctr,
                      conversions = excluded.conversions,
                      conversion_rate = excluded.conversion_rate,
                      revenue = excluded.revenue,
                      average_order_value = excluded.average_order_value,
                      ad_spend_vat_exclusive = excluded.ad_spend_vat_exclusive,
                      ad_spend_markup_vat_exclusive = excluded.ad_spend_markup_vat_exclusive,
                      roas_vat_exclusive = excluded.roas_vat_exclusive,
                      roas_markup_vat_exclusive = excluded.roas_markup_vat_exclusive,
                      source_import_batch_id = excluded.source_import_batch_id,
                      updated_at = now()
                    ''',
                    [
                        (
                            row['report_month'],
                            row['media'],
                            row['impressions'],
                            row['clicks'],
                            row['cpc'],
                            row['ctr'],
                            row['conversions'],
                            row['conversion_rate'],
                            row['revenue'],
                            row['average_order_value'],
                            row['ad_spend_vat_exclusive'],
                            row['ad_spend_markup_vat_exclusive'],
                            row['roas_vat_exclusive'],
                            row['roas_markup_vat_exclusive'],
                            import_batch_id,
                        )
                        for row in payloads['monthly_ad']
                    ],
                )

            if payloads['daily_activity']:
                cur.executemany(
                    f'''
                    insert into {SCHEMA}.daily_activity_metrics
                    (report_date, dau, source_note)
                    values (%s,%s,%s)
                    ''',
                    [(row['report_date'], row['dau'], row['source_note']) for row in payloads['daily_activity']],
                )

            if payloads['monthly_activity']:
                cur.executemany(
                    f'''
                    insert into {SCHEMA}.monthly_activity_metrics
                    (report_month, mau, source_note)
                    values (%s,%s,%s)
                    ''',
                    [(row['report_month'], row['mau'], row['source_note']) for row in payloads['monthly_activity']],
                )

        conn.commit()

    print('IMPORTED_BATCH_ID', import_batch_id)


if __name__ == '__main__':
    args = parse_args()
    run_sync(spreadsheet_id=args.spreadsheet_id, dry_run=args.dry_run)
