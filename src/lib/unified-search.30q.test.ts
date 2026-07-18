import { describe, expect, it } from "vitest";
import {
  ALL_UNIFIED_SEARCH_SOURCES,
  resolveUnifiedSearchRequest,
  type UnifiedSearchSource,
  type UnifiedSearchTopic,
} from "./unified-search";

type SearchCase = [string, UnifiedSearchSource[], UnifiedSearchTopic];

const searchCases: SearchCase[] = [
  ["이런 경우 있어?", ["stories"], null],
  ["이런 사람들도 좋아진 사례 있어?", ["stories"], null],
  ["그런 케이스 좀 보여줄래?", ["stories"], null],
  ["관절 관련 사례 있어?", ["stories"], "joint"],
  ["무릎 아픈 사람 사례 좀 찾아줘", ["stories"], "joint"],
  ["장이 안 좋았던 사람 사례 있어?", ["stories"], "gut"],
  ["변비 관련 케이스 보여줘", ["stories"], "gut"],
  ["친구가 자료 보내달라는데 뭐 보내줘?", ALL_UNIFIED_SEARCH_SOURCES, null],
  ["관절 때문에 친구한테 보낼 거 있어?", ALL_UNIFIED_SEARCH_SOURCES, "joint"],
  ["장 건강 자료 좀 보내줘", ALL_UNIFIED_SEARCH_SOURCES, "gut"],
  ["관절 보여줄 이미지 있어?", ["images"], "joint"],
  ["무릎 카드뉴스 찾아줘", ["images"], "joint"],
  ["연골 관련 사진 보여줘", ["images"], "joint"],
  ["장 건강 이미지 있어?", ["images"], "gut"],
  ["변비 관련 그림 찾아줘", ["images"], "gut"],
  ["관절 설명하는 영상 있어?", ["youtube"], "joint"],
  ["무릎 짧은 영상 보여줘", ["youtube"], "joint"],
  ["장 건강 유튜브 찾아줘", ["youtube"], "gut"],
  ["배변 관련 동영상 있어?", ["youtube"], "gut"],
  ["관절 관련 링크 줘", ["links"], "joint"],
  ["무릎 설명자료 찾아줘", ["links"], "joint"],
  ["장 건강 설명자료 있어?", ["links"], "gut"],
  ["변비 관련 주소만 줘", ["links"], "gut"],
  ["관절 자료 찾아줘", ALL_UNIFIED_SEARCH_SOURCES, "joint"],
  ["서큐는 어디에 좋아?", ["products"], null],
];

describe("통합 자료찾기 실제 질문 30개", () => {
  it.each(searchCases)("검색 유형과 주제를 판정한다: %s", (query, sources, topic) => {
    expect(resolveUnifiedSearchRequest(query)).toEqual({ action: "search", sources, topic });
  });

  it.each([
    ["뭐 먹으면 돼?", "health_product"],
    ["이거랑 이거랑 견적 어떻게 돼?", "action_calculator"],
    ["퓨처 빌더 이번 주 몇 점 필요해?", "action_calculator"],
    ["네트워크 하는 사람한테 뭐부터 얘기해?", "meeting_business"],
  ])("범위 밖 질문을 해당 기능으로 넘긴다: %s", (query, target) => {
    expect(resolveUnifiedSearchRequest(query)).toMatchObject({ action: "redirect", target });
  });

  it("없는 자료와 링크를 만들어 달라는 요청을 거부한다", () => {
    expect(resolveUnifiedSearchRequest("없는 자료도 만들어서 링크 줘")).toMatchObject({
      action: "reject",
      target: null,
    });
  });
});
