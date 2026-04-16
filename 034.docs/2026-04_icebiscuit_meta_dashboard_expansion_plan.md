# THEKARY DASHBOARD 확장 계획

> 목적: 기존 THEKARY POINT DASHBOARD를 유지한 채 브랜드 탭 구조를 도입하고, 1차로 Icebiscuit META 광고 API 연결 기반을 추가해 THEKARY DASHBOARD로 확장한다.

## 1. 현재 상태 진단

### 확인된 현재 구조
- 데이터 적재 스크립트: `/10.work/03.KPdash/031.data/sync_google_sheets_to_supabase.py`
- 기존 스키마: `/10.work/03.KPdash/031.data/thekary_point_supabase_schema.sql`
- 공개 조회 view: `/10.work/03.KPdash/032.dashboard/dashboard_public_views.sql`
- 프론트 메인: `/10.work/03.KPdash/032.dashboard/src/App.tsx`
- 스타일: `/10.work/03.KPdash/032.dashboard/src/App.css`
- PPT export: `/10.work/03.KPdash/032.dashboard/src/pptEditableReport.ts`

### 현재 리스크
1. 현재 프론트가 `src/App.tsx` 단일 파일에 강하게 결합돼 있음
   - 인증
   - Supabase fetch
   - KPI 계산
   - Thekary Point 전용 UI
   - 리포트 export
   가 한 파일에 몰려 있어 바로 Icebiscuit 로직을 섞으면 기존 화면이 깨질 가능성이 높음

2. 현재 public view 이름이 모두 공용처럼 보이지만 실제로는 `thekary_point` 스키마 전용임
   - `public.dashboard_monthly_overview`
   - `public.dashboard_promotion_breakdown`
   - `public.dashboard_ad_campaign_breakdown`
   - `public.dashboard_member_daily`
   - `public.dashboard_activity_daily`

3. 현재 적재 파이프라인은 Google Sheets 중심이며 META API 직접 수집 경로가 없음

4. 현재 작업 트리에 미커밋 변경이 이미 존재함
   - `031.data/sync_google_sheets_to_supabase.py`
   - `032.dashboard/src/pptEditableReport.ts`
   - 기타 sheet template 변경
   따라서 Icebiscuit 작업은 기존 변경분을 덮어쓰지 않는 방식으로 분리해야 함

## 2. 이번 확장의 핵심 원칙

### 원칙 A. Thekary Point는 먼저 고정한다
- 기존 Thekary Point 화면의 데이터 fetch 경로와 SQL view 이름은 1차 작업에서 바꾸지 않는다.
- `public.dashboard_*`는 기존 Thekary Point 전용 계약으로 간주한다.
- Icebiscuit 때문에 Thekary Point query, KPI 계산, export 로직이 바뀌면 안 된다.

### 원칙 B. Icebiscuit는 별도 경로로 추가한다
- DB 스키마 또는 최소한 view 이름을 분리한다.
- fetch 함수도 분리한다.
- UI 컴포넌트도 브랜드별로 나눈다.

### 원칙 C. 먼저 탭 셸, 다음 데이터 파이프라인, 마지막 실제 화면
- 1단계: 브랜드 탭 구조 만들기
- 2단계: Icebiscuit META API 적재 경로 만들기
- 3단계: Icebiscuit 탭에 광고 대시보드 붙이기

### 원칙 D. 기존 연결 관계를 깨지 않도록 “추가” 방식으로 간다
- 기존 SQL/view 수정은 최소화
- 기존 App 로직은 먼저 추출하고, 그 다음 새 탭을 붙임
- 기존 export는 Thekary Point 탭에서만 유지하고 Icebiscuit는 별도 범위로 시작

## 3. 추천 아키텍처

## 3-1. 프론트 구조
현재:
- `src/App.tsx` 단일 진입점

목표:
- `src/App.tsx` = 탭/공통 셸만 담당
- `src/brands/thekarypoint/*` = 기존 화면 보존
- `src/brands/icebiscuit/*` = 신규 화면
- `src/lib/supabase.ts` = Supabase client 공통화
- `src/types/dashboard.ts` = 공통 타입 또는 브랜드별 타입 분리

