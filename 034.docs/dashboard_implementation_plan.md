# Thekary Point Dashboard 구현 계획

> 목적: Google Sheets 원본 RAW 데이터를 정기 동기화해서 Supabase에 적재하고, 이미지 레퍼런스처럼 핵심 KPI를 한 화면에서 볼 수 있는 대시보드를 만든다.

## 1. 목표 화면

레퍼런스 이미지 기준으로 아래 영역을 우선 구현한다.

### 상단 KPI 카드
- 회원수
- 앱다운로드
- 포인트 연계매출
- 광고 기여매출
- 수신동의수
  - SMS 수신동의수
  - PUSH 수신동의수
  - 필요 시 이메일 수신동의수 확장 가능

### 본문 섹션
- 사용자 지표 월별 비교 테이블
- 포인트 프로모션 현황 테이블
- 포인트 사용/연계매출 추이 테이블
- META 광고 성과 테이블
- 결과 분석 / 개선안 메모 박스

### 필수 동작
- 기준월 선택
- 최근 6개월 보기
- 전월 대비 증감 자동 계산
- KPI 목표 대비 달성률 표시
- raw source 링크 또는 sheet 바로가기 제공

## 2. 추천 아키텍처

### 원본 계층
Google Sheets
- 운영자가 원본 RAW를 계속 수정
- member / event / ad / opt-in 시트를 분리
- 원본은 수정 가능 데이터 소스로 유지

### 수집 계층
Python sync script + Google Workspace API
- Google Sheets API로 시트 범위 읽기
- 현재 환경에서는 Google Workspace 인증이 아직 안 되어 있음
- 인증 완료 후 정기 동기화 가능

### 저장 계층
Supabase Postgres
- 이미 구축된 `thekary_point` 스키마 활용
- 기존 테이블 사용
  - `raw_member_daily`
  - `raw_event_monthly_detail`
  - `raw_ad_monthly_detail`
  - `monthly_member_summary`
  - `monthly_event_current`
  - `monthly_event_snapshot`
  - `monthly_ad_summary`
- 추가 예정
  - `raw_opt_in_daily`
  - `monthly_opt_in_summary`
  - `dashboard_targets`
  - `dashboard_notes`

### 서비스 계층
Supabase View / SQL
- 대시보드 전용 view 생성
- 카드용 view, 테이블용 view, 추이용 view 분리
- 프론트는 view만 읽도록 구성

### 표현 계층
추천 2안

1) MVP 빠른 구축: Streamlit
- 장점: Python 기반이라 현재 적재 스크립트와 연결이 쉬움
- 장점: 빠르게 내부용 대시보드 구축 가능
- 단점: 레퍼런스 이미지 수준의 정교한 레이아웃은 한계가 있음

2) 권장안: Next.js 또는 React + Supabase
- 장점: 레퍼런스 이미지처럼 카드형 레이아웃과 브랜딩 반영이 쉬움
- 장점: 향후 월별 페이지, 탭, 필터 확장에 유리
- 단점: 초기 구축 시간이 더 듦

현재 요구사항상 "이미지처럼 보이는 대시보드"가 중요하므로 권장안은 React 계열이다.

## 3. 현재 확인된 상태

### Supabase
- `thekary_point` 스키마 존재
- 전체 이력 적재 완료
- 검증 완료
- 2026-03 값 정상 조회 확인

### Google Workspace CLI
- 현재 인증 안 됨
- 확인 결과: `NOT_AUTHENTICATED: No token at /home/j1nu/.hermes/google_token.json`
- 즉, 스프레드시트 직접 조회를 위해서는 OAuth 설정이 먼저 필요함

## 4. 데이터 모델 보강안

### 4-1. 수신동의수 테이블 추가
```sql
create table if not exists thekary_point.raw_opt_in_daily (
  id bigint generated always as identity primary key,
  import_batch_id bigint references thekary_point.import_batches(id) on delete set null,
  report_date date not null,
  sms_opt_in_members integer,
  push_opt_in_members integer,
  email_opt_in_members integer,
  created_at timestamptz not null default now(),
  unique (report_date, import_batch_id)
);

create table if not exists thekary_point.monthly_opt_in_summary (
  report_month date primary key,
  sms_opt_in_members integer,
  push_opt_in_members integer,
  email_opt_in_members integer,
  source_import_batch_id bigint references thekary_point.import_batches(id) on delete set null,
  updated_at timestamptz not null default now()
);
```

### 4-2. KPI 목표값 관리 테이블
```sql
create table if not exists thekary_point.dashboard_targets (
  report_month date not null,
  metric_key text not null,
  target_value numeric(18,2) not null,
  note text,
  primary key (report_month, metric_key)
);
```

예시 metric_key
- member_count
- app_downloads
- linked_sales
- ad_attributed_sales
- sms_opt_in_members
- push_opt_in_members

### 4-3. 메모 관리 테이블
```sql
create table if not exists thekary_point.dashboard_notes (
  report_month date primary key,
  result_analysis text,
  improvement_plan text,
  updated_at timestamptz not null default now()
);
```

