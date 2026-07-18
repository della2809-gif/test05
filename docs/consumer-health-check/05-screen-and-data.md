# 화면·메뉴·데이터 저장

## 화면 경로

| 경로 | 기능 |
|---|---|
| `/health-check` | 소개, 최근 결과, 과거 검사 |
| `/health-check/new` | 기본정보, 생활습관, 12개 영역 60문항 |
| `/health-check/result/[id]` | 건강점수와 결과 요약 |
| `/health-check/report/[id]` | 7개 섹션 전체 보고서 |

## 주요 화면 파일

- `src/components/health-check/health-check-dashboard.tsx`
- `src/components/health-check/health-check-wizard.tsx`
- `src/components/health-check/health-result.tsx`
- `src/components/health-check/medical-disclaimer.tsx`

## 생활습관 선택 항목

각 문항은 `예` 또는 `아니오`를 클릭하는 방식입니다. 10개 문항을 모두 선택해야 다음 단계로 이동합니다.

- 식사를 규칙적으로 합니다.
- 하루 2끼 이상 채소를 섭취합니다.
- 과일을 하루 1회 이상 섭취합니다.
- 매끼 단백질 식품을 섭취합니다.
- 하루 약 2L의 물을 마십니다.
- 커피와 카페인 음료는 하루 1잔 이하로 마십니다.
- 일주일에 3회 이상, 30분 이상 운동합니다.
- 하루 7시간 이상 충분히 수면합니다.
- 하루 20분 이상 햇빛을 쬡니다.
- 체중과 건강 상태를 정기적으로 확인합니다.

응답 점수: `예 5점`, `아니오 1점`

결과 등급: `45~50 매우 우수`, `35~44 양호`, `25~34 개선 필요`, `24점 이하 집중 관리 권장`

## 메뉴 파일

- PC 사이드바: `src/components/layout/sidebar.tsx`
- 모바일 메뉴: `src/components/layout/mobile-nav.tsx`

## 저장 API와 데이터베이스

- 목록·저장 API: `src/app/api/health-assessments/route.ts`
- 결과 조회 API: `src/app/api/health-assessments/[id]/route.ts`
- Supabase 테이블·RLS: `supabase/migrations/20260716000000_consumer_health_assessments.sql`

## 운영 전 확인

- Supabase 환경변수 연결
- 마이그레이션 적용
- 로그인 사용자별 RLS 확인
- 모바일·PC 문진 완료 확인
- 의료 고지와 PDF 출력 확인
