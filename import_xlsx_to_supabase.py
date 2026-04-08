from __future__ import annotations

import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from zipfile import ZipFile
from xml.etree import ElementTree as ET

import psycopg
from dotenv import dotenv_values

ROOT = Path('/home/j1nu/workspace/hermes/KP_monthly-report')
ENV_PATH = ROOT / '.env'
XLSX_PATH = Path('/home/j1nu/.hermes/cache/documents/doc_fe6fe4b8bab8_2026_thekarypoint_totaldata.xlsx')
SCHEMA = 'thekary_point'

NS = {
    'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'rel': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}
KR_WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']


def col_to_num(col: str) -> int:
    n = 0
    for c in col:
        n = n * 26 + ord(c) - 64
    return n


def num_to_col(n: int) -> str:
    s = ''
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def parse_cell_ref(cell: str) -> tuple[int, int]:
    m = re.match(r'([A-Z]+)(\d+)', cell)
    if not m:
        raise ValueError(f'Bad cell ref: {cell}')
    return col_to_num(m.group(1)), int(m.group(2))


def excel_date(v: Any) -> date | None:
    if v in ('', None):
        return None
    try:
        return (datetime(1899, 12, 30) + timedelta(days=float(v))).date()
    except Exception:
        return None


def to_int(v: Any) -> int | None:
    if v in ('', None):
        return None
    try:
        return int(round(float(v)))
    except Exception:
        return None


def to_float(v: Any) -> float | None:
    if v in ('', None):
        return None
    try:
        return float(v)
    except Exception:
        return None


def to_bool(v: Any) -> bool:
    if v in ('', None):
        return False
    try:
        return float(v) != 0
    except Exception:
        return str(v).strip().lower() in {'true', 't', 'y', 'yes', '1'}


def month_start(d: date) -> date:
    return d.replace(day=1)


class XlsxTableReader:
    def __init__(self, path: Path):
        self.path = path
        self.shared_strings: list[str] = []
        self.sheet_by_name: dict[str, str] = {}
        self._load_meta()

    def _load_meta(self) -> None:
        with ZipFile(self.path) as z:
            if 'xl/sharedStrings.xml' in z.namelist():
                sst = ET.fromstring(z.read('xl/sharedStrings.xml'))
                for si in sst.findall('main:si', NS):
                    self.shared_strings.append(''.join((t.text or '') for t in si.iterfind('.//main:t', NS)))
            wb = ET.fromstring(z.read('xl/workbook.xml'))
            rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
            rel_map = {r.attrib['Id']: r.attrib['Target'] for r in rels}
            self.sheet_by_name = {
                s.attrib['name']: 'xl/' + rel_map[s.attrib['{' + NS['rel'] + '}id']]
                for s in wb.find('main:sheets', NS)
            }

    def load_table(self, sheet_name: str, ref: str) -> list[dict[str, Any]]:
        with ZipFile(self.path) as z:
            root = ET.fromstring(z.read(self.sheet_by_name[sheet_name]))
            cells: dict[str, str] = {}
            for c in root.findall('.//main:sheetData/main:row/main:c', NS):
                rr = c.attrib['r']
                t = c.attrib.get('t')
                v = c.find('main:v', NS)
                isel = c.find('main:is', NS)
                if t == 's' and v is not None:
                    val = self.shared_strings[int(v.text)]
                elif t == 'inlineStr' and isel is not None:
                    val = ''.join((x.text or '') for x in isel.iterfind('.//main:t', NS))
                elif v is not None:
                    val = v.text
                else:
                    val = ''
                cells[rr] = val

            (c1, r1), (c2, r2) = [parse_cell_ref(x) for x in ref.split(':')]
            headers = [cells.get(f'{num_to_col(c)}{r1}', '') for c in range(c1, c2 + 1)]
            rows = []
            for r in range(r1 + 1, r2 + 1):
                row = {headers[i]: cells.get(f'{num_to_col(c1 + i)}{r}', '') for i in range(len(headers))}
                rows.append(row)
            return rows


def build_payloads() -> dict[str, Any]:
    reader = XlsxTableReader(XLSX_PATH)
    tblmem = reader.load_table('raw_member', 'A1:J704')
    tblevent = reader.load_table('raw_event', 'A1:J230')
    tblad = reader.load_table('raw_ad', 'A1:T97')

    member_raw = []
    monthly_member: dict[date, dict[str, Any]] = {}

    for row in tblmem:
        d = excel_date(row.get('날짜'))
        if not d:
            continue
        item = {
            'report_date': d,
            'weekday_text': KR_WEEKDAYS[d.weekday()],
            'member_count': to_int(row.get('회원수')),
            'app_downloads': to_int(row.get('앱다운로드')),
            'withdrawals': to_int(row.get('탈퇴수')),
            'net_growth': to_int(row.get('순증')),
            'cumulative_conversion': to_int(row.get('누적전환')),
            'active_members': to_int(row.get('활성회원')),
            'is_month_end': to_bool(row.get('월말여부')),
            'issue_note': (row.get('비고 및 이슈') or '').strip() or None,
        }
        member_raw.append(item)

    by_month_member: dict[date, list[dict[str, Any]]] = defaultdict(list)
    for item in member_raw:
        by_month_member[month_start(item['report_date'])].append(item)

    for m, rows in sorted(by_month_member.items()):
        rows = sorted(rows, key=lambda x: x['report_date'])
        eom = rows[-1]
        monthly_member[m] = {
            'report_month': m,
            'new_members': sum(x['member_count'] or 0 for x in rows),
            'app_downloads': sum(x['app_downloads'] or 0 for x in rows),
            'withdrawals': sum(x['withdrawals'] or 0 for x in rows),
            'net_growth': sum(x['net_growth'] or 0 for x in rows),
            'cumulative_conversion_eom': eom['cumulative_conversion'],
            'active_members_eom': eom['active_members'],
            'sms_opt_in_members': None,
            'push_opt_in_members': None,
        }

    event_raw = []
    monthly_event_current: dict[date, dict[str, Any]] = {}

    for row in tblevent:
        d = excel_date(row.get('날짜'))
        if not d:
            continue
        report_month = month_start(d)
        item = {
            'report_month': report_month,
            'promotion_type': (row.get('프로모션 종류') or '').strip(),
            'point_amount': to_int(row.get('지급 포인트')),
            'participant_count': to_int(row.get('인원')),
            'probability': to_float(row.get('확률')),
            'total_points_issued': to_int(row.get('총 지급 포인트')),
            'points_used': to_int(row.get('사용 포인트')),
            'point_usage_rate': to_float(row.get('포인트 사용률')),
            'linked_sales_amount': to_int(row.get('연계매출액')),
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

    ad_raw = []
    monthly_ad: dict[date, dict[str, Any]] = {}

    for row in tblad:
        d = excel_date(row.get('날짜'))
        if not d:
            continue
        report_month = month_start(d)
        item = {
            'report_month': report_month,
            'media': (row.get('매체') or '').strip() or None,
            'placement_name': (row.get('구좌명') or '').strip() or None,
            'period_text': (row.get('기간') or '').strip() or None,
            'campaign_goal': (row.get('캠페인 목표') or '').strip() or None,
            'impressions': to_int(row.get('노출')),
            'clicks': to_int(row.get('유입량')),
            'cpc': to_float(row.get('CPC')),
            'ctr': to_float(row.get('CTR')),
            'conversions': to_int(row.get('전환량')),
            'conversion_rate': to_float(row.get('전환율')),
            'revenue': to_int(row.get('매출')),
            'average_order_value': to_float(row.get('객단가')),
            'ad_spend_vat_inclusive': to_float(row.get('광고비 (vat+)')),
            'ad_spend_vat_exclusive': to_float(row.get('광고비 (vat-)')),
            'ad_spend_markup_vat_exclusive': to_float(row.get('광고비 (마크업,vat-)')),
            'roas_vat_exclusive': to_float(row.get('ROAS(vat-기준)')),
            'roas_markup_vat_exclusive': to_float(row.get('ROAS(마크업,vat-기준)')),
            'creative_text': (row.get('광고소재') or '').strip() or None,
            'note': (row.get('비고') or '').strip() or None,
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

    snapshot_date = date.today()
    event_snapshots = [
        {
            **v,
            'snapshot_date': snapshot_date,
            'is_final': False,
            'snapshot_reason': 'initial_full_history_import',
        }
        for _, v in sorted(monthly_event_current.items())
    ]

    return {
        'member_raw': member_raw,
        'monthly_member': [monthly_member[k] for k in sorted(monthly_member)],
        'event_raw': event_raw,
        'monthly_event_current': [monthly_event_current[k] for k in sorted(monthly_event_current)],
        'event_snapshots': event_snapshots,
        'ad_raw': ad_raw,
        'monthly_ad': [monthly_ad[k] for k in sorted(monthly_ad)],
    }


def run_import() -> None:
    cfg = dotenv_values(ENV_PATH)
    db_url = cfg['DATABASE_URL']
    payloads = build_payloads()

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                insert into {SCHEMA}.import_batches
                    (source_file_name, source_file_path, source_type, source_note, imported_by, status)
                values (%s, %s, %s, %s, %s, %s)
                returning id
                """,
                (
                    XLSX_PATH.name,
                    str(XLSX_PATH),
                    'xlsx',
                    'full historical import from provided workbook',
                    'hermes',
                    'completed',
                ),
            )
            import_batch_id = cur.fetchone()[0]

            member_rows = [
                (
                    import_batch_id,
                    x['report_date'],
                    x['weekday_text'],
                    x['member_count'],
                    x['app_downloads'],
                    x['withdrawals'],
                    x['net_growth'],
                    x['cumulative_conversion'],
                    x['active_members'],
                    x['is_month_end'],
                    x['issue_note'],
                )
                for x in payloads['member_raw']
            ]
            cur.executemany(
                f"""
                insert into {SCHEMA}.raw_member_daily
                (import_batch_id, report_date, weekday_text, member_count, app_downloads, withdrawals, net_growth,
                 cumulative_conversion, active_members, is_month_end, issue_note)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                on conflict (report_date, import_batch_id) do nothing
                """,
                member_rows,
            )

            event_rows = [
                (
                    import_batch_id,
                    x['report_month'],
                    x['promotion_type'],
                    x['point_amount'],
                    x['participant_count'],
                    x['probability'],
                    x['total_points_issued'],
                    x['points_used'],
                    x['point_usage_rate'],
                    x['linked_sales_amount'],
                )
                for x in payloads['event_raw']
            ]
            cur.executemany(
                f"""
                insert into {SCHEMA}.raw_event_monthly_detail
                (import_batch_id, report_month, promotion_type, point_amount, participant_count, probability,
                 total_points_issued, points_used, point_usage_rate, linked_sales_amount)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                event_rows,
            )

            ad_rows = [
                (
                    import_batch_id,
                    x['report_month'],
                    x['media'],
                    x['placement_name'],
                    x['period_text'],
                    x['campaign_goal'],
                    x['impressions'],
                    x['clicks'],
                    x['cpc'],
                    x['ctr'],
                    x['conversions'],
                    x['conversion_rate'],
                    x['revenue'],
                    x['average_order_value'],
                    x['ad_spend_vat_inclusive'],
                    x['ad_spend_vat_exclusive'],
                    x['ad_spend_markup_vat_exclusive'],
                    x['roas_vat_exclusive'],
                    x['roas_markup_vat_exclusive'],
                    x['creative_text'],
                    x['note'],
                )
                for x in payloads['ad_raw']
            ]
            cur.executemany(
                f"""
                insert into {SCHEMA}.raw_ad_monthly_detail
                (import_batch_id, report_month, media, placement_name, period_text, campaign_goal,
                 impressions, clicks, cpc, ctr, conversions, conversion_rate, revenue, average_order_value,
                 ad_spend_vat_inclusive, ad_spend_vat_exclusive, ad_spend_markup_vat_exclusive,
                 roas_vat_exclusive, roas_markup_vat_exclusive, creative_text, note)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                ad_rows,
            )

            cur.executemany(
                f"""
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
                """,
                [
                    (
                        x['report_month'], x['new_members'], x['app_downloads'], x['withdrawals'], x['net_growth'],
                        x['cumulative_conversion_eom'], x['active_members_eom'], x['sms_opt_in_members'], x['push_opt_in_members'], import_batch_id,
                    )
                    for x in payloads['monthly_member']
                ],
            )

            cur.executemany(
                f"""
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
                """,
                [
                    (
                        x['report_month'], x['participant_count'], x['total_points_issued'], x['points_used'],
                        x['point_usage_rate'], x['linked_sales_amount'], date.today(), import_batch_id,
                    )
                    for x in payloads['monthly_event_current']
                ],
            )

            cur.executemany(
                f"""
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
                """,
                [
                    (
                        x['report_month'], x['snapshot_date'], x['participant_count'], x['total_points_issued'],
                        x['points_used'], x['point_usage_rate'], x['linked_sales_amount'],
                        x['is_final'], x['snapshot_reason'], import_batch_id,
                    )
                    for x in payloads['event_snapshots']
                ],
            )

            cur.executemany(
                f"""
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
                """,
                [
                    (
                        x['report_month'], x['media'], x['impressions'], x['clicks'], x['cpc'], x['ctr'],
                        x['conversions'], x['conversion_rate'], x['revenue'], x['average_order_value'],
                        x['ad_spend_vat_exclusive'], x['ad_spend_markup_vat_exclusive'],
                        x['roas_vat_exclusive'], x['roas_markup_vat_exclusive'], import_batch_id,
                    )
                    for x in payloads['monthly_ad']
                ],
            )

        conn.commit()

    print('IMPORTED_BATCH_ID', import_batch_id)
    print('RAW_MEMBER_ROWS', len(payloads['member_raw']))
    print('RAW_EVENT_ROWS', len(payloads['event_raw']))
    print('RAW_AD_ROWS', len(payloads['ad_raw']))
    print('MONTHLY_MEMBER_ROWS', len(payloads['monthly_member']))
    print('MONTHLY_EVENT_CURRENT_ROWS', len(payloads['monthly_event_current']))
    print('MONTHLY_EVENT_SNAPSHOT_ROWS', len(payloads['event_snapshots']))
    print('MONTHLY_AD_ROWS', len(payloads['monthly_ad']))


if __name__ == '__main__':
    run_import()
