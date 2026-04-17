-- Icebiscuit META ads reporting schema
-- 목적: Thekary Point와 완전히 분리된 META 광고 raw 적재 및 월간 집계 레이어 제공

create schema if not exists icebiscuit_meta;

create table if not exists icebiscuit_meta.import_batches (
  id bigint generated always as identity primary key,
  source_type text not null default 'meta_marketing_api',
  source_account_id text,
  source_note text,
  requested_since date,
  requested_until date,
  imported_at timestamptz not null default now(),
  imported_by text,
  status text not null default 'completed'
);

create table if not exists icebiscuit_meta.raw_campaign_insights_daily (
  id bigint generated always as identity primary key,
  import_batch_id bigint references icebiscuit_meta.import_batches(id) on delete set null,
  report_date date not null,
  account_id text not null,
  account_name text,
  campaign_id text not null,
  campaign_name text,
  campaign_status text,
  objective text,
  buying_type text,
  impressions bigint,
  reach bigint,
  clicks bigint,
  inline_link_clicks bigint,
  landing_page_views bigint,
  spend numeric(14,4),
  cpc numeric(14,6),
  ctr numeric(14,6),
  purchase_count bigint,
  purchase_value numeric(14,4),
  conversions bigint,
  conversion_value numeric(14,4),
  raw_actions jsonb,
  raw_action_values jsonb,
  raw_payload jsonb,
  synced_at timestamptz not null default now(),
  unique (report_date, account_id, campaign_id)
);

create index if not exists idx_icebiscuit_raw_campaign_date
  on icebiscuit_meta.raw_campaign_insights_daily(report_date);
create index if not exists idx_icebiscuit_raw_campaign_campaign
  on icebiscuit_meta.raw_campaign_insights_daily(campaign_id, report_date);

create table if not exists icebiscuit_meta.raw_ad_insights_daily (
  id bigint generated always as identity primary key,
  import_batch_id bigint references icebiscuit_meta.import_batches(id) on delete set null,
  report_date date not null,
  account_id text not null,
  account_name text,
  campaign_id text,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_id text not null,
  ad_name text,
  objective text,
  buying_type text,
  impressions bigint,
  reach bigint,
  clicks bigint,
  inline_link_clicks bigint,
  landing_page_views bigint,
  spend numeric(14,4),
  cpc numeric(14,6),
  ctr numeric(14,6),
  purchase_count bigint,
  purchase_value numeric(14,4),
  conversions bigint,
  conversion_value numeric(14,4),
  raw_actions jsonb,
  raw_action_values jsonb,
  raw_payload jsonb,
  synced_at timestamptz not null default now(),
  unique (report_date, account_id, ad_id)
);

create index if not exists idx_icebiscuit_raw_ad_date
  on icebiscuit_meta.raw_ad_insights_daily(report_date);
create index if not exists idx_icebiscuit_raw_ad_ad
  on icebiscuit_meta.raw_ad_insights_daily(ad_id, report_date);

create or replace view icebiscuit_meta.v_monthly_campaign_breakdown as
select
  date_trunc('month', report_date)::date as report_month,
  account_id,
  account_name,
  campaign_id,
  campaign_name,
  objective,
  sum(impressions) as impressions,
  sum(reach) as reach,
  sum(clicks) as clicks,
  sum(inline_link_clicks) as inline_link_clicks,
  sum(landing_page_views) as landing_page_views,
  sum(spend) as ad_spend,
  case when sum(clicks) > 0 then sum(spend) / sum(clicks) else null end as cpc,
  case when sum(impressions) > 0 then sum(clicks)::numeric / sum(impressions) else null end as ctr,
  sum(purchase_count) as purchase_count,
  sum(purchase_value) as purchase_value,
  sum(conversions) as conversions,
  sum(conversion_value) as conversion_value,
  case when sum(spend) > 0 then sum(purchase_value) / sum(spend) else null end as roas
from icebiscuit_meta.raw_campaign_insights_daily
group by 1,2,3,4,5,6
order by report_month desc, campaign_name;

