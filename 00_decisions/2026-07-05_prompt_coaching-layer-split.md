# 의사결정: 커스텀 대화형 지플릿에서 4단 포맷 제거 + 코칭 규칙 자동 적용

## 배경
- 클라이언트가 코칭형 지플릿(꿈과목표·결심결단 등) 프롬프트에 "질문을 깊게 이어가라"고 써도, 코드가 모든 지플릿에 강제 주입하는 `STAFF_ASSISTANT_PROMPT`의 4단 포맷("1) 상담 판단 2) 추천 방향 3) 고객 발송 문구 4) 추가 확인 질문")과 충돌해 AI가 성급히 정리 모드로 전환됨 (#geniea 7/4 피드백).
- 프롬프트 수정만으로는 극복 불가 — 코드 레이어가 항상 이김.

## 선택지
- A안: 코드가 자동 구분 (계산·검색 capability와 case_key가 없는 커스텀 지플릿 = 코칭형)
- B안: admin_giplets에 코칭 모드 컬럼 추가 + 운영자 페이지 스위치

## 결정
- A안 채택. `promptProfile: "coaching"`을 라우트가 판단해 전달, `buildSystemPrompt`가 STAFF 4단 포맷·고객성향 되묻기 대신 `COACHING_BEHAVIOR_GUIDE`(질문 1~2개씩·깊게·성급한 정리 금지·금지어)와 코칭용 우선순위 지시를 주입.

## 이유
- 클라이언트가 이미 지쳐 멈춘 상태라 배포 즉시, 클라이언트 설정 없이 효과가 나야 함.
- B안(스위치)은 필요해지면 나중에 얹을 수 있음.

## 영향 범위
- `src/lib/openai.ts` (COACHING_BEHAVIOR_GUIDE, ADMIN_PROMPT_PRIORITY_COACHING, buildSystemPrompt 분기)
- `src/app/api/conversations/[id]/messages/route.ts` (isCoachingGiplet 게이트, 히스토리 최신 50개 수정 포함)
- 자유채팅(general)·계산/검색 지플릿·케이스엔진 지플릿은 기존 동작 유지.

## 검증 기준
- 커스텀 코칭 지플릿 답변에 "1) 상담 판단" 등 4단 헤더가 나오지 않는다.
- 코칭 지플릿이 질문을 한 번에 1~2개만 하고, 여러 턴에 걸쳐 이어간다.
- 자유채팅 답변은 여전히 4단 포맷으로 나온다.
- 51개 이상 주고받은 대화에서 직전 대화 맥락을 기억한다 (히스토리 버그 수정).

## 되돌리기
- 쉬움 (promptProfile 전달부 제거 시 전량 기존 동작)
