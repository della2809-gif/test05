# GENIEA 근거기반 우선순위 알고리즘 v1.0

## 적용 범위

이 알고리즘은 질병 또는 원인을 확정하는 진단 알고리즘이 아니다. 자가보고 문진을 이용해 건강관리와 추가 확인의 순서를 제안하는 선별 알고리즘이다.

## 우선순위 계산

영역별 우선도는 0~100점으로 산출한다.

```text
우선도 = 증상 부담 60% + 반복 신호 25% + 연관 생활습관 공백 15%
```

- 증상 부담: 영역별 5개 문항 합계를 0~100으로 표준화
- 반복 신호: `자주` 또는 `거의 항상`으로 응답한 문항의 비율
- 생활습관 공백: 해당 영역과 연결된 실천 항목 중 `아니오`의 비율
- 안전 신호: 흉통, 호흡곤란, 실신 등은 일반 우선도와 별도로 의료 확인 안내를 최상단에 표시

## 연관 패턴 신뢰도

IFM Matrix의 시스템 연결 구조를 참고해 관련 영역을 묶되 원인으로 확정하지 않는다.

- 높음: 연결 영역 중 2개 이상이 경계 수준이고 평균 연관 점수가 50 이상
- 보통: 연결 영역 중 1개 이상이 경계 수준
- 낮음: 위 조건을 충족하지 않음

## 생활습관 근거

- 채소·과일: WHO의 성인 하루 400g 이상 권고
- 신체활동: WHO의 성인 주 150분 이상 중강도 활동 및 주 2회 이상 근력활동 권고
- 수면: CDC의 성인 하루 7시간 이상 권고
- 음주: AUDIT-C와 같은 검증된 도구로 별도 선별하는 것을 권장

## 임상 검증 상태

GENIEA의 현재 60문항 자체는 아직 타당도, 신뢰도, 민감도와 특이도가 검증되지 않았다. 따라서 다음 단계를 거쳐야 `검증된 알고리즘`이라고 표현할 수 있다.

1. 전문가 내용타당도 평가
2. 사용자 파일럿과 문항분석
3. 내적 일관성 및 재검사 신뢰도 평가
4. 표준도구·검사 결과와의 준거타당도 평가
5. 우선도 절단점의 ROC 분석과 외부 검증

## 참고 근거

- IFM Functional Medicine Matrix: https://www.ifm.org/articles/toolkit-functional-medicine-matrix
- WHO WHODAS 2.0: https://www.who.int/standards/classifications/international-classification-of-functioning-disability-and-health/who-disability-assessment-schedule
- WHO 건강한 식사: https://www.who.int/en/news-room/fact-sheets/detail/healthy-diet
- WHO 신체활동 권고: https://www.who.int/initiatives/behealthy/physical-activity
- CDC 성인 수면 권고: https://www.cdc.gov/sleep/about/index.html
- NIAAA AUDIT-C 안내: https://www.niaaa.nih.gov/health-professionals-communities/core-resource-on-alcohol/screen-and-assess-use-quick-effective-methods
