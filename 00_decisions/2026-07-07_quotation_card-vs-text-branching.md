# 의사결정: 자동견적 카드 vs 텍스트 출력 분기 결정화

## 배경
- 클라이언트: "같은 질문도 어떤 땐 텍스트, 어떤 땐 카드로 나오고, 카드일 때 내용이 안 맞는 경우가 있음" (7/7 로직테스트 스레드).
- 기존 텍스트 경로(2026-07-05_quotation_package-quote-engine.md)는 키워드+예산 스코어링 매칭이라, 자유 입력에도 유사 패키지 카드가 뜨는 등 카드/텍스트 경계가 흐렸음.
- 클라이언트와 봇이 분기 기준을 합의함: OCR 건강체크표 입력 + Package DB의 정해진 패키지명 입력 = 카드 / 제품명·수량 자유 입력, 혼합 견적, 바디용품·화장품 포함 = 우선 텍스트.

## 결정
- 분기를 **결정적 코드**로 고정: `src/lib/package-quote-engine.ts`의 `decidePackageQuoteOutput()`.
  1. **카드**: (a) 건강체크표 이미지(OCR) → __HEALTHQUOTE__ 카드, (b) 텍스트에 Package DB 패키지명이 정확 포함(전체 이름 또는 4자 이상 의미 세그먼트, "패키지 N주" 같은 일반어 세그먼트 제외) → __PKGQUOTE__ 카드.
  2. **텍스트**: 패키지명 미포함(no_exact_package) / 패키지명 외 개별 수량 표기 잔존 = 혼합 견적(mixed_freeform) / 바디용품·화장품 키워드 포함(body_or_cosmetic) → LLM 일반 응답.
- 기존 `matchPackages`(키워드+예산 스코어링)는 유지하되 채팅 분기에서는 `matchPackagesExact`(정확 매칭 전용)만 사용. 2026-07-05 결정의 "키워드·예산 매칭으로 카드 출력" 부분은 이 결정으로 **대체**됨 (엔진·카드 자체는 재사용).

## 이유
- LLM/스코어링 판단이 분기에 끼면 같은 질문에 다른 출력이 나옴 — 클라이언트 요구는 "안정성". 정확 매칭은 거짓 카드(내용 안 맞는 카드)를 구조적으로 차단하고, 애매한 질의는 텍스트로 안전하게 흘림.
- 카드 확대(혼합 견적 등)는 클라이언트와 별도 기준 확정 후 진행하기로 합의됨.

## 영향 범위
- `src/lib/package-quote-engine.ts` (decidePackageQuoteOutput/packageNameSegments/matchPackagesExact 신설)
- `src/app/api/conversations/[id]/messages/route.ts` (health_analysis 텍스트 분기를 matchPackagesExact로 교체)
- `src/lib/__tests__/package-quote-branching.test.ts`

## 검증 기준
- "리셋해독 2주 견적" → 해당 패키지 카드 출력 (같은 입력 반복 시 항상 카드)
- "50만원대 다이어트 추천" → 카드 없이 텍스트 응답
- "리셋해독 2주에 헬스팩 3개 추가" / "리셋해독 2주랑 샴푸도" → 텍스트 응답
- 건강체크표 사진 → 항상 건강분석+3단 견적 카드 (판독 실패 시 되묻기 텍스트)

## 되돌리기
- 쉬움 (분기 호출부를 matchPackages로 되돌리면 7/5 동작 복원)
