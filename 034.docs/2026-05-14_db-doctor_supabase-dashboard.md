# DB 주치의: Supabase 대시보드 연결 검토

## 판정
**현재 상태: Supabase 연결 설계는 타당하지만, 운영 연결은 `not verifiable`, Icebiscuit view 계약은 `broken contract` 상태.**

Supabase 자체를 쓰는 선택은 과하지 않다. 이 대시보드는 내부 반복 리포팅/브랜드별 KPI/광고성과/월간 집계/공개 조회용 view가 필요하고, Google Sheets와 META API 원천을 정규화해서 브라우저에서 읽어야 한다. 따라서 `Google Sheets → Supabase/Postgres → public reporting views → React dashboard` 구조는 맞다.

다만 현재 로컬 코드 기준으로는 **프론트가 요구하는 Supabase public view와 SQL 정의가 불일치**한다. 특히 Icebiscuit 탭은 view 3개가 SQL 정의에 없다.

## DB 주치의 기준 판단

### 실행 위치
- 대시보드: 브라우저/Vite React 앱
- 데이터 동기화: 로컬/서버 Python 스크립트
- DB: Supabase Postgres

### 사용자
- 내부 조회/보고용 대시보드 성격
- 외부 불특정 다수용 서비스보다는 내부 KPI 리포팅에 가까움

### 로그인/권한
- 브라우저는 publishable/anon key로 public reporting view만 조회해야 함
- service role / DB URL은 브라우저에 노출되면 안 됨
- 현재 `.env.local`에는 `VITE_SUPABASE_ANON_KEY`만 사용되고, service role은 root `.env`에 있음. 방향은 맞다.

### 데이터 성격
- 공용 데이터: 월간 KPI, 광고성과, 일별 지표, 캠페인/소재 집계
- 개인별 데이터 분리 필요성 낮음
- 데이터 입력/정정은 Google Sheets/META API/동기화 스크립트 쪽에서 발생

### 저장소 선택
**추천: Supabase/Postgres 유지.**

이유:
- 월간/일별/캠페인/소재 단위 집계 view가 필요함
- 브라우저에서 직접 조회 가능한 read-only public view 계층을 만들기 좋음
- Google Sheets만으로는 KPI view 계약, 권한, 정규화, 브랜드 확장에 한계가 있음
- DuckDB는 분석/검증엔 좋지만 운영 조회 DB로는 부적합
- SQLite는 단일 로컬 앱에는 좋지만 브라우저 대시보드 공유/운영에는 약함

피해야 할 선택:
- 브라우저에서 Google Sheets를 직접 읽어 대시보드 운영
- service role key를 Vite env로 노출
- raw table을 anon에 직접 열어두기
- public view 계약 없이 프론트에서 raw schema를 직접 의존

## 현재 구조

### Thekary Point 흐름
```text
Google Sheets Dashboard-main
→ 031.data/sync_google_sheets_to_supabase.py
→ schema thekary_point
→ public.dashboard_* views
→ 032.dashboard React app
```

주요 base table:
- `thekary_point.raw_member_daily`
- `thekary_point.raw_event_monthly_detail`
- `thekary_point.raw_ad_monthly_detail`
- `thekary_point.monthly_member_summary`
- `thekary_point.monthly_ad_summary`
- `thekary_point.monthly_event_current`
- `thekary_point.daily_activity_metrics`
- `thekary_point.monthly_activity_metrics`

### Icebiscuit META 흐름
```text
META Marketing API
→ icebiscuit_meta.raw_campaign_insights_daily
→ icebiscuit_meta.raw_ad_insights_daily
→ icebiscuit_meta.v_* views
→ public.dashboard_icebiscuit_* views
→ 032.dashboard React app
```

## 프론트엔드 Supabase 조회 계약

### Thekary Point
`032.dashboard/src/brands/thekarypoint/ThekaryPointDashboard.tsx`

프론트가 읽는 view:
- `dashboard_monthly_overview`
- `dashboard_promotion_breakdown`
- `dashboard_ad_campaign_breakdown`
- `dashboard_member_daily`
- `dashboard_activity_daily`

로컬 SQL 정의:
- `032.dashboard/dashboard_public_views.sql`

상태: **일치**

### Icebiscuit
`032.dashboard/src/brands/icebiscuit/IcebiscuitDashboard.tsx`

프론트가 읽는 view:
- `dashboard_icebiscuit_monthly_overview`
- `dashboard_icebiscuit_ad_campaign_breakdown`
- `dashboard_icebiscuit_daily_breakdown`
- `dashboard_icebiscuit_ad_creative_breakdown`
- `dashboard_icebiscuit_daily_creative_breakdown`

로컬 SQL `032.dashboard/dashboard_public_views_icebiscuit.sql`에 정의된 view:
- `dashboard_icebiscuit_monthly_overview`
- `dashboard_icebiscuit_ad_campaign_breakdown`

누락:
- `dashboard_icebiscuit_daily_breakdown`
- `dashboard_icebiscuit_ad_creative_breakdown`
- `dashboard_icebiscuit_daily_creative_breakdown`

상태: **불일치 / 장애 가능성 높음**

영향:
- Icebiscuit fetch가 `Promise.all` 구조라 view 하나라도 없거나 권한이 없으면 전체 로딩이 실패한다.
- 로컬 빌드는 통과해도 런타임에서 Supabase/PostgREST 오류가 날 수 있다.

## Supabase 연결 상태

