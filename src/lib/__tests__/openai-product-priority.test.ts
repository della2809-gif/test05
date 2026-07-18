import { afterEach, describe, expect, it, vi } from "vitest";

import { generateAIResponse } from "../openai";

class QueryMock {
  private table: string;
  private rowsByTable: Record<string, unknown[]>;

  constructor(table: string, rowsByTable: Record<string, unknown[]>) {
    this.table = table;
    this.rowsByTable = rowsByTable;
  }

  select() { return this; }
  eq() { return this; }
  or() { return this; }
  order() { return this; }
  limit() { return this; }

  then(resolve: (value: { data: unknown[]; error: null }) => void) {
    return Promise.resolve({ data: this.rowsByTable[this.table] ?? [], error: null }).then(resolve);
  }
}

function createSupabaseMock(rowsByTable: Record<string, unknown[]>) {
  return {
    from: vi.fn((table: string) => new QueryMock(table, rowsByTable)),
  };
}

describe("generateAIResponse product context priority", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("puts exact product DB matches before package candidates in the system prompt for general product questions", async () => {
    let capturedSystemPrompt = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}"));
        capturedSystemPrompt = body.messages?.[0]?.content ?? "";
        return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      })
    );

    const supabase = createSupabaseMock({
      admin_products: [
        {
          name: "헬스팩",
          price: 150000,
          description: "종합영양 제품",
          keywords: "헬스팩 국민영양팩",
          symptoms: "",
          category: "제품",
          tags: "헬스팩",
          aliases: "국민영양팩",
          usana_iq_url: "https://example.com/healthpak",
        },
      ],
      admin_packages: [
        {
          name: "헬스팩 집중 패키지",
          category: "상담 패키지",
          price: 200000,
          score: 100,
          benefit: "헬스팩 포함",
          purpose: "",
          discount_rate: 0,
          tags: ["헬스팩"],
          components: [{ name: "헬스팩" }],
        },
      ],
      memories: [],
    });

    await generateAIResponse({
      messages: [{ role: "user", content: "헬스팩 알려줘" }],
      userId: "user-1",
      supabase: supabase as never,
      gipletType: "general",
      systemPromptOverride: "기본 프롬프트",
      dbSourcesOverride: ["packages", "products"],
    });

    const productIndex = capturedSystemPrompt.indexOf("[제품 정보]");
    const packageIndex = capturedSystemPrompt.indexOf("[패키지 DB");

    expect(productIndex).toBeGreaterThanOrEqual(0);
    expect(packageIndex).toBeGreaterThanOrEqual(0);
    expect(productIndex).toBeLessThan(packageIndex);
    expect(capturedSystemPrompt).toContain("DB 확인");
    expect(capturedSystemPrompt).toContain("헬스팩 (150000원)");
  });
});
