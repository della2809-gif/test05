import { describe, expect, it } from "vitest";
import {
  ALL_UNIFIED_SEARCH_SOURCES,
  resolveUnifiedSearchRequest,
  resolveUnifiedSearchSources,
  shouldSearchExperienceStories,
} from "./unified-search";

describe("resolveUnifiedSearchSources", () => {
  it.each([
    ["보여줄 이미지 있어?", ["images"]],
    ["관절 짧은 영상 찾아줘", ["youtube"]],
    ["림프종 사례 있어?", ["stories"]],
    ["친구에게 보낼 설명자료 링크 줘", ["links"]],
    ["체험사례 이미지 보여줘", ["stories", "images"]],
    ["헬스팩 제품 이미지 보여줘", ["images", "products"]],
    ["서큐 제품 정보 알려줘", ["products"]],
  ])("분명한 자료 유형을 해당 DB로 제한한다: %s", (query, expected) => {
    expect(resolveUnifiedSearchSources(query)).toEqual(expected);
  });

  it.each([
    "친구가 자료 보내달라는데 뭐 보내줘?",
    "관절 관련된 거 찾아줘",
    "",
  ])("자료 유형이 없으면 승인된 DB를 함께 검색한다: %s", (query) => {
    expect(resolveUnifiedSearchSources(query)).toEqual(ALL_UNIFIED_SEARCH_SOURCES);
  });

  it("영상만 요청하면 체험사례 파일럿이 먼저 나오지 않는다", () => {
    expect(shouldSearchExperienceStories("림프종 영상 보여줘")).toBe(false);
  });

  it("keeps initial-business education requests in resource search", () => {
    const result = resolveUnifiedSearchRequest("초기사업자 공부해야 하는 거 알려줘");
    expect(result.action).toBe("search");
  });

  it("keeps registered product-information questions in resource search", () => {
    expect(resolveUnifiedSearchRequest("서큐는 어디에 좋아?").action).toBe("search");
    expect(resolveUnifiedSearchRequest("헬스팩 성분과 이미지 보여줘").action).toBe("search");
  });

  it("redirects personal disease-based product recommendations for safety", () => {
    const result = resolveUnifiedSearchRequest("고지혈증 약 먹는데 어떤 영양제 먹으면 좋아?");
    expect(result.action).toBe("redirect");
  });
});
