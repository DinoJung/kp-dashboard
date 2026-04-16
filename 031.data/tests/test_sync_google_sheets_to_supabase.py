from __future__ import annotations

import importlib.util
import pathlib
import sys
import types
import unittest


MODULE_PATH = pathlib.Path('/home/j1nu/workspace/10.work/03.KPdash/031.data/sync_google_sheets_to_supabase.py')


def load_module():
    sys.modules.pop('sync_google_sheets_to_supabase_under_test', None)
    spec = importlib.util.spec_from_file_location('sync_google_sheets_to_supabase_under_test', MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class BuildPayloadsTest(unittest.TestCase):
    def test_raw_member_merged_metrics_override_legacy_tabs(self):
        mod = load_module()
        sample_rows = {
            mod.SHEET_RANGES['raw_member']: [
                {
                    'report_date': '2026-04-01',
                    'weekday_text': '수',
                    'member_count': '10',
                    'app_downloads': '3',
                    'withdrawals': '1',
                    'net_growth': '9',
                    'cumulative_conversion': '100',
                    'active_members': '80',
                    'optin': '20',
                    'dau': '500',
                    'is_month_end': 'false',
                },
                {
                    'report_date': '2026-04-30',
                    'weekday_text': '목',
                    'member_count': '12',
                    'app_downloads': '2',
                    'withdrawals': '1',
                    'net_growth': '11',
                    'cumulative_conversion': '150',
                    'active_members': '90',
                    'push_opt_in_members': '30',
                    'dau': '650',
                    'mau': '15000',
                    'is_month_end': 'true',
                    'issue_note': 'month-end',
                },
            ],
            mod.SHEET_RANGES['raw_event']: [],
            mod.SHEET_RANGES['raw_ad']: [],
            mod.SHEET_RANGES['raw_optin']: [
                {'report_month': '2026-04-30', 'sms_opt_in_members': '999', 'push_opt_in_members': '999'},
            ],
            mod.SHEET_RANGES['daily_activity']: [
                {'report_date': '2026-04-01', 'dau': '999', 'source_note': 'legacy'},
            ],
            mod.SHEET_RANGES['monthly_activity']: [
                {'report_month': '2026-04-01', 'mau': '99999', 'source_note': 'legacy'},
            ],
        }
        mod.rows_from_sheet = lambda spreadsheet_id, a1_range: sample_rows.get(a1_range, [])

        payload = mod.build_payloads('dummy')

        self.assertEqual(len(payload['member_raw']), 2)
        self.assertEqual(payload['monthly_member'][0]['new_members'], 22)
        self.assertEqual(payload['monthly_member'][0]['push_opt_in_members'], 50)
        self.assertEqual(payload['daily_activity'][0]['dau'], 500)
        self.assertEqual(payload['daily_activity'][1]['dau'], 650)
        self.assertEqual(payload['monthly_activity'][0]['mau'], 15000)

    def test_legacy_tabs_still_work_when_raw_member_has_no_merged_metrics(self):
        mod = load_module()
        sample_rows = {
            mod.SHEET_RANGES['raw_member']: [
                {
                    'report_date': '2026-05-31',
                    'weekday_text': '일',
                    'member_count': '5',
                    'app_downloads': '1',
                    'withdrawals': '0',
                    'net_growth': '5',
                    'cumulative_conversion': '155',
                    'active_members': '95',
                    'is_month_end': 'true',
                },
            ],
            mod.SHEET_RANGES['raw_event']: [],
            mod.SHEET_RANGES['raw_ad']: [],
            mod.SHEET_RANGES['raw_optin']: [
                {'report_month': '2026-05-31', 'sms_opt_in_members': '4', 'push_opt_in_members': '6'},
            ],
            mod.SHEET_RANGES['daily_activity']: [
                {'report_date': '2026-05-31', 'dau': '777', 'source_note': 'legacy'},
            ],
            mod.SHEET_RANGES['monthly_activity']: [
                {'report_month': '2026-05-01', 'mau': '22222', 'source_note': 'legacy'},
            ],
        }
        mod.rows_from_sheet = lambda spreadsheet_id, a1_range: sample_rows.get(a1_range, [])

        payload = mod.build_payloads('dummy')

        self.assertEqual(payload['monthly_member'][0]['sms_opt_in_members'], 4)
        self.assertEqual(payload['monthly_member'][0]['push_opt_in_members'], 6)
        self.assertEqual(payload['daily_activity'][0]['dau'], 777)
        self.assertEqual(payload['monthly_activity'][0]['mau'], 22222)

    def test_raw_ad_accepts_korean_month_and_percent_strings(self):
        mod = load_module()
        sample_rows = {
            mod.SHEET_RANGES['raw_member']: [],
            mod.SHEET_RANGES['raw_event']: [],
            mod.SHEET_RANGES['raw_ad']: [
                {
                    'media': '메타',
                    'placement_name': 'TTL',
                    'report_month': '26년 04월',
                    'period_text': 'TTL',
                    'campaign_goal': 'TTL',
                    'impressions': '53,787',
                    'clicks': '822',
                    'cpc': '650',
                    'ctr': '1.53%',
                    'conversions': '25',
                    'conversion_rate': '3.04%',
                    'revenue': '1,988,379',
                    'average_order_value': '79,535',
                    'ad_spend_vat_inclusive': '676,278',
                    'ad_spend_vat_exclusive': '614,798',
                    'ad_spend_markup_vat_exclusive': '534,607',
                    'roas_vat_exclusive': '323%',
                    'roas_markup_vat_exclusive': '372%',
                }
            ],
            mod.SHEET_RANGES['raw_optin']: [],
            mod.SHEET_RANGES['daily_activity']: [],
            mod.SHEET_RANGES['monthly_activity']: [],
        }
        mod.rows_from_sheet = lambda spreadsheet_id, a1_range: sample_rows.get(a1_range, [])

        payload = mod.build_payloads('dummy')

        self.assertEqual(payload['ad_raw'][0]['report_month'].isoformat(), '2026-04-01')
        self.assertAlmostEqual(payload['ad_raw'][0]['ctr'], 0.0153, places=6)
        self.assertAlmostEqual(payload['monthly_ad'][0]['roas_markup_vat_exclusive'], 3.72, places=6)

    def test_optional_legacy_sheets_can_be_missing(self):
        mod = load_module()
        sample_rows = {
            mod.SHEET_RANGES['raw_member']: [
                {
                    'report_date': '2026-05-31',
                    'weekday_text': '일',
                    'member_count': '5',
                    'app_downloads': '1',
                    'withdrawals': '0',
                    'net_growth': '5',
                    'cumulative_conversion': '155',
                    'active_members': '95',
                    'dau': '777',
                    'mau': '22222',
                    'is_month_end': 'true',
                },
            ],
            mod.SHEET_RANGES['raw_event']: [],
            mod.SHEET_RANGES['raw_ad']: [],
        }

        def fake_rows(spreadsheet_id, a1_range):
            if a1_range in sample_rows:
                return sample_rows[a1_range]
            raise mod.subprocess.CalledProcessError(1, ['gws'], stderr='Unable to parse range: missing sheet')

        mod.rows_from_sheet = fake_rows

        payload = mod.build_payloads('dummy')

        self.assertEqual(payload['daily_activity'][0]['dau'], 777)
        self.assertEqual(payload['monthly_activity'][0]['mau'], 22222)
        self.assertEqual(payload['monthly_optin'], [])


if __name__ == '__main__':
    unittest.main()
