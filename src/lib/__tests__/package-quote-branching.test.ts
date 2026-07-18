import { describe, it, expect } from "vitest";
import { decidePackageQuoteOutput, packageNameSegments } from "../package-quote-engine";

// B-3 카드 vs 텍스트 분기 결정화 —
// Package DB 정확 매칭 패키지명 = 카드 / 자유·혼합·바디용품 = 텍스트
// (00_decisions/2026-07-07_quotation_card-vs-text-branching.md)

const PACKAGES = [
  { id: "p1", name: "패키지 2주_리셋해독 2주 (프리미엄)" },
  { id: "p2", name: "패키지 4주_기본영양제 4주" },
  { id: "p3", name: "다이어트 스타터 패키지" },
];

describe("packageNameSegments — 패키지명 의미 세그먼트 추출", () => {
  it("언더스코어·괄호로 분리하고 일반어('패키지 N주')는 제외한다", () => {
    const segs = packageNameSegments("패키지 2주_리셋해독 2주 (프리미엄)");
    expect(segs).toContain("리셋해독2주");
    expect(segs).toContain("프리미엄");
    expect(segs).not.toContain("패키지2주");
  });

  it("4자 미만 세그먼트는 버린다", () => {
    expect(packageNameSegments("A_리셋")).toEqual([]);
  });
});

describe("decidePackageQuoteOutput — 결정적 분기", () => {
  it("정해진 패키지명 정확 매칭 → 카드", () => {
    const d = decidePackageQuoteOutput("리셋해독 2주 견적 부탁해요", PACKAGES);
    expect(d.mode).toBe("card");
    if (d.mode === "card") expect(d.matched.map((m) => m.id)).toEqual(["p1"]);
  });

  it("전체 이름 그대로 입력해도 카드", () => {
    const d = decidePackageQuoteOutput("패키지 4주_기본영양제 4주 알려줘", PACKAGES);
    expect(d.mode).toBe("card");
  });

  it("패키지명이 없으면 텍스트 (자유 입력)", () => {
    const d = decidePackageQuoteOutput("50만원대 다이어트 추천해줘", PACKAGES);
    expect(d).toEqual({ mode: "text", reason: "no_exact_package" });
  });

  it("패키지명 + 개별 수량 자유 입력(혼합 견적) → 텍스트", () => {
    const d = decidePackageQuoteOutput("리셋해독 2주에 헬스팩 3개 추가하면 얼마야", PACKAGES);
    expect(d).toEqual({ mode: "text", reason: "mixed_freeform" });
  });

  it("패키지명 + 바디용품·화장품 포함 → 텍스트", () => {
    const d = decidePackageQuoteOutput("리셋해독 2주랑 샴푸도 같이 견적 내줘", PACKAGES);
    expect(d).toEqual({ mode: "text", reason: "body_or_cosmetic" });
  });

  it("빈 입력 → 텍스트", () => {
    expect(decidePackageQuoteOutput("", PACKAGES).mode).toBe("text");
  });

  it("같은 입력이면 항상 같은 결과 (결정성)", () => {
    const a = decidePackageQuoteOutput("리셋해독 2주 견적", PACKAGES);
    const b = decidePackageQuoteOutput("리셋해독 2주 견적", PACKAGES);
    expect(a).toEqual(b);
  });
});
