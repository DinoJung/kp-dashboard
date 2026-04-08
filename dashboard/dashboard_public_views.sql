create or replace view public.dashboard_monthly_overview as
select
  report_month,
  new_members,
  app_downloads,
  withdrawals,
  net_growth,
  cumulative_conversion_eom,
  active_members_eom,
  sms_opt_in_members,
  push_opt_in_members,
  event_participant_count,
  total_points_issued,
  points_used,
  point_usage_rate,
  linked_sales_amount,
  impressions,
  clicks,
  cpc,
  ctr,
  conversions,
  conversion_rate,
  ad_revenue,
  ad_spend_markup_vat_exclusive,
  roas_markup_vat_exclusive
from thekary_point.v_monthly_report_base;

create or replace view public.dashboard_promotion_breakdown as
select
  report_month,
  promotion_type,
  point_amount,
  participant_count,
  probability,
  total_points_issued,
  points_used,
  point_usage_rate,
  linked_sales_amount
from thekary_point.raw_event_monthly_detail
where promotion_type <> 'TTL';

create or replace view public.dashboard_ad_campaign_breakdown as
select
  report_month,
  media,
  placement_name,
  period_text,
  campaign_goal,
  impressions,
  clicks,
  cpc,
  ctr,
  conversions,
  conversion_rate,
  revenue,
  average_order_value,
  ad_spend_vat_inclusive,
  ad_spend_vat_exclusive,
  ad_spend_markup_vat_exclusive,
  roas_vat_exclusive,
  roas_markup_vat_exclusive,
  creative_text,
  note
from thekary_point.raw_ad_monthly_detail
where placement_name <> 'TTL';

create or replace view public.dashboard_member_daily as
select
  report_date,
  date_trunc('month', report_date)::date as report_month,
  member_count,
  app_downloads,
  withdrawals,
  net_growth,
  cumulative_conversion,
  active_members,
  is_month_end,
  issue_note
from thekary_point.raw_member_daily;

grant usage on schema public to anon, authenticated;
grant select on public.dashboard_monthly_overview to anon, authenticated;
grant select on public.dashboard_promotion_breakdown to anon, authenticated;
grant select on public.dashboard_ad_campaign_breakdown to anon, authenticated;
grant select on public.dashboard_member_daily to anon, authenticated;
