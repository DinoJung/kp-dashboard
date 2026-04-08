-- Thekary Point monthly reporting schema
-- Designed for Supabase Postgres
-- Principles:
-- 1) member/ad keep latest monthly truth for reporting
-- 2) event keeps both current latest aggregate and time-based snapshots
-- 3) raw imports are preserved for lineage/debugging

create schema if not exists thekary_point;

create table if not exists thekary_point.import_batches (
  id bigint generated always as identity primary key,
  source_file_name text,
  source_file_path text,
  source_type text not null default 'xlsx',
  source_note text,
  imported_at timestamptz not null default now(),
  imported_by text,
  status text not null default 'completed',
  unique (source_file_name, imported_at)
);

create table if not exists thekary_point.raw_member_daily (
  id bigint generated always as identity primary key,
  import_batch_id bigint references thekary_point.import_batches(id) on delete set null,
  report_date date not null,
  weekday_text text,
  member_count integer,
  app_downloads integer,
  withdrawals integer,
  net_growth integer,
  cumulative_conversion integer,
  active_members integer,
  is_month_end boolean default false,
  issue_note text,
  created_at timestamptz not null default now(),
  unique (report_date, import_batch_id)
);

create index if not exists idx_raw_member_daily_report_date on thekary_point.raw_member_daily(report_date);

create table if not exists thekary_point.raw_event_monthly_detail (
  id bigint generated always as identity primary key,
  import_batch_id bigint references thekary_point.import_batches(id) on delete set null,
  report_month date not null,
  promotion_type text not null,
  point_amount integer,
  participant_count integer,
  probability numeric(8,4),
  total_points_issued bigint,
  points_used bigint,
  point_usage_rate numeric(8,6),
  linked_sales_amount bigint,
  created_at timestamptz not null default now()
);

create index if not exists idx_raw_event_monthly_detail_month on thekary_point.raw_event_monthly_detail(report_month);
create index if not exists idx_raw_event_monthly_detail_promotion on thekary_point.raw_event_monthly_detail(promotion_type);

