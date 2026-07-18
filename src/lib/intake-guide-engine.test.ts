import { describe, expect, it } from "vitest";
import { composeIntakeGuide, matchIntakeProducts, resolveIntakeProgram } from "./intake-guide-engine";

const products = [
  { id: "p1", name: "헬스팩", aliases: '["셀센셜즈","유사나팩"]', caution: "표시사항을 확인하세요." },
  { id: "p2", name: "프로바이오틱", aliases: "유산균, 프로바이오틱스", caution: null },
];
const guide = {
  id: "g1", product_id: "p1", program_type: "general" as const, dose_mode: "standard" as const,
  dose_text: "공식 표시량", time_labels: ["아침", "저녁"], meal_relation: "식사와 함께",
  instructions: ["물과 함께 섭취"], required_notices: ["표시된 섭취량 준수"], cautions: ["이상 반응 시 중단"],
  source_label: "공식 제품 라벨", source_url: null, source_version: "2026-07",
  availability_status: "active" as const, verification_status: "verified" as const, approval_status: "approved" as const,
};

describe("intake guide engine", () => {
  it("제품명과 JSON/쉼표 별칭을 찾는다", () => expect(matchIntakeProducts("유사나팩이랑 유산균 먹는 방법", products).map((x) => x.id)).toEqual(["p1", "p2"]));
  it("프로그램과 배량 의도를 분리한다", () => expect(resolveIntakeProgram("리셋 집중 섭취표")).toEqual({ programType: "reset", doseMode: "enhanced" }));
  it("검증·승인된 공식 행만 카드로 만든다", () => {
    const result = composeIntakeGuide("엄마 헬스팩 섭취방법 카드", products, [guide]);
    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.payload.items[0].doseText).toBe("공식 표시량");
  });
  it("미승인 행은 카드로 만들지 않는다", () => expect(composeIntakeGuide("헬스팩 섭취방법", products, [{ ...guide, approval_status: "pending" }]).status).toBe("missing_verified_guide"));
  it("질환·복용약 위험 신호는 확인을 우선한다", () => expect(composeIntakeGuide("심장약 먹는 엄마 헬스팩 섭취방법", products, [guide]).status).toBe("safety_review"));
});
