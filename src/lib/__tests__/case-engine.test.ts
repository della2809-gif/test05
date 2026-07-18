import { describe, expect, it } from "vitest";
import { parseCaseMarkers, hasContextChanged, formatGuideSteps, getGuideStepGipletKeys } from "../case-engine";

describe("case-engine helpers", () => {
  it("extracts structured context JSON and removes internal markers", () => {
    const raw = `정리했습니다.\n__CTX_JSON__:{"name":"홍길동","age":"40대"}:__CTX_JSON_END__\n__CTX_DONE__`;

    const parsed = parseCaseMarkers(raw, { name: "기존" });

    expect(parsed.content).toBe("정리했습니다.");
    expect(parsed.updatedContext).toEqual({ name: "홍길동", age: "40대", _ctx_complete: true });
    expect(parsed.done).toBe(true);
  });

  it("reports context changes even when case step does not change", () => {
    expect(hasContextChanged({ name: "홍길동" }, { name: "김철수" })).toBe(true);
    expect(hasContextChanged({ name: "홍길동" }, { name: "홍길동" })).toBe(false);
  });

  it("formats guide steps as a numbered workflow", () => {
    expect(formatGuideSteps(["건강 상태 확인", "자동 견적", "회원 등록"])).toContain("1. 건강 상태 확인");
    expect(formatGuideSteps([])).toBe("");
  });

  it("formats per-step descriptions, collection items, and linked giplets", () => {
    const formatted = formatGuideSteps(
      [
        {
          title: "자동 견적 생성",
          description: "고객 상황에 맞는 제품 조합을 제안합니다.",
          collection_items_text: "예산\n섭취 대상",
          linked_giplets: ["auto_quote", "product_recommendation"],
        },
      ],
      { auto_quote: "자동 견적", product_recommendation: "제품 추천" },
    );

    expect(formatted).toContain("1. 자동 견적 생성");
    expect(formatted).toContain("설명: 고객 상황에 맞는 제품 조합을 제안합니다.");
    expect(formatted).toContain("수집 항목:\n  - 예산\n  - 섭취 대상");
    // 내부 키 대신 사람이 읽는 이름으로 매핑되어야 한다 (키 노출 방지)
    expect(formatted).toContain("이 단계에서 활용할 자료: 자동 견적, 제품 추천");
    expect(formatted).not.toContain("auto_quote");
  });

  it("uses only step-level linked giplets for case workflows", () => {
    expect(getGuideStepGipletKeys([
      { title: "기본 정보", linked_giplets: ["general", "faq"] },
      { title: "자동 견적", linked_giplets: ["quotation", "faq"] },
      { title: "후속 관리" },
    ])).toEqual(["general", "faq", "quotation"]);
  });
});
