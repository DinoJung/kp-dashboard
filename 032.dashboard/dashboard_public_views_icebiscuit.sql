drop view if exists public.dashboard_icebiscuit_monthly_overview;
create view public.dashboard_icebiscuit_monthly_overview as
select
  report_month,
  account_id,
  account_name,
  impressions,
  reach,
  clicks,
  inline_link_clicks,
  landing_page_views,
  ad_spend,
  cpc,
  ctr,
  purchase_count,
  purchase_value,
  conversions,
  conversion_value,
  roas
from icebiscuit_meta.v_monthly_ad_summary;

create or replace view public.dashboard_icebiscuit_ad_campaign_breakdown as
select
  report_month,
  account_id,
  account_name,
  campaign_id,
  campaign_name,
  objective,
  impressions,
  reach,
  clicks,
  inline_link_clicks,
  landing_page_views,
  ad_spend,
  cpc,
  ctr,
  purchase_count,
  purchase_value,
  conversions,
  conversion_value,
  roas
from icebiscuit_meta.v_monthly_campaign_breakdown;

grant usage on schema public to anon, authenticated;
grant select on public.dashboard_icebiscuit_monthly_overview to anon, authenticated;
grant select on public.dashboard_icebiscuit_ad_campaign_breakdown to anon, authenticated;
