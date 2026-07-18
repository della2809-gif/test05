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

function createSupabaseMock(rowsByTable: Record<string, unknown[]> = {}) {
  return {
    from: vi.fn((table: string) => new QueryMock(table, rowsByTable)),
  };
}

describe("generateAIResponse health counseling policy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not inject a hard-coded health safety policy", async () => {
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

    await generateAIResponse({
      messages: [{ role: "user", content: "약 먹는 사람이 C300 메가로 먹어도 돼?" }],
      userId: "user-1",
      supabase: createSupabaseMock({ memories: [] }) as never,
      gipletType: "general",
      systemPromptOverride: "기본 프롬프트",
      dbSourcesOverride: [],
    });

    expect(capturedSystemPrompt).not.toContain("진단·치료는 의료진 영역");
    expect(capturedSystemPrompt).not.toContain("제품이나 패키지를 치료·개선·완화·예방 수단으로 추천하지 마세요");
    expect(capturedSystemPrompt).not.toContain("자동 메가 추천 금지");
  });
});
