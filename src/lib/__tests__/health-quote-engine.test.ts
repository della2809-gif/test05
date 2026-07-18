import { describe, it, expect } from "vitest";
import {
  gradeFromScore,
  judgeAxes,
  hasUsableJudgment,
  overallGrade,
  selectAxisAdditions,
  buildTierPlan,
  computeTierTotals,
  estimateFirstCommissionKrw,
  buildAnalysisText,
  type AxisJudgment,
} from "../health-quote-engine";
import {
  AXIS_NAMES,
  TIER_COMPOSITION_TABLE,
  COMPOSITION_BLOCKS,
  type AxisKey,
  type HealthGrade,
} from "../health-quote-rules";

// 테스트 헬퍼 — 축별 등급을 지정해 AxisJudgment 배열을 만든다
function axesWith(grades: Partial<Record<AxisKey, HealthGrade>>): AxisJudgment[] {
  return (Object.keys(AXIS_NAMES) as AxisKey[]).map((axis) => ({
    axis,
    name: AXIS_NAMES[axis],
    score: null,
    grade: grades[axis] ?? "양호",
    gradeSource: "ocr" as const,
  }));
}

describe("gradeFromScore — 점수 구간 폴백 판정", () => {
  it("0~2 = 양호", () => {
    expect(gradeFromScore(0)).toBe("양호");
    expect(gradeFromScore(2)).toBe("양호");
  });
  it("3~4 = 보통", () => {
    expect(gradeFromScore(3)).toBe("보통");
    expect(gradeFromScore(4)).toBe("보통");
  });
  it("5~6 = 경계", () => {
    expect(gradeFromScore(5)).toBe("경계");
    expect(gradeFromScore(6)).toBe("경계");
  });
  it("7 이상 = 불량", () => {
    expect(gradeFromScore(7)).toBe("불량");
    expect(gradeFromScore(10)).toBe("불량");
  });
});

describe("judgeAxes — OCR 색구간 우선, 점수 폴백, 없으면 null", () => {
  const scores = { A: 1, B: 8, C: null, D: null, E: null, F: null, G: null, H: null, I: null, J: null };

  it("OCR 등급이 있으면 점수보다 우선한다", () => {
    const axes = judgeAxes(scores, { A: "경계" });
    const a = axes.find((x) => x.axis === "A")!;
    expect(a.grade).toBe("경계");
    expect(a.gradeSource).toBe("ocr");
  });

  it("OCR 등급이 없으면 점수 구간으로 폴백한다", () => {
    const axes = judgeAxes(scores, null);
    const b = axes.find((x) => x.axis === "B")!;
    expect(b.grade).toBe("불량");
    expect(b.gradeSource).toBe("score");
  });

  it("잘못된 OCR 등급 문자열은 무시하고 점수 폴백한다", () => {
    const axes = judgeAxes(scores, { A: "좋음" });
    const a = axes.find((x) => x.axis === "A")!;
    expect(a.grade).toBe("양호");
    expect(a.gradeSource).toBe("score");
  });

  it("점수·OCR 모두 없으면 grade null (지어내지 않음)", () => {
    const axes = judgeAxes(scores, null);
    const c = axes.find((x) => x.axis === "C")!;
    expect(c.grade).toBeNull();
    expect(c.gradeSource).toBeNull();
  });

  it("전부 null이면 hasUsableJudgment=false → 되묻기 경로", () => {
    const empty = { A: null, B: null, C: null, D: null, E: null, F: null, G: null, H: null, I: null, J: null };
    expect(hasUsableJudgment(judgeAxes(empty, null))).toBe(false);
    expect(hasUsableJudgment(judgeAxes(scores, null))).toBe(true);
  });
});

describe("overallGrade — 가장 나쁜 등급", () => {
  it("불량 > 경계 > 보통 > 양호", () => {
    expect(overallGrade(axesWith({ B: "불량", C: "경계" }))).toBe("불량");
    expect(overallGrade(axesWith({ C: "경계" }))).toBe("경계");
    expect(overallGrade(axesWith({ C: "보통" }))).toBe("보통");
    expect(overallGrade(axesWith({}))).toBe("양호");
  });
});

