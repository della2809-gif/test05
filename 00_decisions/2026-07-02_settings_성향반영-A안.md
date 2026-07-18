# 의사결정: 사용자 성향(논리적/감성적/실용적)을 설정 페이지 전역값으로 받아 출력 톤에 반영 (A안)

## 배경
- `profile.personality`(논리적/감성적/실용적)는 DB 컬럼만 있고, 어디에서도 선택되지 않고 시스템 프롬프트에 주입되지 않아 전원 기본값 `logical`로 고정된 채 답변에 영향이 전혀 없었다.
- 대표님이 매니저와 주고받은 "AI 정리 기능 정의" 메일과 2026-07-02 슬랙에서 "성향 선택(논리적/감성적/실용적)에 따라 출력 톤이 구분되어야 한다"를 확정했다.

## 선택지
- **A안(채택):** `profile.personality` 전역값 그대로 사용. 스키마 변경 없음. 설정 페이지에서 선택.
- B안: `conversations.personality` 컬럼을 추가해 대화별로 성향 선택(마이그레이션+대화 시작 UI 필요).

## 결정
- 성향 선택 위치 = **사용자 설정 페이지**(3/16 화상회의 합의: "설정 페이지에는 사용자 성향 및 셀프/가이드 모드 기능이 들어가야 한다").
- 값 범위 = **사용자 전역 1개**(`profile.personality` 활용, 스키마 변경 없음).
- 적용 범위 = **전 지플릿·자유채팅 공통**(출력 톤 전반). 검색형 정확도 보호를 위해 "포맷은 유지하되 서술 톤만 성향에 맞춘다" 안전문구 동반.

## 이유
- 클라이언트 핵심 요구는 "톤 구분" 한 줄이며, 조합(셀프+실용 등)을 대화마다 바꿔야 한다는 확정은 아직 없다. 스키마 변경 없이 빠르게 동작을 확인할 수 있는 A안이 위험이 가장 낮다.
- 향후 "대화마다 바꾸고 싶다"가 확정되면 B안(conversation 컬럼)으로 승격 가능.

## 영향 범위
- `src/lib/openai.ts` — `GenerateAIResponseParams.personality` 필드 추가, `USER_PERSONALITY_CONTEXT`(3종)+`USER_PERSONALITY_FALLBACK`+`USER_PERSONALITY_FORMAT_GUARD` 상수, `resolvePersonalityBlock()` 헬퍼, `buildSystemPrompt`/`generateAIResponseWithTools` 반환부에 MODE_CONTEXT 뒤 성향 블록 주입. (기존 `PERSONALITY_PROMPT`='고객 성향'은 그대로 유지 — 이름만 유사한 별개 개념)
- `src/app/api/conversations/[id]/messages/route.ts` — `profiles.personality` 조회 후 케이스/지플릿-케이스/회원등록/generic(genericOverrides) 모든 AI 호출에 `personality` 전달.
- `src/app/api/archives/[id]/reorganize/route.ts` — 죽은 참조 수정: 프로필의 `mode`·`personality`를 실제로 `generateAIResponse`에 전달.
- `src/app/(main)/settings/page.tsx` — 성향 라디오 3종(논리적/감성적/실용적) 추가, 선택 시 `profiles.personality` 즉시 저장.
- `src/lib/__tests__/openai-personality.test.ts` — 성향별/미설정/포맷가드 주입 검증 테스트 신설.

## 검증 기준
- `logical` 선택 시 시스템 프롬프트에 "출력 성향(논리적)"·"판단 근거", `emotional`에 "공감", `practical`에 "체크리스트"가 포함된다.
- 성향 미설정(undefined) 시 "출력 성향(미설정)"·"따뜻하지만 실용적인 톤"이 포함된다.
- 모든 경우 "성향은 출력 '톤'에만 적용됩니다" 포맷 유지 안전문구가 포함된다(4단 포맷·'DB 확인:' 규칙 보호).
- 설정 페이지에서 성향을 고르면 `profiles.personality`가 갱신되고, 새로고침 시 선택이 유지된다.

## 되돌리기
- 쉬움. 성향 블록 주입 3줄과 라우트의 personality 전달, 설정 UI 섹션만 제거하면 원복. 스키마 변경 없음.
