# 의사결정: 자료 조회성 질문의 4단 포맷 생략 + 이미지 URL 창작 금지 가드 + 번호선택 재주입

## 배경
- 클라이언트(7/6 자유채팅 스레드): "원고 보여줘 같은 단순 자료 요청에도 매번 1)상담판단 2)추천방향 3)고객발송문구 4)추가확인질문이 나오는 건 이상함" → 나연님 승인으로 자료 조회 분기 추가 (C-5).
- 사업설명 지플릿에서 example.com / via.placeholder.com 깨진 링크 출력 (C-2). 2026-07-07 진단으로 원인 확정: DB에는 placeholder 0건·admin_images 344건 전원 정상(HEAD 200) — **LLM이 URL을 지어내거나 재타이핑 중 변형**하는 것이 원인.
- 이미지 목록에서 "3번"/"네"로 선택하면 "해당 이미지를 제공할 수 없습니다" 거절 (C-4). 원인: 짧은 선택 발화는 검색어가 추출되지 않아 로더 전부 스킵 → DB 근거 0건 → 자유채팅의 빈 검색 가드(EMPTY_SEARCH_GUIDE)가 "직전 답변 재출력 금지"를 지시 → 프롬프트 순응 거절.

## 선택지
- (C-4 근본안) 서버측 `[IMG#n]` 토큰 카탈로그 + 응답 후처리 치환 — messages route·스키마 변경 필요(이번 작업 범위 밖, route.ts 수정 금지). 추후 확대 가능.
- (채택) openai.ts 프롬프트 레이어에서 해결: 직전 어시스턴트 답변의 `[IMAGE:URL]`을 파싱해 선택형 후속턴에 재주입 + 전 프로필 URL 창작 금지 가드.

## 결정
1. **자료 조회 분기 (C-5)**: 채팅 generic 경로(`emptySearchFallback=true`)에서 사용자 입력이 자료 조회성(`보여줘/찾아줘/검색해/원문/전체` 동사, 또는 자료 명사+있어요/알려줘 결합)이면 `STAFF_ASSISTANT_PROMPT`(4단) 대신 `STAFF_DATA_LOOKUP_PROMPT`(첫 줄 "DB 확인: ..." + 자료 즉시·무요약 출력)로 조립. 상담성 질문·케이스엔진·아카이브 재정리·코칭 프로필은 기존 유지.
2. **URL 창작 금지 가드 (C-2/C-3)**: `IMAGE_URL_GUARD`("검색 결과의 URL을 글자 그대로 복사, 생성·변형 절대 금지, 없으면 이미지 언급 금지")를 staff/조회/coaching 3개 조립 경로 전부에 공통 주입.
3. **번호선택 재주입 (C-4)**: 사용자 입력이 짧은 선택형(`3번`, `1, 2번`, `네` 등 12자 이하)이고 직전 어시스턴트 답변에 `[IMAGE:URL]`이 있으면, 그 URL 목록을 표시 순서 그대로 번호 매핑으로 이번 턴 컨텍스트에 재주입. 재주입되면 DB 근거로 취급되어 EMPTY_SEARCH_GUIDE(재출력 금지)가 자동으로 빠지고, 조회 프롬프트로 조립된다.
4. **사업설명 지플릿 images 연결 (C-2 ①)**: 라이브 `admin_giplets` 확인 결과 "5_사업 설명"(giplet_key=key31)의 `db_sources`에 `images`가 **이미 포함**되어 있어 DB UPDATE 불필요 (2026-07-07 read-only 검증).

## 이유
- 깨진 링크의 원인이 DB가 아니라 LLM 창작임이 데이터로 확정됐으므로, 프롬프트 가드 + 서버가 준 URL의 결정적 재주입이 정확한 대응이다.
- 4단 포맷은 상담 요청에는 유효한 정책(7/5 결정)이므로 폐기하지 않고, 조회성 입력만 분기한다. 코칭 프로필은 7/4 클라이언트 튜닝 결과라 건드리지 않는다.
- `emptySearchFallback`은 채팅 generic 경로에서만 켜지는 기존 플래그라, 이를 게이트로 쓰면 케이스엔진·정리형 공유 호출이 조회 분기에 오염되지 않는다.

## 영향 범위
- `src/lib/openai.ts` — `buildSystemPrompt` 최종 조립부(프로필 3분기), `isDataLookupQuery`/`isSelectionFollowUp` 판정, 선택형 후속턴 재주입 블록, `IMAGE_URL_GUARD`·`STAFF_DATA_LOOKUP_PROMPT`·`ADMIN_PROMPT_PRIORITY_LOOKUP` 상수
- `src/lib/__tests__/openai-lookup-format.test.ts` — 신규 검증 테스트 7건

## 검증 기준
- 자유채팅에서 "사업설명 원고 6번 보여줘" 입력 시 1)~4) 제목 없이 자료가 바로 출력된다.
- 자유채팅에서 "혈압약 드시는 고객님께 어떻게 안내하죠?" 입력 시 기존 4단 형식이 유지된다.
- 이미지 목록 제시 후 "3번" 입력 시 목록의 3번 이미지가 동일 URL로 출력된다 (거절 문구 없음).
- 응답에 example.com / via.placeholder.com URL이 나오지 않는다.
- `npx vitest run src/lib/__tests__/openai-lookup-format.test.ts` 통과.

## 되돌리기
- 쉬움 — openai.ts 조립 분기 2곳(조회 분기 if, 재주입 블록)과 가드 주입만 제거하면 원상복구.