describe("selectAxisAdditions — 스펙 7장 (불량>경계, 공통제품 우선, 중복 금지)", () => {
  const 메가영양제_기본 = ["헬스팩", "바이오메가", "코퀴논30", "프로후라바놀C300"];

  it("양호/보통 축은 추가 제품 없음", () => {
    expect(selectAxisAdditions(axesWith({ A: "보통", B: "양호" }), [])).toEqual([]);
  });

  it("경계 1개 / 불량 2개 수량", () => {
    // I(골격) 경계만 — 후보 첫 제품 마그네칼D × 1
    const one = selectAxisAdditions(axesWith({ I: "경계" }), 메가영양제_기본);
    expect(one).toEqual([{ product_name: "마그네칼D", quantity: 1, axisNames: ["골격"] }]);
    // I(골격) 불량 — 같은 제품 × 2
    const two = selectAxisAdditions(axesWith({ I: "불량" }), 메가영양제_기본);
    expect(two).toEqual([{ product_name: "마그네칼D", quantity: 2, axisNames: ["골격"] }]);
  });

  it("기본 구성에 이미 포함된 제품은 건너뛴다 (중복 추가 금지)", () => {
    // A(면역) 첫 후보 프로후라바놀C300은 기본 구성 포함 → 다음 후보 부스터 C600
    const adds = selectAxisAdditions(axesWith({ A: "경계" }), 메가영양제_기본);
    expect(adds.map((a) => a.product_name)).not.toContain("프로후라바놀C300");
    expect(adds[0].product_name).toBe("부스터 C600");
  });

  it("공통 제품 우선: 불량+경계 두 축에 같이 있는 제품을 먼저 고르고, 중복은 축명 병기로 정리", () => {
    // B(순환) 불량 + C(소화) 경계 — 두 리스트 공통 제품은 폴리C
    const adds = selectAxisAdditions(axesWith({ B: "불량", C: "경계" }), 메가영양제_기본);
    expect(adds).toHaveLength(1);
    expect(adds[0].product_name).toBe("폴리C");
    expect(adds[0].quantity).toBe(2); // 불량 축이 먼저 선정 → 불량 수량
    expect(adds[0].axisNames).toEqual(["순환", "소화"]); // 중복 제거 + 축명 병기
  });

  it("불량 축이 경계 축보다 먼저 제품을 선점한다", () => {
    // G(호흡) 경계 vs H(비뇨) 불량 — 공통 제품: 프로글루카뮨 (프로후라바놀C300은 기본 구성 제외)
    const adds = selectAxisAdditions(axesWith({ G: "경계", H: "불량" }), 메가영양제_기본);
    const glu = adds.find((a) => a.product_name === "프로글루카뮨")!;
    expect(glu.quantity).toBe(2); // 불량(비뇨)이 먼저 선점한 수량
    expect(glu.axisNames[0]).toBe("비뇨");
  });
});

