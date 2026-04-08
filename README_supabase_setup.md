# Thekary Point Supabase 세팅 메모

현재 진행 상황
- 작업 폴더: `/hermes/KP_monthly-report`
- 스키마 초안 SQL 작성 완료: `thekary_point_supabase_schema.sql`
- service role key 확인 완료
- direct `DATABASE_URL`도 확인 완료
- 로컬 Python venv 생성 및 `psycopg` 설치 완료

적용 결과
- direct host 대신 pooler connection string으로 연결 성공
- `.env`의 비밀번호 내 `@` 문자는 URL 인코딩(`%40`) 처리
- `thekary_point` 스키마 DDL 적용 완료
- 생성 검증 완료

생성된 주요 객체
- tables: `import_batches`, `raw_member_daily`, `raw_event_monthly_detail`, `raw_ad_monthly_detail`, `monthly_member_summary`, `monthly_ad_summary`, `monthly_event_current`, `monthly_event_snapshot`, `monthly_report_notes`
- views: `v_monthly_report_base`, `v_monthly_report_mom`

다음 권장 단계
1. 2026-03 기준 샘플 적재 스크립트 작성
2. XLSX/CSV -> Supabase 적재 루틴 고정
3. 리포트 생성용 조회 SQL/Markdown 템플릿 연결

추천 구조
- `monthly_member_summary`: member는 최신 월 집계 중심
- `monthly_ad_summary`: ad는 최신 월 집계 중심
- `monthly_event_current`: event 최신값
- `monthly_event_snapshot`: event 시점 스냅샷
- `raw_*` 테이블: 원천 이력 보관
- `v_monthly_report_base`, `v_monthly_report_mom`: 리포트 조회용 뷰

진우님이 보내주시면 바로 이어서 할 최소 정보
- 방법 A: Supabase 프로젝트 URL + service_role key
- 방법 B: Postgres connection string
- 방법 C: SQL Editor 접근은 진우님이 하고, 내가 실행용 SQL을 계속 만들어드리는 방식

다음 작업 예정
1. Supabase 접속
2. `thekary_point` 스키마 생성
3. 테이블/뷰 생성 검증
4. 2026-03 기준 샘플 적재 스크립트 작성
5. 이후 월간 리포트 자동화 연결