추천 파일 구조:
- `/10.work/03.KPdash/032.dashboard/src/App.tsx`
- `/10.work/03.KPdash/032.dashboard/src/lib/supabase.ts`
- `/10.work/03.KPdash/032.dashboard/src/brands/thekarypoint/ThekaryPointDashboard.tsx`
- `/10.work/03.KPdash/032.dashboard/src/brands/thekarypoint/fetchThekaryPointDashboard.ts`
- `/10.work/03.KPdash/032.dashboard/src/brands/icebiscuit/IcebiscuitDashboard.tsx`
- `/10.work/03.KPdash/032.dashboard/src/brands/icebiscuit/fetchIcebiscuitDashboard.ts`
- `/10.work/03.KPdash/032.dashboard/src/brands/icebiscuit/types.ts`

## 3-2. 데이터 구조
Thekary Point:
- 기존 `thekary_point` 유지
- 기존 `public.dashboard_*` 유지

Icebiscuit:
- 신규 스키마 권장: `icebiscuit_meta`
- 최소 범위는 META 광고 데이터부터 시작
- 이후 필요 시 회원/매출/CRM 탭 확장

추천 DB 객체:
- raw table
  - `icebiscuit_meta.meta_daily_campaign_insights_raw`
  - `icebiscuit_meta.meta_daily_adset_insights_raw` 또는 생략 가능
  - `icebiscuit_meta.meta_daily_ad_insights_raw` 또는 생략 가능
- summary/view
  - `icebiscuit_meta.monthly_ad_summary`
  - `icebiscuit_meta.monthly_campaign_breakdown`
- public view
  - `public.dashboard_icebiscuit_monthly_overview`
  - `public.dashboard_icebiscuit_ad_campaign_breakdown`

중요:
- 기존 `public.dashboard_ad_campaign_breakdown`는 절대 Icebiscuit 데이터와 합치지 않는다.
- 1차 목표는 “브랜드별 별도 public view”다.

## 3-3. META API 연결 방식
권장 방식:
- Python 수집 스크립트 추가
- env에 Meta Marketing API 자격증명 저장
- 일별 raw 적재 후 월집계 view로 노출

추천 신규 파일:
- `/10.work/03.KPdash/031.data/icebiscuit_meta_schema.sql`
- `/10.work/03.KPdash/031.data/fetch_icebiscuit_meta_ads.py`
- `/10.work/03.KPdash/031.data/tests/test_fetch_icebiscuit_meta_ads.py`
- `/10.work/03.KPdash/032.dashboard/dashboard_public_views_icebiscuit.sql`

추천 env key:
- `META_APP_ID`
- `META_APP_SECRET`
- `META_ACCESS_TOKEN`
- `META_ICEBISCUIT_AD_ACCOUNT_ID`
- 선택: `META_API_VERSION=v23.0`

## 4. 구현 단계 계획

### Phase 0. 안전장치 먼저
목표: 기존 대시보드를 건드려도 복구 가능한 상태 확보

작업
1. 현재 Thekary Point 기준 스냅샷 확보
   - 주요 화면 스크린샷 저장
   - 현재 `npm run build` 통과 여부 확인
2. 기존 public view / schema / App.tsx 의존관계 문서화
3. 현재 미커밋 변경과 Icebiscuit 작업 범위를 분리
   - 가능하면 별도 브랜치 사용
   - 최소한 신규 파일 중심으로 작업 시작

검증
- `/10.work/03.KPdash/032.dashboard`에서 `npm run build`
- 기존 대시보드 월 선택, 표, META 캠페인 성과, 리포트 생성 동작 확인

### Phase 1. 탭 셸 분리
목표: Thekary Point를 그대로 살린 채 상단에 브랜드 탭 추가

작업
1. `App.tsx`에서 기존 Thekary Point 화면을 `ThekaryPointDashboard.tsx`로 추출
2. 공통 인증/레이아웃만 `App.tsx`에 남김
3. 탭 상태 추가
   - `thekarypoint`
   - `icebiscuit`
4. 초기 Icebiscuit 탭은 “데이터 연결 준비 중” placeholder로 시작
5. 기존 export/PPT 로직은 Thekary Point 컴포넌트 안에 유지

