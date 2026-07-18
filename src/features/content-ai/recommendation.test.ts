import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT_MIX, DEFAULT_CONTENT_TOPICS } from "./data";
import {
  calculateCategoryQuotas,
  generateWeeklyCalendar,
  rankTopics,
  validateContentMix,
} from "./recommendation";

describe("content-ai recommendation", () => {
  it("운영 비율 합계가 100일 때만 유효하다", () => {
    expect(validateContentMix(DEFAULT_CONTENT_MIX)).toBe(true);
    expect(validateContentMix({ ...DEFAULT_CONTENT_MIX, health: 39 })).toBe(false);
  });

  it("7개 슬롯을 가장 가까운 카테고리 비율로 배분한다", () => {
    const quotas = calculateCategoryQuotas(DEFAULT_CONTENT_MIX, 7);
    expect(Object.values(quotas).reduce((sum, value) => sum + value, 0)).toBe(7);
    expect(quotas.health).toBe(3);
    expect(quotas.lifestyle).toBe(1);
  });

  it("최근 발행한 주제는 추천에서 제외한다", () => {
    const recentId = "health-after-meal-sleepiness";
    const calendar = generateWeeklyCalendar(DEFAULT_CONTENT_TOPICS, {
      mix: DEFAULT_CONTENT_MIX,
      mode: "balanced",
      recentTopicIds: [recentId],
    });
    expect(calendar).toHaveLength(7);
    expect(calendar.some(({ topic }) => topic.id === recentId)).toBe(false);
  });

  it("추천 결과에 채널·형식·CTA·추천 이유를 포함한다", () => {
    const [item] = generateWeeklyCalendar(DEFAULT_CONTENT_TOPICS, {
      mix: DEFAULT_CONTENT_MIX,
      mode: "conversion",
    });
    expect(item.channel).toBeTruthy();
    expect(item.format).toBeTruthy();
    expect(item.topic.recommendedCta).toBeTruthy();
    expect(item.reason).toContain("전환 가능성");
  });

  it("신규 유입 모드는 AI와 라이프스타일 주제에 가산점을 준다", () => {
    const ranked = rankTopics(DEFAULT_CONTENT_TOPICS, "acquisition");
    const topFiveCategories = ranked.slice(0, 5).map(({ topic }) => topic.interestCategory);
    expect(topFiveCategories.some((category) => category === "ai_tech" || category === "lifestyle")).toBe(true);
  });
});

