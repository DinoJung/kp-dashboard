# KP Dashboard Workspace

Thekary Point 대시보드 작업 폴더야.

구성
- `dashboard/` : React + Vite 대시보드 앱
- `dashboard/dashboard_public_views.sql` : 프론트 공개 조회용 Supabase view 정의
- `thekary_point_supabase_schema.sql` : 초기 스키마 정의
- `import_xlsx_to_supabase.py` : 초기 적재 스크립트
- `dashboard_implementation_plan.md` : 구현 계획

배포 기준
- GitHub 저장소에는 `KP_monthly-report` 폴더 기준으로 push
- Vercel에서는 `dashboard/`를 Root Directory로 지정

민감정보
- `.env`, `.venv`, `dashboard/.env.local`, `node_modules`, `dist`는 `.gitignore`로 제외
