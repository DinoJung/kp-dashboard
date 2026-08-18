# KP Dashboard Workspace

Thekary Point 대시보드 작업 폴더야.

구성
- `032.dashboard/` : React + Vite 대시보드 앱
- `032.dashboard/dashboard_public_views.sql` : 인증 사용자 조회용 Supabase view 정의
- `031.data/icebiscuit_meta_schema.sql` : META 적재 및 집계 view 정의
- `031.data/sync_google_sheets_to_supabase.py` : Google Sheets 동기화 스크립트

배포 기준
- GitHub 저장소 루트 기준으로 push
- Vercel에서는 `032.dashboard/`를 Root Directory로 지정

민감정보
- `.env`, `.venv`, `032.dashboard/.env.local`, `node_modules`, `dist`, `.omo`, `033.export`는 `.gitignore`로 제외
- 대시보드 로그인은 Supabase Auth 계정만 사용하며, 브라우저 환경변수에 비밀번호를 넣지 않음
