import { describe, expect, it } from "vitest";
import {
  extractRegistrySearchTerms,
  formatRegistrySearchResults,
  UNIFIED_SEARCH_PREFIX,
  UNIFIED_SEARCH_ALLOWED_TABLES,
  scoreRegistrySearchRow,
  resolveRegistrySourceTables,
  type RegistrySearchRow,
} from "./content-registry-search";

function row(overrides: Partial<RegistrySearchRow>): RegistrySearchRow {
  return {
    id: "1",
    source_table: "blood_story_cases",
    source_key: "1",
    content_type: "story",
    title: "림프종 사례",
    summary: "혈통만사 원본 기반 건강 체험사례",
    resource_url: null,
    thumbnail_url: null,
    keywords: ["림프종", "혈통만사"],
    aliases: ["림프종 자료"],
    metadata: {},
    verification_status: "verified",
    content_assets: [],
    ...overrides,
  };
}

describe("content registry search", () => {
  it("limits unified search to the approved pilot DB tables", () => {
    expect(UNIFIED_SEARCH_ALLOWED_TABLES).toEqual([
      "blood_story_cases",
      "nutrition_prescription_guides",
      "supplement_product_ratings",
      "links",
      "youtube_transcripts",
      "admin_products",
      "admin_images",
    ]);
    expect(UNIFIED_SEARCH_ALLOWED_TABLES).not.toContain("experience_stories");
    expect(UNIFIED_SEARCH_ALLOWED_TABLES).not.toContain("scripts");
  });
  it("keeps 성인 intact and removes natural Korean endings", () => {
    expect(extractRegistrySearchTerms("성인 아토피 사례 보내줘")).toContain("성인");
    expect(extractRegistrySearchTerms("고도비만하고 고혈압인 사례")).toEqual(expect.arrayContaining(["고도비만", "고혈압"]));
  });

  it("splits joined atopy and allergy wording into searchable topics", () => {
    expect(extractRegistrySearchTerms("아토피알러지 사례 찾아줘")).toEqual(
      expect.arrayContaining(["아토피", "알러지"]),
    );
  });

  it("ranks the matching source and alias", () => {
    expect(scoreRegistrySearchRow(row({ aliases: ["더블엑스"] , source_table: "supplement_product_ratings" }), "더블엑스 제품 평가")).toBeGreaterThan(24);
  });

  it("does not keep an unrelated row with only a source-intent boost", () => {
    expect(scoreRegistrySearchRow(row({ title: "갑상샘암 사례", keywords: ["갑상샘암"] }), "유방암 사례 찾아줘")).toBe(0);
  });

  it("treats generic product words as stopwords so another brand does not match", () => {
    expect(scoreRegistrySearchRow(row({
      source_table: "supplement_product_ratings",
      title: "유니시티 코어 헬스 베이직스",
      keywords: ["유니시티", "영양제"],
      aliases: [],
      summary: "영양제 평가",
    }), "암웨이 영양제 평가는")).toBe(0);
  });

  it("rejects a result that matches only the generic second product term", () => {
    expect(scoreRegistrySearchRow(row({
      source_table: "admin_products",
      title: "뉴트리밀 액티브",
      keywords: ["뉴트리밀", "액티브"],
      aliases: [],
      summary: "식사대용 제품",
    }), "FOS 액티브 제품 이미지 보여줘")).toBe(0);
  });

  it("keeps a product that matches both requested product terms", () => {
    expect(scoreRegistrySearchRow(row({
      source_table: "admin_products",
      title: "FOS 에프오엑스 액티브",
      keywords: ["FOS", "에프오에스", "액티브"],
      aliases: ["FOS 액티브"],
      summary: "제품 정보",
    }), "FOS 액티브 제품 이미지 보여줘")).toBeGreaterThan(0);
  });

  it.each([
    ["유방암 사례 영상 찾아줘", ["youtube_transcripts"]],
    ["당뇨 링크 보내줘", ["links"]],
    ["암웨이 영양제 평가는", ["supplement_product_ratings"]],
    ["유사나 영양제 비교해줘", ["admin_products", "supplement_product_ratings", "admin_images"]],
    ["헬스팩 제품 이미지 보여줘", ["blood_story_cases", "nutrition_prescription_guides", "admin_products", "admin_images"]],
    ["서큐는 어디에 좋아?", ["admin_products"]],
    ["림프종 사례 보여줘", ["blood_story_cases"]],
    ["당뇨 처방전 찾아줘", ["nutrition_prescription_guides", "blood_story_cases"]],
  ])("forces explicit output intent before mixing DBs: %s", (query, expected) => {
    expect(resolveRegistrySourceTables(query, ["stories", "links", "images", "youtube", "products"])).toEqual(expected);
  });

  it("builds one structured card per item and keeps notices in detail", () => {
    const text = formatRegistrySearchResults([
      {
        ...row({
          source_table: "blood_story_cases",
          title: "림프종 사례",
          content_assets: [
            { id: "a1", asset_type: "image", page_index: 1, public_url: "https://example.com/1.jpg", file_name: "1.jpg", availability_status: "active" },
            { id: "a2", asset_type: "image", page_index: 2, public_url: "https://example.com/2.jpg", file_name: "2.jpg", availability_status: "active" },
          ],
        }),
        score: 40,
      },
      {
        ...row({
          source_table: "supplement_product_ratings",
          title: "센트룸 실버",
          supplement_rating: {
            brand_book: "Centrum",
            display_name_ko: "센트룸 실버",
            country: "US",
            edition: "4판",
            rating_score: 4,
            rating_display: "4점",
            medal_value: "Gold",
            source_page: "12",
            source_scope: "book_historical_rating",
          },
        }),
        score: 30,
      },
    ]);

    expect(text.startsWith(UNIFIED_SEARCH_PREFIX)).toBe(true);
    const payload = JSON.parse(text.slice(UNIFIED_SEARCH_PREFIX.length));
    expect(payload.results[0].images).toHaveLength(2);
    expect(payload.results[0].footerNotice).toContain("치료 효과를 보장하지 않습니다");
    expect(payload.results[1].rating.medal_value).toBe("Gold");
    expect(payload.results[1].footerNotice).toContain("책 수록 당시");
  });
  it("shows only source types that actually have remaining results", () => {
    const results = Object.assign(
      [{ ...row({ source_table: "blood_story_cases", title: "림프종 사례" }), score: 40 }],
      {
        remainingCounts: {
          blood_story_cases: 2,
          supplement_product_ratings: 0,
        },
      },
    );
    const text = formatRegistrySearchResults(results);
    const payload = JSON.parse(text.slice(UNIFIED_SEARCH_PREFIX.length));

    expect(payload.moreOptions).toEqual([
      { sourceTable: "blood_story_cases", typeLabel: "혈통만사", remaining: 2 },
    ]);
  });
  it("formats product DB rows as product cards with product details", () => {
    const text = formatRegistrySearchResults([
      {
        ...row({
          source_table: "admin_products",
          source_key: "product-1",
          title: "헬스팩",
          product_detail: {
            id: "product-1",
            product_number: "100",
            name: "헬스팩",
            price: 158000,
            score: 60,
            category: "기초영양",
            sub_category: "종합영양",
            target_audience: null,
            recommended_situation: null,
            caution: null,
            usana_iq_url: "https://example.com/product",
          },
        }),
        score: 50,
      },
    ]);
    const payload = JSON.parse(text.slice(UNIFIED_SEARCH_PREFIX.length));
    expect(payload.results[0]).toMatchObject({ typeLabel: "제품 정보", product: { price: 158000, score: 60 } });
  });
});
