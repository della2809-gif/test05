import { CONTENT_CATEGORIES } from "./types";
import type {
  CalendarRecommendation,
  ContentCategory,
  ContentMix,
  ContentTopic,
  RecommendationContext,
  RecommendationMode,
} from "./types";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

const MODE_QUALITY_WEIGHTS: Record<
  RecommendationMode,
  Pick<ContentTopic, "evergreenScore" | "seasonalityScore" | "shareabilityScore" | "conversionScore">
> = {
  balanced: { evergreenScore: 0.35, seasonalityScore: 0.15, shareabilityScore: 0.25, conversionScore: 0.25 },
  acquisition: { evergreenScore: 0.3, seasonalityScore: 0.15, shareabilityScore: 0.4, conversionScore: 0.15 },
  conversion: { evergreenScore: 0.15, seasonalityScore: 0.1, shareabilityScore: 0.15, conversionScore: 0.6 },
  shareable: { evergreenScore: 0.15, seasonalityScore: 0.15, shareabilityScore: 0.6, conversionScore: 0.1 },
  brand: { evergreenScore: 0.3, seasonalityScore: 0.05, shareabilityScore: 0.2, conversionScore: 0.45 },
  seasonal: { evergreenScore: 0.15, seasonalityScore: 0.6, shareabilityScore: 0.15, conversionScore: 0.1 },
};

const MODE_CATEGORY_BONUS: Record<RecommendationMode, Partial<Record<ContentCategory, number>>> = {
  balanced: {},
  acquisition: { lifestyle: 12, ai_tech: 14, community: 6 },
  conversion: { health: 8, health_assets: 15 },
  shareable: { lifestyle: 8, community: 16 },
  brand: { health_assets: 20, health: 5 },
  seasonal: { lifestyle: 8, health: 6, community: 5 },
};

export function validateContentMix(mix: ContentMix): boolean {
  return (
    CONTENT_CATEGORIES.every(
      (category) => Number.isFinite(mix[category]) && mix[category] >= 0 && mix[category] <= 100,
    ) &&
    CONTENT_CATEGORIES.reduce((sum, category) => sum + mix[category], 0) === 100
  );
}

export function calculateCategoryQuotas(mix: ContentMix, slots: number): Record<ContentCategory, number> {
  const safeSlots = Math.max(1, Math.floor(slots));
  const exact = CONTENT_CATEGORIES.map((category) => ({
    category,
    exact: (mix[category] / 100) * safeSlots,
  }));
  const quotas = Object.fromEntries(
    exact.map(({ category, exact: value }) => [category, Math.floor(value)]),
  ) as Record<ContentCategory, number>;

  let remaining = safeSlots - Object.values(quotas).reduce((sum, value) => sum + value, 0);
  const byRemainder = [...exact].sort(
    (a, b) => (b.exact % 1) - (a.exact % 1) || CONTENT_CATEGORIES.indexOf(a.category) - CONTENT_CATEGORIES.indexOf(b.category),
  );
  for (let index = 0; remaining > 0; index += 1, remaining -= 1) {
    quotas[byRemainder[index % byRemainder.length].category] += 1;
  }
  return quotas;
}

export function scoreTopic(topic: ContentTopic, mode: RecommendationMode): number {
  const weights = MODE_QUALITY_WEIGHTS[mode];
  const quality =
    topic.evergreenScore * weights.evergreenScore +
    topic.seasonalityScore * weights.seasonalityScore +
    topic.shareabilityScore * weights.shareabilityScore +
    topic.conversionScore * weights.conversionScore;
  const categoryBonus = MODE_CATEGORY_BONUS[mode][topic.interestCategory] ?? 0;
  const purposeBonus =
    mode === "acquisition" && topic.contentPurpose.includes("유입")
      ? 8
      : mode === "brand" && topic.contentPurpose.includes("브랜드")
        ? 8
        : 0;
  return Math.round((quality + categoryBonus + purposeBonus) * 10) / 10;
}

export function rankTopics(
  topics: ContentTopic[],
  mode: RecommendationMode,
  recentTopicIds: string[] = [],
): Array<{ topic: ContentTopic; score: number }> {
  const recent = new Set(recentTopicIds);
  return topics
    .filter((topic) => !recent.has(topic.id))
    .map((topic) => ({ topic, score: scoreTopic(topic, mode) }))
    .sort((a, b) => b.score - a.score || a.topic.title.localeCompare(b.topic.title, "ko"));
}

function buildReason(topic: ContentTopic, mode: RecommendationMode): string {
  if (mode === "acquisition") return `${topic.interestSubcategory} 관심에서 건강자산으로 자연스럽게 연결`;
  if (mode === "conversion") return `전환 가능성 ${topic.conversionScore}점 · CTA ${topic.ctaLevel}단계`;
  if (mode === "shareable") return `공유성 ${topic.shareabilityScore}점 · 함께 참여하기 좋은 주제`;
  if (mode === "brand") return `건강자산 개념과 WELLSET의 관점을 설명하는 주제`;
  if (mode === "seasonal") return `시즌 적합도 ${topic.seasonalityScore}점`;
  return `운영 비율과 콘텐츠 품질 점수를 함께 반영`;
}

export function generateWeeklyCalendar(
  topics: ContentTopic[],
  context: RecommendationContext,
): CalendarRecommendation[] {
  const slots = Math.min(Math.max(context.slots ?? 7, 1), DAYS.length);
  if (!validateContentMix(context.mix)) {
    throw new Error("콘텐츠 운영 비율의 합계는 100이어야 합니다.");
  }

  const quotas = calculateCategoryQuotas(context.mix, slots);
  const ranked = rankTopics(topics, context.mode, context.recentTopicIds);
  const selected: Array<{ topic: ContentTopic; score: number }> = [];

  for (const category of CONTENT_CATEGORIES) {
    selected.push(
      ...ranked.filter(({ topic }) => topic.interestCategory === category).slice(0, quotas[category]),
    );
  }

  if (selected.length < slots) {
    const selectedIds = new Set(selected.map(({ topic }) => topic.id));
    selected.push(...ranked.filter(({ topic }) => !selectedIds.has(topic.id)).slice(0, slots - selected.length));
  }

  return selected
    .sort((a, b) => b.score - a.score)
    .slice(0, slots)
    .map(({ topic: selectedTopic, score }, index) => ({
      day: DAYS[index],
      topic: selectedTopic,
      channel: selectedTopic.recommendedChannels[index % selectedTopic.recommendedChannels.length],
      format: selectedTopic.recommendedFormats[index % selectedTopic.recommendedFormats.length],
      score,
      reason: buildReason(selectedTopic, context.mode),
    }));
}