create table if not exists thekary_point.raw_ad_monthly_detail (
  id bigint generated always as identity primary key,
  import_batch_id bigint references thekary_point.import_batches(id) on delete set null,
  report_month date not null,
  media text,
  placement_name text,
  period_text text,
  campaign_goal text,
  impressions bigint,
  clicks bigint,
  cpc numeric(14,4),
  ctr numeric(10,6),
  conversions bigint,
  conversion_rate numeric(10,6),
  revenue bigint,
  average_order_value numeric(14,4),
  ad_spend_vat_inclusive numeric(14,4),
  ad_spend_vat_exclusive numeric(14,4),
  ad_spend_markup_vat_exclusive numeric(14,4),
  roas_vat_exclusive numeric(14,6),
  roas_markup_vat_exclusive numeric(14,6),
  creative_text text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_raw_ad_monthly_detail_month on thekary_point.raw_ad_monthly_detail(report_month);
create index if not exists idx_raw_ad_monthly_detail_placement on thekary_point.raw_ad_monthly_detail(placement_name);

create table if not exists thekary_point.monthly_member_summary (
  report_month date primary key,
  new_members integer not null,
  app_downloads integer not null,
  withdrawals integer not null,
  net_growth integer not null,
  cumulative_conversion_eom integer,
  active_members_eom integer,
  sms_opt_in_members integer,
  push_opt_in_members integer,
  source_import_batch_id bigint references thekary_point.import_batches(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists thekary_point.monthly_ad_summary (
  report_month date primary key,
  media text default '메타',
  impressions bigint,
  clicks bigint,
  cpc numeric(14,4),
  ctr numeric(10,6),
  conversions bigint,
  conversion_rate numeric(10,6),
  revenue bigint,
  average_order_value numeric(14,4),
  ad_spend_vat_exclusive numeric(14,4),
  ad_spend_markup_vat_exclusive numeric(14,4),
  roas_vat_exclusive numeric(14,6),
  roas_markup_vat_exclusive numeric(14,6),
  source_import_batch_id bigint references thekary_point.import_batches(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists thekary_point.monthly_event_current (
  report_month date primary key,
  participant_count integer,
  total_points_issued bigint,
  points_used bigint,
  point_usage_rate numeric(8,6),
  linked_sales_amount bigint,
  as_of_date date not null,
  source_import_batch_id bigint references thekary_point.import_batches(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists thekary_point.monthly_event_snapshot (
  id bigint generated always as identity primary key,
  report_month date not null,
  snapshot_date date not null,
  participant_count integer,
  total_points_issued bigint,
  points_used bigint,
  point_usage_rate numeric(8,6),
  linked_sales_amount bigint,
  is_final boolean not null default false,
  snapshot_reason text default 'reporting',
  source_import_batch_id bigint references thekary_point.import_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (report_month, snapshot_date)
);

create index if not exists idx_monthly_event_snapshot_month on thekary_point.monthly_event_snapshot(report_month);

create table if not exists thekary_point.monthly_report_notes (
  report_month date primary key,
  headline text,
  member_insight text,
  point_insight text,
  ad_insight text,
  risk_note text,
  next_action text,
  updated_at timestamptz not null default now()
);

create or replace view thekary_point.v_monthly_report_base as
select
  m.report_month,
  m.new_members,
  m.app_downloads,
  m.withdrawals,
  m.net_growth,
  m.cumulative_conversion_eom,
  m.active_members_eom,
  m.sms_opt_in_members,
  m.push_opt_in_members,
  e.participant_count as event_participant_count,
  e.total_points_issued,
  e.points_used,
  e.point_usage_rate,
  e.linked_sales_amount,
  a.impressions,
  a.clicks,
  a.cpc,
  a.ctr,
  a.conversions,
  a.conversion_rate,
  a.revenue as ad_revenue,
  a.ad_spend_markup_vat_exclusive,
  a.roas_markup_vat_exclusive
from thekary_point.monthly_member_summary m
left join thekary_point.monthly_event_current e using (report_month)
left join thekary_point.monthly_ad_summary a using (report_month)
order by m.report_month desc;

create or replace view thekary_point.v_monthly_report_mom as
with base as (
  select
    *,
    lag(new_members) over (order by report_month) as prev_new_members,
    lag(app_downloads) over (order by report_month) as prev_app_downloads,
    lag(net_growth) over (order by report_month) as prev_net_growth,
    lag(active_members_eom) over (order by report_month) as prev_active_members_eom,
    lag(total_points_issued) over (order by report_month) as prev_total_points_issued,
    lag(points_used) over (order by report_month) as prev_points_used,
    lag(point_usage_rate) over (order by report_month) as prev_point_usage_rate,
    lag(linked_sales_amount) over (order by report_month) as prev_linked_sales_amount,
    lag(clicks) over (order by report_month) as prev_clicks,
    lag(conversions) over (order by report_month) as prev_conversions,
    lag(ad_revenue) over (order by report_month) as prev_ad_revenue,
    lag(ad_spend_markup_vat_exclusive) over (order by report_month) as prev_ad_spend_markup_vat_exclusive,
    lag(roas_markup_vat_exclusive) over (order by report_month) as prev_roas_markup_vat_exclusive
  from thekary_point.v_monthly_report_base
)
select
  *,
  (new_members - prev_new_members) as diff_new_members,
  (app_downloads - prev_app_downloads) as diff_app_downloads,
  (net_growth - prev_net_growth) as diff_net_growth,
  (active_members_eom - prev_active_members_eom) as diff_active_members_eom,
  (total_points_issued - prev_total_points_issued) as diff_total_points_issued,
  (points_used - prev_points_used) as diff_points_used,
  (point_usage_rate - prev_point_usage_rate) as diff_point_usage_rate,
  (linked_sales_amount - prev_linked_sales_amount) as diff_linked_sales_amount,
  (clicks - prev_clicks) as diff_clicks,
  (conversions - prev_conversions) as diff_conversions,
  (ad_revenue - prev_ad_revenue) as diff_ad_revenue,
  (ad_spend_markup_vat_exclusive - prev_ad_spend_markup_vat_exclusive) as diff_ad_spend_markup_vat_exclusive,
  (roas_markup_vat_exclusive - prev_roas_markup_vat_exclusive) as diff_roas_markup_vat_exclusive
from base
order by report_month desc;
