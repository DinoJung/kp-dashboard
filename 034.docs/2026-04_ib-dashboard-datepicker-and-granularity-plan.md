# IB Datepicker + META 조회단위 확장 계획

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** IB 대시보드에 기간 선택형 datepicker를 도입하고, META 성과 조회 단위를 `캠페인 / 캠페인>소재 / 소재 / daily`로 확장한다.

**Architecture:** 프론트는 월 선택 dropdown 대신 기간 상태(`startDate`, `endDate`, `preset`, `viewMode`)를 사용한다. 데이터 계층은 기존 `monthly_overview`/`campaign_breakdown` 외에 일별 raw 및 소재 단위 집계 view를 추가하고, 화면에서는 동일한 필터/정렬/포맷터를 공유한다.

**Tech Stack:** React, TypeScript, Supabase PostgREST, PostgreSQL views/tables, META raw pipeline

---

## 현재 확인된 기준
- 프론트 핵심 파일: `032.dashboard/src/brands/icebiscuit/IcebiscuitDashboard.tsx`
- 현재 조회 소스:
  - `public.dashboard_icebiscuit_monthly_overview`
  - `public.dashboard_icebiscuit_ad_campaign_breakdown`
- 현재 상태는 `selectedMonth` 단일 값 기반 월 선택 UI
- 2026 META raw는 `icebiscuit_meta.raw_campaign_insights_daily`에 `일자별 × 캠페인별`로 저장됨
- ad level API는 실제로 `level=ad`에서 `ad_id`, `ad_name`까지 조회 가능 확인 완료
- 용어 규칙: `adname`은 UI/문서에서 **소재**라고 표기

---

## 구현 목표 세부 정의

### 1. 날짜 선택 UI
상단 월 selector를 아래 구조로 교체한다.
- 시작일 datepicker
- 종료일 datepicker
- 간편선택 버튼군
  - 이번주
  - 지난주
  - 이번달
  - 지난달
  - 작년 이번달
  - 작년 저번달

동작 원칙
- 간편선택 클릭 시 시작일/종료일이 즉시 세팅된다.
- 수동으로 시작일/종료일을 바꾸면 preset active 상태는 해제한다.
- 시작일 > 종료일이면 자동 교정하거나 적용 방지한다.
- 기본값은 `이번달` 대신 **데이터 최종일이 속한 월 전체**가 안전한 기본값.

### 2. 조회 단위
META 성과 표에 조회 방식 selector 추가
- `캠페인 단위`
- `소재 단위`
- `일자 단위`

캠페인 단위의 확장행
- 기본은 현재처럼 캠페인 그룹행 표시
- 토글 확장 시 해당 캠페인 그룹 아래에 `소재` 행 노출
- 표시는 트리 구조 또는 parent/child row 구조

### 3. 그룹 체계
모든 조회 단위에서 상위 그룹 분류는 동일하게 유지
- ASC
- 리타겟팅
- 전환(패션관심)
- 참여 캠페인 / 게시물참여

소재 단위 / daily 단위에서도 가능한 한 `campaign_group`을 함께 보존한다.

---

## 데이터 계층 설계

### A. 기존 유지
- `icebiscuit_meta.raw_campaign_insights_daily`
- `icebiscuit_meta.v_monthly_campaign_breakdown`
- `public.dashboard_icebiscuit_monthly_overview`
- `public.dashboard_icebiscuit_ad_campaign_breakdown`

### B. 신규 raw 테이블
생성 권장:
- `icebiscuit_meta.raw_ad_insights_daily`

권장 컬럼
- `id`
- `import_batch_id`
- `report_date`
- `account_id`
- `account_name`
- `campaign_id`
- `campaign_name`
- `adset_id`
- `adset_name`
- `ad_id`
- `ad_name`
- `objective`
- `buying_type`
- `impressions`
- `reach`
- `clicks`
- `inline_link_clicks`
- `landing_page_views`
- `spend`
- `cpc`
- `ctr`
- `purchase_count`
- `purchase_value`
- `conversions`
- `conversion_value`
- `raw_actions`
- `raw_action_values`
- `raw_payload`
- `synced_at`

unique key 권장
- `(report_date, account_id, ad_id)`

### C. 신규 view
#### 1) ad daily grouped view
- `icebiscuit_meta.v_ad_insights_daily_grouped`
- grain: `report_date × campaign_group × ad_id/ad_name`

#### 2) ad monthly grouped view
- `icebiscuit_meta.v_monthly_ad_breakdown`
- grain: `report_month × campaign_group × ad_id/ad_name`

#### 3) daily campaign-group view
- `icebiscuit_meta.v_daily_campaign_group_breakdown`
- grain: `report_date × campaign_group`

#### 4) public views
필요 시 아래 추가
- `public.dashboard_icebiscuit_ad_breakdown`
- `public.dashboard_icebiscuit_daily_breakdown`

### D. campaign_group 분류 함수/CASE 통일
DB view 내부에 동일 CASE 문을 재사용한다.
우선순위:
1. `%리타겟팅%` → `리타겟팅`
2. `%성인라인업%` or `%전환 캠페인%` → `전환(패션관심)`
3. `%트래픽%` or `%게시물 참여%` or objective in (`OUTCOME_ENGAGEMENT`, `LINK_CLICKS`) → `참여 캠페인 / 게시물참여`
4. `%어드밴티지+ 쇼핑%` or `ASC%` or `%전체 라인업%` → `ASC`
5. else raw name