create or replace view icebiscuit_meta.v_monthly_ad_summary as
select
  report_month,
  max(account_id) as account_id,
  max(account_name) as account_name,
  sum(impressions) as impressions,
  sum(reach) as reach,
  sum(clicks) as clicks,
  sum(inline_link_clicks) as inline_link_clicks,
  sum(landing_page_views) as landing_page_views,
  sum(ad_spend) as ad_spend,
  case when sum(clicks) > 0 then sum(ad_spend) / sum(clicks) else null end as cpc,
  case when sum(impressions) > 0 then sum(clicks)::numeric / sum(impressions) else null end as ctr,
  sum(purchase_count) as purchase_count,
  sum(purchase_value) as purchase_value,
  sum(conversions) as conversions,
  sum(conversion_value) as conversion_value,
  case when sum(ad_spend) > 0 then sum(purchase_value) / sum(ad_spend) else null end as roas
from icebiscuit_meta.v_monthly_campaign_breakdown
group by report_month
order by report_month desc;

create or replace view icebiscuit_meta.v_daily_ad_creative_breakdown as
with grouped as (
  select
    report_date,
    case
      when coalesce(campaign_name, '') like '%리타겟팅%' then '리타겟팅'
      when coalesce(campaign_name, '') like '%성인라인업%' or coalesce(campaign_name, '') like '%전환 캠페인%' then '전환(패션관심)'
      when coalesce(campaign_name, '') like '%트래픽%' or coalesce(campaign_name, '') like '%게시물 참여%' or objective in ('OUTCOME_ENGAGEMENT', 'LINK_CLICKS') then '참여 캠페인 / 게시물참여'
      when coalesce(campaign_name, '') like '%어드밴티지+ 쇼핑%' or coalesce(campaign_name, '') like 'ASC%' or coalesce(campaign_name, '') like '%전체 라인업%' then 'ASC'
      else coalesce(campaign_name, '기타')
    end as campaign_group,
    ad_id,
    ad_name,
    sum(impressions) as impressions,
    sum(reach) as reach,
    sum(clicks) as clicks,
    sum(inline_link_clicks) as inline_link_clicks,
    sum(landing_page_views) as landing_page_views,
    sum(spend) as ad_spend,
    case when sum(clicks) > 0 then sum(spend) / sum(clicks) else null end as cpc,
    case when sum(impressions) > 0 then sum(clicks)::numeric / sum(impressions) else null end as ctr,
    sum(purchase_count) as purchase_count,
    sum(purchase_value) as purchase_value,
    sum(conversions) as conversions,
    sum(conversion_value) as conversion_value,
    case when sum(spend) > 0 then sum(purchase_value) / sum(spend) else null end as roas
  from icebiscuit_meta.raw_ad_insights_daily
  group by 1,2,3,4
)
select *
from grouped
order by report_date desc, campaign_group, ad_name;

create or replace view icebiscuit_meta.v_monthly_ad_creative_breakdown as
select
  date_trunc('month', report_date)::date as report_month,
  campaign_group,
  ad_id,
  ad_name,
  sum(impressions) as impressions,
  sum(reach) as reach,
  sum(clicks) as clicks,
  sum(inline_link_clicks) as inline_link_clicks,
  sum(landing_page_views) as landing_page_views,
  sum(ad_spend) as ad_spend,
  case when sum(clicks) > 0 then sum(ad_spend) / sum(clicks) else null end as cpc,
  case when sum(impressions) > 0 then sum(clicks)::numeric / sum(impressions) else null end as ctr,
  sum(purchase_count) as purchase_count,
  sum(purchase_value) as purchase_value,
  sum(conversions) as conversions,
  sum(conversion_value) as conversion_value,
  case when sum(ad_spend) > 0 then sum(purchase_value) / sum(ad_spend) else null end as roas
from icebiscuit_meta.v_daily_ad_creative_breakdown
group by 1,2,3,4
order by report_month desc, campaign_group, ad_name;
