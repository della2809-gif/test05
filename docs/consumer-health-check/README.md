# GENIEA 소비자 건강자산 체크 콘텐츠 관리

이 폴더는 건강자산 체크의 문항과 결과 문구를 검토하고 수정하기 위한 문서입니다.

## 문서 목록

1. [건강영역 및 60개 문항](./01-domains-and-questions.md)
2. [점수·등급·우선순위](./02-scoring-and-priorities.md)
3. [결과 리포트와 4주 로드맵](./03-report-and-roadmap.md)
4. [의료 안전문구와 금지표현](./04-safety-and-disclaimer.md)
5. [화면·메뉴·데이터 저장](./05-screen-and-data.md)

## 수정 시 주의사항

- Markdown 문서는 기획·검수용입니다.
- 현재 앱이 직접 읽는 실행 데이터는 `src/features/health-check/`에 있습니다.
- 문항 수정 시 `01-domains-and-questions.md`와 `src/features/health-check/data.ts`를 함께 변경합니다.
- 점수 수정 시 `02-scoring-and-priorities.md`와 `src/features/health-check/scoring.ts`를 함께 변경합니다.
- 의료 고지는 임의로 삭제하거나 진단·치료 표현으로 변경하지 않습니다.

