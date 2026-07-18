import { describe, it, expect } from "vitest";
import { parseQuoteQuery, isQuoteQuery, resolveProduct } from "../package-quote-engine";

describe("parseQuoteQuery — 예산 파싱", () => {
  it("50만원 → 500,000원, around", () => {
    const q = parseQuoteQuery("50만원 정도 패키지 추천해줘");
    expect(q.budgetKrw).toBe(500_000);
    expect(q.budgetMode).toBe("around");
  });
  it("100만원 이하 → max 모드", () => {
    const q = parseQuoteQuery("100만원 이하로 견적 내줘");
    expect(q.budgetKrw).toBe(1_000_000);
    expect(q.budgetMode).toBe("max");
  });
  it("1백만원 → 1,000,000원", () => {
    const q = parseQuoteQuery("1백만원 예산이야");
    expect(q.budgetKrw).toBe(1_000_000);
  });
  it("예산 없으면 null", () => {
    expect(parseQuoteQuery("리셋 패키지 알려줘").budgetKrw).toBeNull();
  });
});

describe("parseQuoteQuery — 목적 키워드", () => {
  it("리셋/다이어트 키워드 감지", () => {
    const q = parseQuoteQuery("리셋 해독 2주 다이어트 패키지 견적");
    expect(q.keywords).toContain("리셋");
    expect(q.keywords).toContain("해독");
    expect(q.keywords).toContain("다이어트");
  });
  it("견적 의도어만 있으면 키워드 없음 → 견적 질의 아님", () => {
    const q = parseQuoteQuery("패키지 견적 추천해줘");
    expect(q.keywords).toEqual([]);
    expect(isQuoteQuery(q)).toBe(false);
  });
  it("예산만 있어도 견적 질의로 판정", () => {
    expect(isQuoteQuery(parseQuoteQuery("50만원으로 뭐 있어?"))).toBe(true);
  });
});

describe("resolveProduct — 제품명 해석", () => {
  const products = [
    { name: "헬스팩", price: 158000, score: 60, usana_iq_url: null, aliases: null },
    { name: "화이버지 플러스", price: 40000, score: 15, usana_iq_url: null, aliases: "화이버지" },
    { name: "바이오메가", price: 45000, score: 18, usana_iq_url: null, aliases: "오메가3, 오메가" },
    { name: "뉴트리밀", price: 60000, score: 20, usana_iq_url: null, aliases: null },
  ];
  it("정확 일치", () => {
    expect(resolveProduct("헬스팩", products)?.name).toBe("헬스팩");
  });
  it("별칭 일치 (화이버지 → 화이버지 플러스)", () => {
    expect(resolveProduct("화이버지", products)?.name).toBe("화이버지 플러스");
  });
  it("별칭 일치 (오메가3 → 바이오메가)", () => {
    expect(resolveProduct("오메가3", products)?.name).toBe("바이오메가");
  });
  it("JSON 배열 형식 별칭 일치 (라이브 DB 형식)", () => {
    const jsonProducts = [
      { name: "코퀴논30", price: 90000, score: 30, usana_iq_url: null, aliases: '["코큐론30","코큐논30","CoQuinone"]' },
    ];
    expect(resolveProduct("코큐론30", jsonProducts)?.name).toBe("코퀴논30");
  });
  it("접두 일치 (뉴트리밀 일반 → 뉴트리밀)", () => {
    expect(resolveProduct("뉴트리밀 일반", products)?.name).toBe("뉴트리밀");
  });
  it("미해석 시 null (조용히 누락하지 않고 unresolved로 표시하기 위함)", () => {
    expect(resolveProduct("없는제품", products)).toBeNull();
  });
});
