export const CONTENT_CATEGORIES = [
  "health",
  "lifestyle",
  "ai_tech",
  "health_assets",
  "community",
] as const;

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

export type RecommendationMode =
  | "balanced"
  | "acquisition"
  | "conversion"
  | "shareable"
  | "brand"
  | "seasonal";

export type FunnelStage = "awareness" | "consideration" | "conversion" | "relationship";

export interface ContentMix {
  health: number;
  lifestyle: number;
  ai_tech: number;
  health_assets: number;
  community: number;
}

export interface ContentTopic {
  id: string;
  title: string;
  interestCategory: ContentCategory;
  interestSubcategory: string;
  healthAssetCodes: string[];
  audienceProblem: string;
  searchIntent: string;
  funnelStage: FunnelStage;
  contentPurpose: string;
  ctaLevel: 1 | 2 | 3 | 4;
  recommendedCta: string;
  evergreenScore: number;
  seasonalityScore: number;
  shareabilityScore: number;
  conversionScore: number;
  recommendedChannels: string[];
  recommendedFormats: string[];
}

export interface RecommendationContext {
  mix: ContentMix;
  mode: RecommendationMode;
  slots?: number;
  recentTopicIds?: string[];
}

export interface CalendarRecommendation {
  day: string;
  topic: ContentTopic;
  channel: string;
  format: string;
  score: number;
  reason: string;
}

