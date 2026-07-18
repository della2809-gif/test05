export interface BloodStoryPilotCase {
  id: string;
  title: string;
  databaseType: "experience_story";
  primaryCategory: "health";
  secondaryCategory: string;
  topics: string[];
  keywords: string[];
  aliases: string[];
  usePurpose: "case_search";
  status: "pilot_ready";
  images: string[];
}

export interface BloodStorySearchResult {
  item: BloodStoryPilotCase;
  score: number;
  matchedTerms: string[];
}

function imagePaths(id: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    "/blood-story-pilot/" + id + "/page-" + String(index + 1).padStart(2, "0") + ".png"
  );
}

export const BLOOD_STORY_PILOT_CASES: BloodStoryPilotCase[] = [
  {
    id: "94", title: "림프종 사례", databaseType: "experience_story", primaryCategory: "health",
    secondaryCategory: "암·종양", topics: ["림프종"], keywords: ["림프종", "림프암", "혈액암"],
    aliases: ["임파선", "임파선암", "림프절", "림프종 사례"], usePurpose: "case_search",
    status: "pilot_ready", images: imagePaths("94", 2),
  },
  {
    id: "105", title: "림프종 4기 사례", databaseType: "experience_story", primaryCategory: "health",
    secondaryCategory: "암·종양", topics: ["림프종", "4기"], keywords: ["림프종", "림프암", "혈액암", "4기"],
    aliases: ["임파선", "임파선암", "말기 림프종", "림프종 사례"], usePurpose: "case_search",
    status: "pilot_ready", images: imagePaths("105", 3),
  },
  {
    id: "120", title: "뇌하수체 이상·쿠싱증후군·다이어트 사례", databaseType: "experience_story", primaryCategory: "health",
    secondaryCategory: "호르몬·체중", topics: ["뇌하수체", "쿠싱증후군", "다이어트"],
    keywords: ["뇌하수체", "쿠싱증후군", "다이어트", "체중감량"],
    aliases: ["쿠싱", "살이 안 빠져", "다이어트가 안 돼", "호르몬 다이어트"], usePurpose: "case_search",
    status: "pilot_ready", images: imagePaths("120", 3),
  },
  {
    id: "132", title: "심장판막 폐쇄부전증 사례", databaseType: "experience_story", primaryCategory: "health",
    secondaryCategory: "심혈관", topics: ["심장판막", "폐쇄부전증"], keywords: ["심장", "심장판막", "폐쇄부전", "심혈관"],
    aliases: ["심장이 안 좋아", "심장질환", "판막질환", "심장 사례"], usePurpose: "case_search",
    status: "pilot_ready", images: imagePaths("132", 3),
  },
  {
    id: "135", title: "변이성 급성협심증 사례", databaseType: "experience_story", primaryCategory: "health",
    secondaryCategory: "심혈관", topics: ["협심증", "심장"], keywords: ["협심증", "심장", "흉통", "심혈관"],
    aliases: ["가슴 통증", "심장이 안 좋아", "심장질환", "심장 사례"], usePurpose: "case_search",
    status: "pilot_ready", images: imagePaths("135", 4),
  },
  {
    id: "164", title: "비만·고지혈증·고혈압 사례", databaseType: "experience_story", primaryCategory: "health",
    secondaryCategory: "대사·체중", topics: ["비만", "고지혈증", "고혈압"],
    keywords: ["비만", "고지혈증", "고혈압", "다이어트", "체중감량"],
    aliases: ["콜레스테롤", "혈압", "살이 안 빠져", "다이어트가 안 돼", "고지혈증 약"], usePurpose: "case_search",
    status: "pilot_ready", images: imagePaths("164", 2),
  },
  {
    id: "166", title: "패색증·복통 사례", databaseType: "experience_story", primaryCategory: "health",
    secondaryCategory: "소화·장", topics: ["패색증", "복통"], keywords: ["복통", "장", "소화", "복부"],
    aliases: ["배가 아파", "배가 부풀어", "복부팽만", "배부품", "장폐색"], usePurpose: "case_search",
    status: "pilot_ready", images: imagePaths("166", 3),
  },
  {
    id: "197", title: "크론병 사례", databaseType: "experience_story", primaryCategory: "health",
    secondaryCategory: "소화·장", topics: ["크론병", "장질환"], keywords: ["크론병", "장", "장질환", "염증성장질환", "복통"],
    aliases: ["장이 안 좋아", "장이 안 좋았던", "장 안 좋은", "배가 아파", "장염증", "소화기 질환"], usePurpose: "case_search",
    status: "pilot_ready", images: imagePaths("197", 3),
  },
  {
    id: "241", title: "골간단연골형성이상·연골관절 사례", databaseType: "experience_story", primaryCategory: "health",
    secondaryCategory: "관절·뼈", topics: ["연골", "관절"], keywords: ["연골", "관절", "뼈", "골격"],
    aliases: ["관절이 안 좋아", "연골 문제", "무릎 관절", "관절 사례"], usePurpose: "case_search",
    status: "pilot_ready", images: imagePaths("241", 3),
  },
  {
    id: "250", title: "무릎낭종 사례", databaseType: "experience_story", primaryCategory: "health",
    secondaryCategory: "관절·뼈", topics: ["무릎", "낭종"], keywords: ["무릎", "낭종", "관절", "통증"],
    aliases: ["무릎이 아파", "무릎 통증", "무릎 물혹", "관절 사례"], usePurpose: "case_search",
    status: "pilot_ready", images: imagePaths("250", 3),
  },
];

const REQUEST_WORDS = new Set([
  "사례", "체험", "후기", "자료", "보여줘", "찾아줘", "있어", "있나요",
  "이런", "사람", "좋아져", "좋아졌어", "좋았던", "관련", "비슷한", "경우", "장이",
]);

export function normalizeSearchText(value: string): string {
  return value.toLocaleLowerCase("ko-KR").replace(/[^0-9a-z가-힣]/g, "");
}

function queryTerms(query: string): string[] {
  return query.toLocaleLowerCase("ko-KR").replace(/[^0-9a-z가-힣\s]/g, " ").split(/\s+/)
    .map((term) => term.trim()).filter((term) => term.length >= 2 && !REQUEST_WORDS.has(term));
}

function includesEither(left: string, right: string): boolean {
  const a = normalizeSearchText(left);
  const b = normalizeSearchText(right);
  return a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a));
}

export function searchBloodStories(
  query: string,
  limit = 3,
  cases: BloodStoryPilotCase[] = BLOOD_STORY_PILOT_CASES
): BloodStorySearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const normalizedQuery = normalizeSearchText(trimmed);
  const terms = queryTerms(trimmed);

  return cases.map((item) => {
    let score = 0;
    const matches = new Set<string>();
    const fields = [
      { values: [item.title], weight: 12 }, { values: item.aliases, weight: 10 },
      { values: item.keywords, weight: 8 }, { values: item.topics, weight: 7 },
      { values: [item.secondaryCategory], weight: 4 },
    ];
    for (const field of fields) {
      for (const value of field.values) {
        const normalizedValue = normalizeSearchText(value);
        if (normalizedQuery.includes(normalizedValue) && normalizedValue.length >= 2) {
          score += field.weight + 4;
          matches.add(value);
        }
        for (const term of terms) {
          if (includesEither(value, term)) {
            score += field.weight;
            matches.add(term);
          }
        }
      }
    }
    return { item, score, matchedTerms: Array.from(matches) };
  }).filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || Number(a.item.id) - Number(b.item.id))
    .slice(0, limit);
}
