# 의사결정: admin_files 검색 키워드 컬럼 + 렉시컬 병행 검색

## 배경
- 레퍼런스 파일 검색이 임베딩 유사도 단독이라, 영문 원서(예: Nutritional Supplements)를 한글 질문으로 찾지 못함 (#geniea 7/5 피드백 "한글로 유저가 물어보면 못찾아오는걸까? ㅠ").
- 제품 DB는 aliases 컬럼 + ilike 경로가 이미 있어 같은 문제를 겪지 않음.

## 결정
- `admin_files.keywords TEXT`(쉼표 구분) 추가. 레퍼런스 로더에 렉시컬 경로 추가: 검색어로 `file_name/keywords` ilike 매치 → 해당 파일 청크(검색어 포함 우선, 최대 3개)를 임베딩 결과에 병합.
- 관리자 파일 상세 다이얼로그(신규)에서 키워드 편집 가능. 업로드 시에도 keywords 수용.

## 이유
- 제품 DB에서 검증된 패턴 복제라 위험이 낮고, RPC(순수 벡터 검색) 변경 없이 앱 레이어에서 해결.

## 영향 범위
- `supabase/migrations/20260705000000_admin_files_add_keywords.sql` (라이브 적용은 매니저 승인 후)
- `src/lib/openai.ts` (rag:admin_files 로더), `src/app/api/admin/files/route.ts`(POST), `src/app/api/admin/files/[id]/route.ts`(GET 신설·PATCH 확장), `src/app/admin/files/page.tsx`(상세 다이얼로그), `src/types/database.ts`

## 검증 기준
- 파일에 한글 키워드 입력 후, 그 키워드가 포함된 한글 질문에 해당 파일 내용이 답변 근거로 나온다.
- 키워드 없는 기존 파일의 임베딩 검색 동작은 변하지 않는다.
- `/admin/files`에서 파일 행 클릭 시 본문 미리보기·청크 수·원본 다운로드가 보인다 (청크 0개 = 미반영 경고).

## 되돌리기
- 쉬움 (렉시컬 경로 제거 + 컬럼 방치 가능)
