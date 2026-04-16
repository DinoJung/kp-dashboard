# Icebiscuit META 연결 및 확인 가이드

## 1. 브랜치 작업 중 화면 확인 방법
현재 Vercel production이 `main`을 바라보고 있으므로, 브랜치 작업 확인은 아래 순서가 가장 안전하다.

### 기본 확인 경로: 로컬 Vite 실행
```bash
cd /10.work/03.KPdash/032.dashboard
export PATH="/home/j1nu/.nvm/versions/node/v24.14.1/bin:$PATH"
npm run dev -- --host 0.0.0.0 --port 3010
```

확인 포인트
- `Thekary Point` 탭이 기존처럼 동작하는지
- `Icebiscuit` 탭 placeholder가 분리되어 보이는지
- 기준월 selector / 표 / export 버튼이 Thekary Point 탭에서 그대로 유지되는지

### 브랜치 preview가 필요할 때
1. GitHub 브랜치 또는 PR을 Vercel preview 대상으로 연결
2. Vercel 프로젝트가 Git integration preview를 켜고 있으면 브랜치 push 또는 PR 생성 시 preview URL이 생성됨
3. production은 계속 main 유지

실무적으로는
- 브랜치 작업 중: 로컬 Vite로 확인
- 공유/검수 필요: PR preview URL 사용
이 가장 안전함

## 2. 신규 파일
- 스키마: `/10.work/03.KPdash/031.data/icebiscuit_meta_schema.sql`
- 수집 스크립트: `/10.work/03.KPdash/031.data/fetch_icebiscuit_meta_ads.py`
- public view: `/10.work/03.KPdash/032.dashboard/dashboard_public_views_icebiscuit.sql`

## 3. 필요한 환경변수
`/10.work/03.KPdash/.env`에 아래 키 필요

```env
DATABASE_URL=postgresql://...
META_ACCESS_TOKEN=...
META_ICEBISCUIT_AD_ACCOUNT_ID=act_123456789012345
META_API_VERSION=v23.0
```

선택값
- `META_APP_ID`
- `META_APP_SECRET`

현재 스크립트는 직접 호출용 access token 기준으로 동작한다.

## 4. DB 반영 순서
### 4-1. 스키마 적용
Supabase SQL Editor 또는 psql에서 아래 순서로 실행
1. `031.data/icebiscuit_meta_schema.sql`
2. `032.dashboard/dashboard_public_views_icebiscuit.sql`

### 4-2. dry-run
```bash
cd /10.work/03.KPdash
.venv/bin/python 031.data/fetch_icebiscuit_meta_ads.py --dry-run --since 2026-04-01 --until 2026-04-30
```

확인 포인트
- `RAW_ROWS`
- 월별 spend / impressions / clicks / purchase_value / roas 출력

### 4-3. 실제 적재
```bash
cd /10.work/03.KPdash
.venv/bin/python 031.data/fetch_icebiscuit_meta_ads.py --since 2026-04-01 --until 2026-04-30
```

## 5. 현재 적재 범위
현재 스크립트는 campaign level daily insights를 적재한다.

저장 컬럼 핵심
- report_date
- campaign_id / campaign_name
- impressions / reach / clicks
- inline_link_clicks
- landing_page_views
- spend / cpc / ctr
- purchase_count / purchase_value
- conversions / conversion_value
- raw_actions / raw_action_values / raw_payload

## 6. public view 용도
### `public.dashboard_icebiscuit_monthly_overview`
월 단위 KPI 카드용
- 광고비
- 노출
- 클릭
- CTR
- 구매건수
- 구매금액
- ROAS

### `public.dashboard_icebiscuit_ad_campaign_breakdown`
월별 캠페인 breakdown 표용
- campaign_name
- objective
- impressions
- clicks
- ad_spend
- purchase_value
- roas

## 7. 다음 프론트 연결 순서
1. Icebiscuit 탭 fetch 함수 생성
2. overview view 연결
3. campaign breakdown table 연결
4. 빈 데이터 상태 / API 실패 상태 UI 추가
5. 필요 시 광고비, 구매금액, ROAS 카드 디자인 맞춤

## 8. 주의사항
- 기존 `public.dashboard_*`는 Thekary Point 전용 계약으로 유지
- Icebiscuit 데이터는 절대 기존 Thekary Point view와 혼합하지 않음
- 1차는 광고 대시보드만 연결하고 CRM/회원 지표는 보류