---

## 프론트 구조 변경 계획

### Task 1: 기간 상태 모델 추가
**Files:**
- Modify: `032.dashboard/src/brands/icebiscuit/IcebiscuitDashboard.tsx`

추가 상태
- `startDate`
- `endDate`
- `activePreset`
- `viewMode` = `'campaign' | 'creative' | 'daily'`
- `expandedCampaignKeys` for 캠페인 확장

### Task 2: date utility 추가
**Files:**
- Create: `032.dashboard/src/brands/icebiscuit/datePresets.ts`

포함 함수
- `getThisWeekRange(today)`
- `getLastWeekRange(today)`
- `getThisMonthRange(today)`
- `getLastMonthRange(today)`
- `getSameMonthLastYear(today)`
- `getPreviousMonthLastYear(today)`
- `clampRange(start, end)`

### Task 3: topbar UI 교체
**Files:**
- Modify: `032.dashboard/src/brands/icebiscuit/IcebiscuitDashboard.tsx`
- Modify: `032.dashboard/src/App.css`

월 selector 제거 후 추가
- 시작일 input[type="date"]
- 종료일 input[type="date"]
- preset chip/button row
- 조회 단위 segmented control

### Task 4: fetch 로직 확장
**Files:**
- Modify: `032.dashboard/src/brands/icebiscuit/IcebiscuitDashboard.tsx`

기존 월단위 fetch 외에 아래 결과를 받을 수 있게 확장
- overview monthly
- campaign grouped breakdown
- ad breakdown
- daily breakdown

단기적으로는 한 컴포넌트에서 병렬 fetch 가능. 이후 파일 분리 가능.

### Task 5: filtered dataset selector 작성
**Files:**
- Modify: `032.dashboard/src/brands/icebiscuit/IcebiscuitDashboard.tsx`

필터 규칙
- campaign mode: 선택 기간에 포함되는 row 집계
- creative mode: 선택 기간 소재 row 집계
- daily mode: 선택 기간 일자 row 집계

월 view가 아닌 기간 합계로 바뀌므로 KPI 카드도 `기간 총합`으로 계산해야 한다.

### Task 6: 캠페인 모드 expandable row 구현
**Files:**
- Modify: `032.dashboard/src/brands/icebiscuit/IcebiscuitDashboard.tsx`
- Modify: `032.dashboard/src/App.css`

표 동작
- parent row = campaign_group
- expand 시 child rows = 해당 그룹의 소재(`ad_name`)
- child row label은 `소재`
- 정렬 기본값: ASC → 리타겟팅 → 전환(패션관심) → 참여 캠페인 / 게시물참여

### Task 7: 소재 단위 표 구현
**Files:**
- Modify: `032.dashboard/src/brands/icebiscuit/IcebiscuitDashboard.tsx`

열 예시
- 소재
- 상위 캠페인분류
- 노출
- 클릭
- CTR
- 광고비
- 구매
- 기여매출
- 구매율
- ROAS

### Task 8: daily 단위 표 구현
**Files:**
- Modify: `032.dashboard/src/brands/icebiscuit/IcebiscuitDashboard.tsx`

열 예시
- 일자
- 캠페인분류
- 노출
- 클릭
- CTR
- 광고비
- 구매
- 기여매출
- 구매율
- ROAS

### Task 9: 포맷/카피 정리
**Files:**
- Modify: `032.dashboard/src/brands/icebiscuit/IcebiscuitDashboard.tsx`

문구 규칙
- adname 대신 `소재`
- `매출`은 계속 `기여매출`로 표시
- 0 또는 0% 값은 `-`

### Task 10: 브라우저 QA + build
**Files:**
- Verify only

검증 시나리오
- preset 클릭 시 date input 동기화
- 수동 date 변경 시 preset 해제
- 캠페인/소재/daily 전환 정상
- 캠페인 확장 시 child row가 소재로 표시
- 2025 manual + 2026 auto 데이터 모두 정상
- `npm run build`

---

## 백엔드 구현 순서 제안
1. `raw_ad_insights_daily` 테이블 추가
2. `fetch_icebiscuit_meta_ads.py`를 ad-level 옵션 지원으로 확장
   - `--level campaign|ad`
3. 2026-01 ~ 최신일까지 ad-level dry-run
4. 실제 적재
5. monthly/daily ad views 생성
6. public view 추가
7. 프론트 연결

---

## 주의사항
- 기존 campaign raw 파이프라인은 유지해야 한다.
- manual 2025 workbook source-of-truth는 그대로 유지하고, 2026+ 자동분은 view에서 함께 보여준다.
- daily/date-range UI로 바뀌면 현재 `selectedMonth` 기반 delta 문구는 그대로 쓰면 어색할 수 있으니 `직전 동기간 비교` 또는 helper 제거를 검토한다.
- datepicker는 native input으로 먼저 구현하는 것이 안전하다. 외부 datepicker 라이브러리는 지금 단계에 YAGNI.

---

## 권장 구현 전략
1. **1차:** UI만 기간선택 + 캠페인/일별 전환 구현, 소재 확장은 더미 없음 상태로 연결
2. **2차:** ad-level raw 적재 및 소재 테이블 연결
3. **3차:** 캠페인 확장행과 소재 전용 모드 polish

이렇게 가면 리스크가 낮고 중간 QA도 쉬움.
