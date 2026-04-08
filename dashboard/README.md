# Thekary Point Dashboard

React + TypeScript + Vite 기반 월간 성과 대시보드야.

현재 연결 상태
- 데이터 소스: Supabase `public.dashboard_*` views
- 원본 RAW: 추후 Google Sheets sync 연결 예정
- 현재 구현된 카드
  - 회원수
  - 앱다운로드
  - 포인트 연계매출
  - 광고 기여매출
  - MAU
  - DAU
  - 수신동의수(연동 대기 상태 표시)

## 실행

```bash
cd /home/j1nu/workspace/hermes/KP_monthly-report/dashboard
npm install
npm run dev
```

## 환경변수

`.env.local` 예시

```env
VITE_SUPABASE_URL=https://upqplmnxmcibknwwawll.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxx
VITE_SOURCE_SHEET_URL=https://docs.google.com/spreadsheets/d/.../edit#gid=0
```

- `VITE_SOURCE_SHEET_URL`은 선택값
- 넣으면 우측 상단에 원본 시트 열기 버튼이 표시됨

## Supabase 준비 상태

프론트에서 바로 읽을 수 있도록 아래 public views를 생성해둠.
- `public.dashboard_monthly_overview`
- `public.dashboard_promotion_breakdown`
- `public.dashboard_ad_campaign_breakdown`
- `public.dashboard_member_daily`

정의 파일
- `/home/j1nu/workspace/hermes/KP_monthly-report/dashboard/dashboard_public_views.sql`

## Vercel 배포 메모

이 프로젝트는 `dashboard` 폴더를 Vercel Root Directory로 잡으면 돼.

필요한 환경변수
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SOURCE_SHEET_URL` 선택

Vercel 설정 파일
- `dashboard/vercel.json`

## Google Sheets 동기화

원본 시트
- Dashboard-main
- https://docs.google.com/spreadsheets/d/1bALRM_uxx4UbVdjIDuk8JE5-hGp1rjyy0Xuf3gHS8gQ/edit

동기화 스크립트
- `/hermes/KP_monthly-report/sync_google_sheets_to_supabase.py`

사용 예시
```bash
cd /hermes/KP_monthly-report
.venv/bin/python sync_google_sheets_to_supabase.py --dry-run
.venv/bin/python sync_google_sheets_to_supabase.py
```

시트 탭 구성
- `guide`
- `raw_member`
- `raw_event`
- `raw_ad`
- `raw_optin`
- `daily_activity`
- `monthly_activity`

주의
- 예시 행(example, fill when available)은 기본적으로 import에서 제외됨
- `raw_event`, `raw_ad`는 월별 TTL 행을 포함하면 summary 재집계에 사용됨
- `raw_optin`은 월별 SMS/PUSH 동의수를 `monthly_member_summary`에 반영함

## 다음 작업

1. 실제 원본 데이터 입력
2. dry-run으로 건수 검증
3. 실데이터 sync 실행
4. 수신동의수 카드/표 실데이터 반영 확인
5. cron으로 정기 동기화 연결
6. DAU 정의를 원본 기준으로 고도화

## 메모

현재 대시보드는 기존 적재 완료 데이터 기준으로 동작해.
즉, Google 세팅이 끝나기 전에도 UI 확인과 프론트 개발은 가능해.