## 5. 대시보드용 view 설계

### 5-1. KPI 카드용 view
`thekary_point.v_dashboard_kpi_cards`
- report_month
- member_count
- member_target
- member_achievement_rate
- app_downloads
- app_downloads_target
- linked_sales_amount
- linked_sales_target
- ad_revenue
- ad_revenue_target
- sms_opt_in_members
- push_opt_in_members

### 5-2. 사용자 지표 비교용 view
`thekary_point.v_dashboard_user_metrics`
- report_month
- new_members
- app_downloads
- withdrawals
- net_growth
- active_members_eom
- 전월 대비 증감 컬럼

### 5-3. 포인트 추이용 view
`thekary_point.v_dashboard_points_trend`
- report_month
- total_points_issued
- points_used
- point_usage_rate
- linked_sales_amount
- 전월 대비 증감률

### 5-4. 광고 성과용 view
`thekary_point.v_dashboard_ad_performance`
- report_month
- media
- campaign_group
- impressions
- clicks
- ctr
- conversions
- revenue
- ad_spend_markup_vat_exclusive
- roas_markup_vat_exclusive

## 6. Google Sheets 연동 방식

### 필요한 전제
- Google OAuth client secret 필요
- `/home/j1nu/.hermes/google_client_secret.json`
- `/home/j1nu/.hermes/google_token.json`

### 연결 방식
1. 원본 스프레드시트 ID 저장
2. 시트별 range 정의
   - `raw_member!A:J`
   - `raw_event!A:J`
   - `raw_ad!A:T`
   - `raw_optin!A:E` 또는 실제 시트명에 맞춤
3. Google Workspace API로 읽기
4. 정규화 후 Supabase upsert
5. import_batches 기록

### 운영 방식
- 수동 실행: 새 월 데이터 업데이트 후 즉시 동기화
- 정기 실행: cron으로 매일 오전 9시 동기화 가능

## 7. 화면 설계 가이드

### 디자인 원칙
- 상단 검정 KPI 카드 + 강조 컬러 1개 사용
- 메인 배경은 밝은 회색
- 현재월 값은 노랑 강조
- 표는 최근 6개월 기준
- 분석 문구는 짧게 2~3줄
- 원본 시트 링크 버튼 제공

### 필수 컴포넌트
- Header
- 기준월 selector
- KPI card row
- 2열 grid section
- 월별 추이 table
- mini chart 또는 sparkline
- note panel

## 8. 구현 순서

### Phase 1. 데이터 계층 정리
1. Google Workspace OAuth 세팅
2. 원본 스프레드시트 구조 확인
3. opt-in 원본 시트 컬럼 확인
4. `raw_opt_in_daily`, `monthly_opt_in_summary` 생성
5. `dashboard_targets`, `dashboard_notes` 생성
6. Sheets -> Supabase sync script 작성

### Phase 2. 대시보드용 SQL 정리
1. KPI 카드 view 생성
2. 사용자 지표 view 생성
3. 포인트 추이 view 생성
4. 광고 성과 view 생성
5. 최근 6개월 필터 쿼리 검증

### Phase 3. 프론트 구현
권장: React/Next.js
1. dashboard layout 생성
2. KPI 카드 컴포넌트 생성
3. 월별 테이블 컴포넌트 생성
4. 분석/개선안 메모 섹션 생성
5. 원본 sheet 링크 버튼 추가
6. 반응형 조정

### Phase 4. 운영 자동화
1. 동기화 스크립트 배치
2. 월간 리포트용 export 버튼 추가
3. 장애 로그 기록
4. 백업 및 버전 관리

## 9. 바로 필요한 사용자 입력

### 필수
- 연결할 Google Spreadsheet 링크 또는 ID
- 어떤 시트가 원본인지
  - member
  - event
  - ad
  - 수신동의수
- 대시보드를 웹으로 볼지, 내부용 빠른 MVP로 볼지 선택

### 있으면 좋은 것
- KPI 목표값 기준표
- 원하는 기준월 기본값
- 브랜드 컬러 또는 템플릿
- 결과 분석 / 개선안 문구를 수동 입력할지 자동 초안할지

## 10. 추천 실행안

### 추천
- 1단계: Google Sheets 연동 + Supabase sync부터 고정
- 2단계: React 기반 대시보드 MVP 제작
- 3단계: 필요 시 PPT/HTML 리포트로 확장

### 이유
- 지금은 DB 적재 기반은 이미 있으므로, 원본 source를 Google Sheets로 바꾸고 자동 동기화만 붙이면 됨
- 이후 화면은 Supabase view를 읽기만 하면 돼서 유지보수가 쉬움

## 11. 다음 액션

가장 먼저 할 일
1. Google Workspace 인증 세팅
2. 원본 스프레드시트 ID 확인
3. 수신동의수 raw 구조 확인
4. 대시보드 구현 방식 선택
   - 빠른 내부용 MVP: Streamlit
   - 이미지 유사도 우선: React/Next.js
