from __future__ import annotations

import importlib.util
import pathlib
import sys
import unittest


MODULE_PATH = pathlib.Path('/home/j1nu/workspace/10.work/03.KPdash/031.data/fetch_icebiscuit_meta_ads.py')


def load_module():
    sys.modules.pop('fetch_icebiscuit_meta_ads_under_test', None)
    spec = importlib.util.spec_from_file_location('fetch_icebiscuit_meta_ads_under_test', MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class BuildRowsTest(unittest.TestCase):
    def test_build_rows_deduplicates_purchase_aliases_in_actions_and_values(self):
        mod = load_module()
        payload = {
            'data': [
                {
                    'date_start': '2026-04-16',
                    'account_id': 'act_123',
                    'account_name': 'Icebiscuit',
                    'campaign_id': 'cmp_1',
                    'campaign_name': 'ASC_전체 라인업 캠페인',
                    'objective': 'OUTCOME_SALES',
                    'buying_type': 'AUCTION',
                    'impressions': '1000',
                    'reach': '900',
                    'clicks': '100',
                    'spend': '5000',
                    'cpc': '50',
                    'ctr': '10',
                    'actions': [
                        {'action_type': 'purchase', 'value': '10'},
                        {'action_type': 'onsite_web_purchase', 'value': '10'},
                        {'action_type': 'offsite_conversion.fb_pixel_purchase', 'value': '10'},
                        {'action_type': 'omni_purchase', 'value': '10'},
                        {'action_type': 'link_click', 'value': '80'},
                    ],
                    'action_values': [
                        {'action_type': 'purchase', 'value': '100000'},
                        {'action_type': 'onsite_web_purchase', 'value': '100000'},
                        {'action_type': 'offsite_conversion.fb_pixel_purchase', 'value': '100000'},
                        {'action_type': 'omni_purchase', 'value': '100000'},
                    ],
                }
            ]
        }

        rows = mod.build_rows(payload)

        self.assertEqual(rows[0]['purchase_count'], 10)
        self.assertEqual(rows[0]['purchase_value'], 100000.0)
        self.assertEqual(rows[0]['conversions'], 90)
        self.assertEqual(rows[0]['conversion_value'], 100000.0)

    def test_build_rows_falls_back_to_available_purchase_alias(self):
        mod = load_module()
        payload = {
            'data': [
                {
                    'date_start': '2026-04-16',
                    'account_id': 'act_123',
                    'account_name': 'Icebiscuit',
                    'campaign_id': 'cmp_2',
                    'campaign_name': '리타겟팅 캠페인',
                    'objective': 'OUTCOME_SALES',
                    'buying_type': 'AUCTION',
                    'impressions': '500',
                    'reach': '450',
                    'clicks': '50',
                    'spend': '2500',
                    'cpc': '50',
                    'ctr': '10',
                    'actions': [
                        {'action_type': 'onsite_web_purchase', 'value': '7'},
                    ],
                    'action_values': [
                        {'action_type': 'onsite_web_purchase', 'value': '77777'},
                    ],
                }
            ]
        }

        rows = mod.build_rows(payload)

        self.assertEqual(rows[0]['purchase_count'], 7)
        self.assertEqual(rows[0]['purchase_value'], 77777.0)
        self.assertEqual(rows[0]['conversions'], 7)
        self.assertEqual(rows[0]['conversion_value'], 77777.0)


class PersistRowsHelperTest(unittest.TestCase):
    def test_rows_account_ids_prefer_raw_api_account_id_values(self):
        mod = load_module()

        account_ids = mod.rows_account_ids(
            [
                {'account_id': '876126997379538'},
                {'account_id': '876126997379538'},
            ],
            fallback_account_id='act_876126997379538',
        )

        self.assertEqual(account_ids, ['876126997379538'])


if __name__ == '__main__':
    unittest.main()
