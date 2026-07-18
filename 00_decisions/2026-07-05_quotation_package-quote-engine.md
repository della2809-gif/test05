# 의사결정: 자동견적 텍스트 경로 — 결정적 패키지 매칭 엔진 + 구성품 입력 UI

## 배경
- 자동견적 지플릿은 건강 체크리스트 이미지 분석 경로만 있었고, 텍스트 질의("리셋 2주 견적", "50만원대 다이어트")는 일반 채팅으로 폴백됨. `admin_packages.components`는 어떤 코드도 소비하지 않았음.
- 클라이언트 1차 검수 항목("자동견적 견적 카드/출력물 확인")과 통화(7/3)에서 패키지 구성품 기반 견적 기대 확인.
- 관리자 패키지 화면에 구성품 입력 UI가 없어 신규 패키지가 자동견적에 반영될 수 없는 구조였음 (7/5 민재 확인).

## 선택지
- LLM이 패키지를 고르게 하는 방식 vs 규칙 기반(키워드+예산) 결정적 매칭

## 결정
- **결정적 매칭 채택**: `src/lib/package-quote-engine.ts` — 예산(만원 단위)·목적 키워드 파싱 → is_active 패키지 47건 스코어링(name 3/category·tags 2/benefit 1, 예산 근접) → 상위 3개 → 구성품을 admin_products에 이름/별칭/접두/포함 순으로 해석해 단가·점수 결합 → `__PKGQUOTE__` 카드. 미해석 구성품은 "단가 미확인"으로 표시(조용히 누락 금지).
- 매칭 실패 시 기존 일반 AI 경로 폴백, 이미지 경로(__QUOTATION__)는 불변.
- 관리자 패키지 다이얼로그에 구성품 행 편집기(제품명 datalist 자동완성+수량) + "설명글에서 불러오기"(구성/■ 구성/최종 구성 파싱) 추가. 목록에 구성품 개수 뱃지/0개 경고.

## 이유
- 가격·구성품 수치는 지어내면 안 되는 값이라 LLM 선택보다 규칙 기반이 안전하고, 결과 예측·검증이 쉬우며 추가 비용이 없음.
- "설명글에서 불러오기"는 클라이언트의 기존 입력 습관(설명글 붙여넣기)을 구조화 데이터로 잇는 다리.

## 영향 범위
- 신규: `src/lib/package-quote-engine.ts`, `src/components/chat/package-quote-card.tsx`, `src/lib/__tests__/package-quote-engine.test.ts`
- 수정: `src/app/api/conversations/[id]/messages/route.ts`(health_analysis 텍스트 분기), `src/components/chat/message-bubble.tsx`(__PKGQUOTE__), `src/app/admin/packages/page.tsx`(구성품 편집기)
- 데이터 선행: 7/5 패키지 47건 components 구조화(백업: geniea_db_batches/20260705_package_components/)

## 검증 기준
- 자동견적 지플릿에 "리셋 해독 2주 패키지 견적 내줘" → 리셋 2주 패키지 카드(구성품·가격·점수) 출력
- "50만원 이하 다이어트 패키지" → 예산 필터 반영
- 이미지 업로드 시 기존 체크리스트 분석 카드 동작 불변
- 관리자 패키지 수정에서 구성품 행 추가/삭제/저장이 DB에 반영, "설명글에서 불러오기"로 벌크 입력 가능

## 되돌리기
- 쉬움 (텍스트 분기 제거 시 기존 동작 복원, components 데이터는 백업 보존)
