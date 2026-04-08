# Thekary Point Supabase 전체 이력 적재 결과

적재 원본
- `/home/j1nu/.hermes/cache/documents/doc_fe6fe4b8bab8_2026_thekarypoint_totaldata.xlsx`

적재 일시 기준 결과
- import_batch_id: 1
- 전체 이력 적재 완료

## 적재 row 수
- raw_member_daily: 703
- raw_event_monthly_detail: 141
- raw_ad_monthly_detail: 72
- monthly_member_summary: 24개월
- monthly_event_current: 20개월
- monthly_event_snapshot: 20개월
- monthly_ad_summary: 19개월

## 월 범위
- monthly_member_summary 기준: 2024-09-01 ~ 2026-08-01
- v_monthly_report_base 조회 가능 월:
  - 2024-09
  - 2024-10
  - 2024-11
  - 2024-12
  - 2025-01
  - 2025-02
  - 2025-03
  - 2025-04
  - 2025-05
  - 2025-06
  - 2025-07
  - 2025-08
  - 2025-09
  - 2025-10
  - 2025-11
  - 2025-12
  - 2026-01
  - 2026-02
  - 2026-03
  - 2026-04
  - 2026-05
  - 2026-06
  - 2026-07
  - 2026-08

## 2026-03 검증값
- 신규회원: 5,825
- 앱다운로드: 2,123
- 탈퇴: 25
- 순증: 5,800
- 월말 누적전환: 74,282
- 월말 활성회원: 91,699
- 이벤트 참여인원(TTL): 2,719
- 총 지급포인트: 8,938,500
- 사용포인트: 2,777,889
- 포인트 사용률: 0.310778
- 연계매출액: 255,447,952
- 광고 노출: 156,379
- 광고 클릭: 5,457
- 광고 전환: 1,066
- 광고 매출: 104,611,136
- 광고비(마크업,vat-): 1,544,366
- ROAS(마크업,vat-): 67.73727

## 참고
- member는 일별 raw 전체와 월별 summary 전체 적재
- event는 상세 raw 전체 + TTL 기준 monthly_event_current 적재
- event snapshot은 적재일 기준으로 각 월 1건씩 생성
- ad는 상세 raw 전체 + TTL 기준 monthly_ad_summary 적재
- sms_opt_in_members / push_opt_in_members 는 아직 미입력 상태
