create table if not exists thekary_point.daily_activity_metrics (
  report_date date primary key,
  dau integer,
  source_note text default 'manual_seed_2026_04_08',
  updated_at timestamptz not null default now()
);

create table if not exists thekary_point.monthly_activity_metrics (
  report_month date primary key,
  mau integer,
  source_note text default 'manual_seed_2026_04_08',
  updated_at timestamptz not null default now()
);
