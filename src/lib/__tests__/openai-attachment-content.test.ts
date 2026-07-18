import { afterEach, describe, expect, it, vi } from "vitest";

import { generateAIResponse } from "../openai";

// 첨부(파일/이미지) 전송 시 라우트가 마지막 user 메시지 content를 멀티모달 배열로 바꿔 넣는다.
// buildSystemPrompt가 이 배열을 문자열처럼 다뤄 .replace에서 TypeError가 나면
// 첨부 메시지의 AI 응답이 통째로 생성되지 않는다(#19). 이 회귀를 막는다.

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

describe("generateAIResponse with multimodal (attachment) content", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not crash and still sends the request when the last user message content is a multimodal array", async () => {
    let capturedUserContent: unknown = undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}"));
        capturedUserContent = body.messages?.[1]?.content;
        return new Response(JSON.stringify({ choices: [{ message: { content: "정리 결과" } }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      })
    );

    const supabase = createSupabaseMock({ admin_products: [], memories: [] });

    // 라우트가 만들어 넣는 것과 동일한 형태: 파일 텍스트 + 이미지
    const multimodalContent = [
      { type: "text", text: "정리해줘\n\n[파일: memo.txt]\n오메가 재고 확인 필요" },
      { type: "image_url", image_url: { url: "https://example.com/a.png" } },
    ] as unknown as string;

    const result = await generateAIResponse({
      messages: [{ role: "user", content: multimodalContent }],
      userId: "user-1",
      supabase: supabase as never,
      gipletType: "general",
      systemPromptOverride: "기본 프롬프트",
      dbSourcesOverride: ["products"],
    });

    expect(result).toBe("정리 결과");
    // 멀티모달 배열은 그대로 OpenAI에 전달되어야 한다 (텍스트로 뭉개지지 않음)
    expect(Array.isArray(capturedUserContent)).toBe(true);
  });
});
