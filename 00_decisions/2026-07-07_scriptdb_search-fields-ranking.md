# 의사결정: admin_blocks 검색 필드 확장(usage_context/keywords/tags) + 랭킹 + 원문 출력 모드

## 배경
- #geniea 7/7 피드백(C-1): "청소기 비유", "자동차 정기점검", "밥 타는 거" 같은 고유 표현이나 상황 서술형 질문("이런 사람에게 뭐라고 설명하면 좋을까")에 Script DB가 검색되지 않고 GPT가 새로 답변함. admin_blocks는 title/category/content 3컬럼 ilike뿐 — products/packages/stories/links는 tags·keywords 검색이 있는데 blocks만 없었음.
- #geniea 7/7 피드백(C-6): 긴 원문을 넣어도 답변이 짧게 요약됨. 직접 원인은 blocks 로더의 `content.slice(0, 400)` 일괄 절단.

## 선택지
- 임베딩(벡터) 검색 신설 vs 렉시컬 확장(컬럼 추가 + ilike). → 7/5 admin_files.keywords에서 검증된 렉시컬 패턴을 복제(과설계 회피). 임베딩은 추후 검토.

## 결정
1. `admin_blocks`에 `usage_context`(사용상황), `keywords`, `tags`(쉼표 구분 TEXT) 3컬럼 추가 — 마이그레이션 `20260707000000_admin_blocks_add_search_fields.sql` (라이브 적용은 승인 후, 코드는 컬럼 부재 시 기존 3컬럼으로 자동 폴백).
2. 챗봇 blocks 로더 검색 ilike에 3컬럼 포함 + 인접 2어절 구(phrase) 검색어 확장 + 랭킹: 제목 정확 일치(+30) > 키워드·태그(+8) > 사용상황(+6) > 제목 부분 일치(+5) > 카테고리(+2) > 본문(+1).
3. 절단 정책: 상위 1~2건은 2,000자, 나머지는 400자 유지. "원문/전체/그대로 보여줘" 의도 감지 시 1위 블록은 20,000자 상한으로 전문 전달 + "요약·생략 없이 그대로 출력" 지시문 주입 (route.ts 변경 없이 openai.ts 로더에서 해결).
4. 관리자 Script DB 화면에 사용상황·키워드·태그 입력칸 추가, 임베딩 텍스트에도 포함. 기존 본문 내 "사용상황/검색키워드" 표기 이관은 `scripts/parse_blocks_usage_keywords_20260707.mjs`(dry-run 기본, 실행 전 승인 필요).

## 이유
- 7/5 admin_files.keywords에서 검증된 저위험 패턴 재사용. 컬럼 부재 폴백 덕에 마이그레이션 적용 전 배포해도 무해.
- 400자 일괄 절단이 "긴 원고 요약" 불만의 직접 원인이므로 상위 건만 상향해 토큰 비용과 원문 충실도의 균형을 맞춤.

## 영향 범위
- `supabase/migrations/20260707000000_admin_blocks_add_search_fields.sql` (미적용 — 승인 후 적용)
- `src/lib/openai.ts` (blocks 로더, expandPhraseTerms/wantsFullContent 유틸)
- `src/app/admin/blocks/page.tsx` (입력칸 3개, 검색·저장 폴백)
- `src/types/database.ts` (AdminBlock/AdminBlockInsert optional 필드)
- `scripts/parse_blocks_usage_keywords_20260707.mjs` (작성만, 미실행)

## 검증 기준
- 블록에 키워드 "청소기 비유"를 등록하면, "청소기 비유 알려줘" 질문에 해당 스크립트가 검색·인용된다.
- 사용상황을 등록하면 상황 서술형 질문에서도 해당 블록이 상위로 랭크된다.
- "OO 원문 그대로 보여줘" 질문 시 해당 블록 content가 요약 없이 답변에 출력된다.
- 마이그레이션 미적용 상태에서도 관리자 저장·검색과 챗봇 검색이 에러 없이 동작한다(3컬럼 폴백).
- 제목과 질문이 정확히 일치하는 블록이 본문 부분 일치 블록보다 먼저 노출된다.

## 되돌리기
- 쉬움 (로더 확장·랭킹 가중치 되돌리고 컬럼 방치 가능)