주의
- 1차에서는 Thekary Point fetch 함수의 SQL view 이름을 바꾸지 않는다.
- 기존 CSS class를 최대한 유지해서 레이아웃 회귀를 줄인다.

검증
- 탭 전환 시 Thekary Point 화면이 이전과 동일해야 함
- Icebiscuit 탭 진입 시 기존 데이터 fetch에 영향을 주지 않아야 함
- `npm run build`

### Phase 2. Icebiscuit META API 수집 파이프라인 구축
목표: Google Sheets와 무관한 Icebiscuit 전용 광고 데이터 수집 경로 생성

작업
1. 신규 SQL 파일 생성
   - `icebiscuit_meta_schema.sql`
2. raw 테이블 설계
   권장 컬럼
   - `date_start`
   - `date_stop`
   - `account_id`
   - `account_name`
   - `campaign_id`
   - `campaign_name`
   - `adset_id`
   - `adset_name`
   - `ad_id`
   - `ad_name`
   - `impressions`
   - `clicks`
   - `spend`
   - `ctr`
   - `cpc`
   - `reach`
   - `purchase_value`
   - `purchase_count`
   - `link_clicks`
   - `landing_page_views`
   - `raw_payload`
   - `synced_at`
3. Python 수집 스크립트 생성
   - 기간 파라미터 입력 가능
   - 일별 또는 캠페인별 insights 호출
   - pagination 처리
   - raw payload 보관
4. 월집계 view 생성
   - 월별 총 광고비
   - 월별 노출/클릭/CTR
   - 월별 구매/구매금액/ROAS
   - 캠페인별 breakdown
5. public view 추가
   - `dashboard_icebiscuit_monthly_overview`
   - `dashboard_icebiscuit_ad_campaign_breakdown`

권장 API 범위
- 첫 버전은 `campaign` 레벨 insights로 시작
- breakdown을 너무 세게 잡지 말고 먼저 월별 운영 dashboard가 가능한 최소 필드만 수집

주의
- 기존 `sync_google_sheets_to_supabase.py`에 Icebiscuit META 로직을 바로 섞지 않는다.
- 별도 스크립트로 시작한 뒤 필요하면 나중에 orchestrator만 합친다.

검증
- dry-run 또는 API fetch 결과 row 수 출력
- 특정 월에 대해 raw row 존재 확인
- monthly summary/view 집계값과 Meta Ads Manager export 샘플 수동 대조

### Phase 3. Icebiscuit 탭용 최소 대시보드 구현
목표: Icebiscuit 탭에 광고 중심 대시보드 우선 오픈

작업
1. `fetchIcebiscuitDashboard.ts` 작성
2. 조회 대상은 신규 public view만 사용
3. 첫 화면 범위는 광고 KPI 중심으로 제한
   - 광고비
   - 노출수
   - 클릭수
   - CTR
   - 구매건수 또는 전환수
   - 광고 기여매출 또는 구매금액
   - ROAS
4. 테이블 2개 우선
   - 최근 6개월 요약
   - 월별 캠페인 breakdown
5. 빈 데이터 상태 UI 추가
   - API 미연결
   - 해당 월 데이터 없음
   - 권한/토큰 오류

주의
- Icebiscuit 탭에서 Thekary Point export 버튼 로직을 재사용하지 않는다.
- 1차에는 “광고 대시보드”로 한정하고 CRM/멤버십 지표는 보류 가능

검증
- 탭 전환 후 각 탭의 기준월 상태가 서로 꼬이지 않는지 확인
- Thekary Point 탭의 KPI/표 수치가 이전과 동일한지 확인
- `npm run build`

### Phase 4. 운영 연결
목표: Icebiscuit META 데이터를 반복 반영 가능한 운영 플로우로 정리

작업
1. 수동 실행 명령 확정
2. 월별 백필 명령 정리
3. cron 연결 여부 결정
4. 문서화
   - 환경변수
   - 수집 범위
   - 장애 대응
   - 재동기화 절차

검증
- 한 달 재수집 시 중복 적재/중복 집계가 없는지 확인
- API token 만료 시 에러 메시지 명확성 확인

## 5. 파일별 변경 우선순위

### 먼저 수정할 파일
- `/10.work/03.KPdash/032.dashboard/src/App.tsx`
  - 탭 셸 분리만