현재 env target:
- `SUPABASE_PROJECT_REF=upqplmnxmcibknwwawll`
- `SUPABASE_URL=https://upqplmnxmcibknwwawll.supabase.co`
- `VITE_SUPABASE_URL=https://upqplmnxmcibknwwawll.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY`: set
- `SUPABASE_SERVICE_ROLE_KEY`: set
- `DATABASE_URL`: set
- `VITE_SUPABASE_ANON_KEY`: set

### Read-only live check 결과
- `google.com`, `supabase.co` DNS는 됨
- `upqplmnxmcibknwwawll.supabase.co` DNS는 현재 실행환경에서 해석 실패
- DB pooler 접속은 host까지 도달했지만 Supabase가 아래 오류 반환

```text
FATAL: (ENOTFOUND) tenant/user postgres.upqplmnxmcibknwwawll not found
```

판단:
- 단순 인터넷 장애는 아님
- 프로젝트 ref가 바뀌었거나, 프로젝트가 pause/deleted/migrated 상태이거나, pooler connection string이 오래됐을 가능성이 큼
- live DB의 실제 view 존재/권한/row count는 현재 검증 불가

## 테스트/빌드

실행 위치:
- `10.work/03.KPdash/032.dashboard`

결과:
- `npm test`: 3 files / 21 tests passed
- `npm run build`: 성공

의미:
- 현재 TypeScript/build 레벨은 통과
- 그러나 Supabase runtime contract 불일치는 빌드에서 잡히지 않음

## 처방

### 1. Supabase 프로젝트 target 먼저 확인
Supabase Dashboard에서 확인:
- `upqplmnxmcibknwwawll` 프로젝트가 살아있는지
- API URL이 여전히 `https://upqplmnxmcibknwwawll.supabase.co`인지
- Database connection string의 pooler user/host가 현재 `.env`와 같은지
- publishable/anon key가 `.env.local`과 같은 프로젝트의 키인지

이게 안 맞으면 `.env`/`.env.local`부터 갱신해야 한다.

### 2. 라이브 DB public view 확인
SQL editor에서 읽기 전용으로 확인:

```sql
select table_schema, table_name, table_type
from information_schema.tables
where table_schema = 'public'
  and table_name like 'dashboard%'
order by table_name;
```

특히 아래 3개가 있는지 확인:
- `dashboard_icebiscuit_daily_breakdown`
- `dashboard_icebiscuit_ad_creative_breakdown`
- `dashboard_icebiscuit_daily_creative_breakdown`

### 3. 누락 view 추가
라이브 DB에도 누락되어 있으면 `032.dashboard/dashboard_public_views_icebiscuit.sql`에 3개 public view와 grant를 추가해야 한다.

권장 추가 SQL 초안:

```sql
create or replace view public.dashboard_icebiscuit_daily_breakdown as
select
  report_date,
  account_id,
  account_name,
  campaign_name,
  sum(impressions) as impressions,
  sum(clicks) as clicks,
  case when sum(impressions) > 0 then sum(clicks)::numeric / sum(impressions) else null end as ctr,
  sum(spend) as ad_spend,
  sum(purchase_count) as purchase_count,
  sum(purchase_value) as purchase_value,
  case when sum(clicks) > 0 then sum(purchase_count)::numeric / sum(clicks) else null end as purchase_rate,
  case when sum(spend) > 0 then sum(purchase_value) / sum(spend) else null end as roas
from icebiscuit_meta.raw_campaign_insights_daily
group by 1,2,3,4;

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

grant select on public.dashboard_icebiscuit_daily_breakdown to anon, authenticated;
grant select on public.dashboard_icebiscuit_ad_creative_breakdown to anon, authenticated;
grant select on public.dashboard_icebiscuit_daily_creative_breakdown to anon, authenticated;
```

주의:
- 실제 적용 전 live DB에 `icebiscuit_meta.v_monthly_ad_creative_breakdown`, `icebiscuit_meta.v_daily_ad_creative_breakdown`, `icebiscuit_meta.raw_campaign_insights_daily`가 존재하는지 먼저 확인해야 한다.
- DDL 적용은 사용자 승인 후 진행.

### 4. 프론트 로딩 안정화
현재 Icebiscuit fetch는 `Promise.all`이라 하나 실패하면 전체 탭이 죽는다.

권장 변경:
- 필수: `monthly_overview`, `ad_campaign_breakdown`
- 선택/부분 실패 허용: `daily_breakdown`, `ad_creative_breakdown`, `daily_creative_breakdown`
- `Promise.allSettled`로 바꾸고 실패 view 이름을 화면에 표시

이렇게 하면 SQL/view 일부 누락이나 권한 오류가 있어도 최소 KPI는 표시할 수 있다.

## 현재 repo dirty 상태

```text
?? 034.docs/2026-05-14_db-doctor_supabase-dashboard.md
?? README.md
```

- `034.docs/2026-05-14_db-doctor_supabase-dashboard.md`: 이번 DB 주치의 산출물
- `README.md`: 이전 작업에서 생긴 untracked 문서

## 최종 판단
Supabase 연결 방향 자체는 맞다. 문제는 **연결 대상의 생존/키 최신성 확인 전에는 live DB 건강을 확정할 수 없고, 로컬 SQL 기준으로 Icebiscuit view 계약이 깨져 있다는 점**이다.

다음 액션은 두 개 중 하나다.
1. Supabase 프로젝트 ref/connection string부터 최신값으로 맞춘다.
2. 그 다음 누락 view 3개를 live DB와 SQL 파일 양쪽에 반영한다.
