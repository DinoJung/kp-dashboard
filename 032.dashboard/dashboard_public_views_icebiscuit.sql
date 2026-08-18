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

create or replace view public.dashboard_icebiscuit_daily_breakdown as
select
  report_date,
  account_id,
  account_name,
  campaign_name,
  impressions,
  clicks,
  ctr,
  spend as ad_spend,
  purchase_count,
  purchase_value,
  case when clicks > 0 then purchase_count::numeric / clicks else null end as purchase_rate,
  case when spend > 0 then purchase_value / spend else null end as roas
from icebiscuit_meta.raw_campaign_insights_daily;

create or replace view public.dashboard_icebiscuit_ad_creative_breakdown as
select
  report_month,
  campaign_group,
  ad_id,
  ad_name,
  impressions,
  clicks,
  ctr,
  ad_spend,
  purchase_count,
  purchase_value,
  case when clicks > 0 then purchase_count::numeric / clicks else null end as purchase_rate,
  roas
from icebiscuit_meta.v_monthly_ad_creative_breakdown;

create or replace view public.dashboard_icebiscuit_daily_creative_breakdown as
select
  report_date,
  campaign_group,
  ad_id,
  ad_name,
  impressions,
  clicks,
  ctr,
  ad_spend,
  purchase_count,
  purchase_value,
  case when clicks > 0 then purchase_count::numeric / clicks else null end as purchase_rate,
  roas
from icebiscuit_meta.v_daily_ad_creative_breakdown;

-- The dashboard requires a Supabase Auth session. Never expose Meta data to anon.
grant usage on schema public to authenticated;
revoke all on table public.dashboard_icebiscuit_monthly_overview from anon;
revoke all on table public.dashboard_icebiscuit_ad_campaign_breakdown from anon;
revoke all on table public.dashboard_icebiscuit_daily_breakdown from anon;
revoke all on table public.dashboard_icebiscuit_ad_creative_breakdown from anon;
revoke all on table public.dashboard_icebiscuit_daily_creative_breakdown from anon;
grant select on public.dashboard_icebiscuit_monthly_overview to authenticated;
grant select on public.dashboard_icebiscuit_ad_campaign_breakdown to authenticated;
grant select on public.dashboard_icebiscuit_daily_breakdown to authenticated;
grant select on public.dashboard_icebiscuit_ad_creative_breakdown to authenticated;
grant select on public.dashboard_icebiscuit_daily_creative_breakdown to authenticated;
