# KP Dashboard Google Sheets Template

이 파일은 Thekary Point 대시보드 원본 시트 구조 초안이야.

시트 구성
- guide: 시트 설명과 입력 규칙
- raw_member: 일별 회원/앱다운로드 원본 + optin/dau/mau 통합 입력
- raw_event: 월별 프로모션 상세 원본
- raw_ad: 월별 광고 상세 원본
- raw_optin: 구버전 호환용 optin 입력 탭. raw_member 운영이 안정화되면 삭제 가능
- daily_activity: 구버전 호환용 DAU 입력 탭. raw_member 운영이 안정화되면 삭제 가능
- monthly_activity: 구버전 호환용 MAU 입력 탭. raw_member 운영이 안정화되면 삭제 가능

권장 규칙
- 날짜: YYYY-MM-DD
- 월 지표 키: 월 단위로 집계되며 시스템 내부에서는 해당 월 1일 기준으로 정규화
- raw_member 기본 컬럼은 `report_date, weekday_text, member_count, app_downloads, withdrawals, net_growth, cumulative_conversion, active_members, is_month_end, issue_note`
- raw_member에 `sms_opt_in_members`, `push_opt_in_members`, `optin`, `dau`, `mau` 컬럼을 추가로 둘 수 있음
- raw_member에서 `optin` 단일 컬럼만 쓰면 sync는 이를 `push_opt_in_members` 대체값으로 사용
- raw_member에 optin/dau/mau 값이 하나라도 있으면 sync는 raw_optin / daily_activity / monthly_activity 탭보다 raw_member 값을 우선 사용
- MAU는 raw_member의 J열에 입력하고, 해당 월 집계가 끝난 `is_month_end = TRUE` 행에만 입력하는 것을 기준으로 사용
- raw_optin: 월말 조회값 기준으로 입력 권장 (예: 2026-03-31). sync 시 내부적으로 2026-03 월 데이터로 인식
- raw_event / raw_ad / monthly_activity: 해당 월 어느 날짜를 넣어도 되지만 가능하면 월 1일 형식으로 통일
- 비율: 소수로 입력 (예: 31.1% -> 0.311, CTR 2.6% -> 0.026)
- 금액/건수: 쉼표 없이 숫자만 입력
- raw_event와 raw_ad는 월별 TTL 행이 있으면 그대로 유지

Supabase 매핑
- raw_member -> thekary_point.raw_member_daily / monthly_member_summary 재집계
- raw_member 내 optin -> monthly_member_summary.sms_opt_in_members, push_opt_in_members
- raw_member 내 dau -> thekary_point.daily_activity_metrics
- raw_member 내 mau -> thekary_point.monthly_activity_metrics
- raw_event -> thekary_point.raw_event_monthly_detail / monthly_event_current 재집계
- raw_ad -> thekary_point.raw_ad_monthly_detail / monthly_ad_summary 재집계
- raw_optin -> raw_member에 optin 컬럼이 비어 있을 때만 fallback 사용
- daily_activity -> raw_member에 dau 컬럼이 비어 있을 때만 fallback 사용
- monthly_activity -> raw_member에 mau 컬럼이 비어 있을 때만 fallback 사용