describe("buildTierPlan — 스펙 3~5장 구성표", () => {
  it("불량 프리미엄 = 리셋2주 + 메가영양제 (수량 합산 병합)", () => {
    const plan = buildTierPlan("불량", "premium", axesWith({ B: "불량" }));
    expect(plan.blockKeys).toEqual(["리셋2주", "메가영양제"]);
    expect(plan.resetWeeks).toBe(2);
    const qty = Object.fromEntries(plan.baseItems.map((i) => [i.product_name, i.quantity]));
    expect(qty["헬스팩"]).toBe(2); // 1 + 1
    expect(qty["바이오메가"]).toBe(4); // 2 + 2
    expect(qty["코퀴논30"]).toBe(4);
    expect(qty["프로후라바놀C300"]).toBe(4);
    expect(qty["헤파실 플러스"]).toBe(2);
    expect(qty["화이버지 플러스"]).toBe(2);
  });

  it("양호 베이직 = 헬스팩 + 바이오메가만, 리셋 없음", () => {
    const plan = buildTierPlan("양호", "basic", axesWith({}));
    expect(plan.baseItems.map((i) => i.product_name).sort()).toEqual(["바이오메가", "헬스팩"]);
    expect(plan.resetWeeks).toBe(0);
  });

  it("리셋 포함 시 뉴트리밀은 기본 구성 취급 → 축 추가 제품에서 제외", () => {
    // J(피부·모발) 불량의 후보에 '뉴트리밀 일반'이 있지만 리셋 포함 플랜에서는 추가 금지
    const plan = buildTierPlan("불량", "premium", axesWith({ J: "불량" }));
    expect(plan.additions.map((a) => a.product_name)).not.toContain("뉴트리밀 일반");
  });

  it("스펙 3장 구성표 전 조합이 유효한 블록 키를 가리킨다", () => {
    for (const grade of Object.keys(TIER_COMPOSITION_TABLE) as HealthGrade[]) {
      for (const tier of ["premium", "standard", "basic"] as const) {
        for (const key of TIER_COMPOSITION_TABLE[grade][tier]) {
          expect(COMPOSITION_BLOCKS[key]).toBeDefined();
        }
      }
    }
  });
});

describe("computeTierTotals — 스펙 11장 금액 계산", () => {
  it("정가 합계 + 뉴트리밀 → 오토십 10% 할인 → 최종 금액", () => {
    const t = computeTierTotals(100_000, 300, { unitPrice: 50_000, score: 100, quantity: 2 });
    expect(t.subtotal).toBe(200_000);
    expect(t.totalPoints).toBe(500);
    expect(t.autoshipDiscount).toBe(20_000);
    expect(t.finalPrice).toBe(180_000);
  });

  it("뉴트리밀 없으면 라인 합계만", () => {
    const t = computeTierTotals(100_000, 300, null);
    expect(t.subtotal).toBe(100_000);
    expect(t.autoshipDiscount).toBe(10_000);
  });

  it("할인 제외 품목(쉐이커/지퍼백/셀라비브) 금액은 오토십 10% 할인 대상에서 빠진다", () => {
    // 정가 150,000 중 50,000이 셀라비브 화장품 → 할인은 100,000 × 10%만 (스펙 11장)
    const t = computeTierTotals(150_000, 300, null, 50_000);
    expect(t.subtotal).toBe(150_000);
    expect(t.autoshipDiscount).toBe(10_000);
    expect(t.finalPrice).toBe(140_000);
  });

  it("예상 첫 수당 — 450점이면 기존 첫 캐쉬백 공식과 동일한 27,801원", () => {
    expect(estimateFirstCommissionKrw(450)).toBe(27_801);
    expect(estimateFirstCommissionKrw(200)).toBe(0); // 200점 이하는 0
    expect(estimateFirstCommissionKrw(0)).toBe(0);
  });
});

describe("buildAnalysisText — 스펙 9~10장 (진단 아님, 리셋 목적 구분)", () => {
  it("양호/보통 위주 → 유지·예방 톤 + 안티에이징 리셋 설명", () => {
    const text = buildAnalysisText(axesWith({ C: "보통" }), "보통");
    expect(text).toContain("건강 관리를 잘 해오신 편");
    expect(text).toContain("예방적 관리");
    expect(text).not.toContain("진단");
    expect(text).not.toContain("치료가 필요");
  });

  it("불량 포함 → 회복 관리 톤 + 우선 관리 축 명시", () => {
    const text = buildAnalysisText(axesWith({ B: "불량", C: "경계" }), "불량");
    expect(text).toContain("관리 신호가 비교적 크게");
    expect(text).toContain("회복");
    expect(text).toContain("순환"); // 불량 축이 우선 언급
  });

  it("마지막 문장은 견적 카드로 자연 연결", () => {
    const text = buildAnalysisText(axesWith({}), "양호");
    expect(text.endsWith("아래와 같은 관리 방법을 선택하실 수 있습니다.")).toBe(true);
  });
});