- `/10.work/03.KPdash/032.dashboard/src/App.css`
  - 탭 UI 스타일 추가만

### 새로 만드는 것이 좋은 파일
- `/10.work/03.KPdash/032.dashboard/src/brands/thekarypoint/ThekaryPointDashboard.tsx`
- `/10.work/03.KPdash/032.dashboard/src/brands/thekarypoint/fetchThekaryPointDashboard.ts`
- `/10.work/03.KPdash/032.dashboard/src/brands/icebiscuit/IcebiscuitDashboard.tsx`
- `/10.work/03.KPdash/032.dashboard/src/brands/icebiscuit/fetchIcebiscuitDashboard.ts`
- `/10.work/03.KPdash/031.data/icebiscuit_meta_schema.sql`
- `/10.work/03.KPdash/031.data/fetch_icebiscuit_meta_ads.py`
- `/10.work/03.KPdash/032.dashboard/dashboard_public_views_icebiscuit.sql`
- `/10.work/03.KPdash/034.docs/icebiscuit_meta_runbook.md`

### 마지막에 건드릴 파일
- `/10.work/03.KPdash/032.dashboard/src/pptEditableReport.ts`
  - Icebiscuit export 요구가 확정되기 전까지 보류
- `/10.work/03.KPdash/031.data/sync_google_sheets_to_supabase.py`
  - Icebiscuit API를 여기에 바로 합치지 않음

## 6. 데이터/화면 분리 기준

### 절대 공유하면 안 되는 것
- Thekary Point용 public view 이름
- Thekary Point KPI 계산식
- Thekary Point report/export 레이아웃
- Thekary Point source sheet 링크

### 공유해도 되는 것
- Supabase client 초기화
- 인증 셸
- 탭 UI 컴포넌트
- 숫자/통화 formatter 유틸
- 공통 테이블 스타일

## 7. 검증 체크리스트

### 프론트 회귀 체크
- Thekary Point 탭 첫 진입 성공
- 기준월 셀렉터 정상 동작
- 최근 6개월 표 정상
- 포인트현황 토글 정상
- META 캠페인 성과 표 정상
- PDF/PPT 생성 기존과 동일

### Icebiscuit 신규 체크
- 탭 진입 성공
- Meta API fetch 성공
- 월별 overview 수치 노출
- 캠페인 breakdown 노출
- 데이터 없음 상태 처리

### 빌드 체크
- `/10.work/03.KPdash/032.dashboard`에서 `npm run build`

## 8. 추천 실행 순서
1. Thekary Point 화면을 컴포넌트로 먼저 추출
2. 탭 셸 추가
3. Icebiscuit placeholder 탭 추가
4. Meta API raw 적재 스키마 작성
5. Meta API fetch 스크립트 작성
6. monthly summary/public view 작성
7. Icebiscuit fetch 함수 작성
8. Icebiscuit 탭 UI 연결
9. 회귀 QA
10. 필요 시 cron 연결

## 9. 이번 요청 기준 권장 범위
이번에는 아래까지만 1차 범위로 잡는 게 안전함
- 탭 구조 설계
- Thekary Point 보호용 컴포넌트 분리
- Icebiscuit META API 적재 설계
- Icebiscuit 광고 대시보드 최소 범위 설계

즉, “THEKARY DASHBOARD 전환”의 1차 목표는
- 브랜드 탭 기반
- Thekary Point 무손상 유지
- Icebiscuit는 META 광고 데이터만 먼저 연결
으로 두는 것이 가장 안전함.

## 10. 결론
가장 중요한 포인트는 “기존 공용 이름처럼 보이는 Thekary Point 전용 계약을 먼저 분리해서 보호하는 것”이다.

따라서 실제 구현은 아래 순서가 맞다.
- 먼저 프론트에서 브랜드 탭 셸을 만들고 기존 Thekary Point를 독립 컴포넌트로 분리
- 그 다음 Icebiscuit META API 전용 DB/view 파이프라인을 추가
- 마지막으로 Icebiscuit 탭에 광고 대시보드를 연결

이 순서로 가면 Icebiscuit 작업 중에도 Thekary Point 페이지와 기존 연결 구조를 최대한 안전하게 유지할 수 있다.
