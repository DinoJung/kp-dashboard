drop view if exists public.dashboard_monthly_overview;
create view public.dashboard_monthly_overview as
select
  b.report_month,
  b.new_members,
  b.app_downloads,
  b.withdrawals,
  b.net_growth,
  b.cumulative_conversion_eom,
  b.active_members_eom,
  a.mau as reported_mau,
  b.sms_opt_in_members,
  b.push_opt_in_members,
  b.event_participant_count,
  b.total_points_issued,
  b.points_used,
  b.point_usage_rate,
  b.linked_sales_amount,
  b.impressions,
  b.clicks,
  b.cpc,
  b.ctr,
  b.conversions,
  b.conversion_rate,
  b.ad_revenue,
  b.ad_spend_markup_vat_exclusive,
  b.roas_markup_vat_exclusive
from thekary_point.v_monthly_report_base b
left join thekary_point.monthly_activity_metrics a using (report_month);

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

create or replace view public.dashboard_activity_daily as
select
  report_date,
  date_trunc('month', report_date)::date as report_month,
  dau
from thekary_point.daily_activity_metrics;

grant usage on schema public to anon, authenticated;
grant select on public.dashboard_monthly_overview to anon, authenticated;
grant select on public.dashboard_promotion_breakdown to anon, authenticated;
grant select on public.dashboard_ad_campaign_breakdown to anon, authenticated;
grant select on public.dashboard_member_daily to anon, authenticated;
grant select on public.dashboard_activity_daily to anon, authenticated;
