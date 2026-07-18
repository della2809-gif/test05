import { afterEach, describe, expect, it, vi } from "vitest";

import { generateAIResponse } from "../openai";
import { COMMISSION_TRAVEL_DISCLAIMER } from "../constants";

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

async function capturePrompt(params: {
  gipletType: string;
  content: string;
  dbSources: string[];
  rows?: Record<string, unknown[]>;
}): Promise<string> {
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
    messages: [{ role: "user", content: params.content }],
    userId: "user-1",
    supabase: createSupabaseMock({ memories: [], ...(params.rows ?? {}) }) as never,
    gipletType: params.gipletType,
    systemPromptOverride: "기본 프롬프트",
    dbSourcesOverride: params.dbSources,
  });

  return capturedSystemPrompt;
}

describe("giplet 안전문구·PV·관리자 우선순위 프롬프트 조립", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("수당(commission) 지플릿 프롬프트에 필수 안전문구를 항상 주입한다 (검수 #32)", async () => {
    const prompt = await capturePrompt({
      gipletType: "commission",
      content: "수당 계산해줘",
      dbSources: ["calculations"],
    });
    expect(prompt).toContain(COMMISSION_TRAVEL_DISCLAIMER);
    expect(prompt).toContain("필수 안전문구(수당·여행)");
  });

  it("여행(travel) 지플릿 프롬프트에 필수 안전문구를 항상 주입한다 (검수 #33)", async () => {
    const prompt = await capturePrompt({
      gipletType: "travel",
      content: "여행 달성 계산해줘",
      dbSources: ["calculations"],
    });
    expect(prompt).toContain(COMMISSION_TRAVEL_DISCLAIMER);
  });

  it("일반(general) 지플릿에는 수당·여행 안전문구를 주입하지 않는다 (회귀 방지)", async () => {
    const prompt = await capturePrompt({
      gipletType: "general",
      content: "안녕하세요",
      dbSources: [],
    });
    expect(prompt).not.toContain("필수 안전문구(수당·여행)");
  });

  it("관리자 시스템 프롬프트 우선순위 지시를 항상 포함한다 (검수 #29)", async () => {
    const prompt = await capturePrompt({
      gipletType: "general",
      content: "안녕하세요",
      dbSources: [],
    });
    expect(prompt).toContain("우선순위 규칙");
    expect(prompt).toContain("관리자 시스템 프롬프트");
    // 기존 4단 포맷 기본 동작 유지 확인
    expect(prompt).toContain("1) 상담 판단");
  });

  it("제품 컨텍스트에 PV 표기 지시와 각 제품 PV 값을 함께 싣는다 (검수 #9)", async () => {
    const prompt = await capturePrompt({
      gipletType: "quotation",
      content: "헬스팩 견적 내줘",
      dbSources: ["products"],
      rows: {
        admin_products: [
          {
            name: "헬스팩",
            price: 158000,
            score: 42,
            description: "종합영양",
            keywords: "헬스팩",
            symptoms: "",
            category: "제품",
            tags: "헬스팩",
            aliases: "",
            usana_iq_url: "",
          },
        ],
      },
    });
    expect(prompt).toContain("PV(점수)를 가격과 함께");
    expect(prompt).toContain("총 PV 합계");
    expect(prompt).toContain("42PV");
  });
});
