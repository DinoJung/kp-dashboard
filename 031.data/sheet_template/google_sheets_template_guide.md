# KP Dashboard Google Sheets Template

이 파일은 Thekary Point 대시보드 원본 시트 구조 초안이야.

시트 구성
- guide: 시트 설명과 입력 규칙
- raw_member: 일별 회원/앱다운로드 원본
- raw_event: 월별 프로모션 상세 원본
- raw_ad: 월별 광고 상세 원본
- raw_optin: 월별 수신동의수 집계
- daily_activity: 일별 DAU
- monthly_activity: 월별 MAU

권장 규칙
- 날짜: YYYY-MM-DD
- 월 지표 키: 월 단위로 집계되며 시스템 내부에서는 해당 월 1일 기준으로 정규화
- raw_optin: 월말 조회값 기준으로 입력 권장 (예: 2026-03-31). sync 시 내부적으로 2026-03 월 데이터로 인식
- raw_event / raw_ad / monthly_activity: 해당 월 어느 날짜를 넣어도 되지만 가능하면 월 1일 형식으로 통일
- 비율: 소수로 입력 (예: 31.1% -> 0.311, CTR 2.6% -> 0.026)
- 금액/건수: 쉼표 없이 숫자만 입력
- raw_event와 raw_ad는 월별 TTL 행이 있으면 그대로 유지

Supabase 매핑
- raw_member -> thekary_point.raw_member_daily / monthly_member_summary 재집계
- raw_event -> thekary_point.raw_event_monthly_detail / monthly_event_current 재집계
- raw_ad -> thekary_point.raw_ad_monthly_detail / monthly_ad_summary 재집계
- raw_optin -> monthly_member_summary.sms_opt_in_members, push_opt_in_members
- daily_activity -> thekary_point.daily_activity_metrics
- monthly_activity -> thekary_point.monthly_activity_metrics
