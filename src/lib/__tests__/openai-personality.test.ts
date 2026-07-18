import { afterEach, describe, expect, it, vi } from "vitest";

import { generateAIResponse } from "../openai";

// 고객 성향 반영(2026-07-03) — 성향의 주체는 '고객'이다. 검증 포인트:
// 1) 고객 성향 활용 규칙이 항상 주입된다((a)(b)(c) 절차 + 되묻기 질문 + 톤/포맷 가드).
// 2) 대화에 저장 회원 이름이 등장하면 그 회원의 성향이 컨텍스트에 주입된다(계층 C).

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

async function capturePrompt(opts: {
  message?: string;
  rowsByTable?: Record<string, unknown[]>;
} = {}): Promise<string> {
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
    messages: [{ role: "user", content: opts.message ?? "고객 응대 문구 정리해줘" }],
    userId: "user-1",
    supabase: createSupabaseMock({ memories: [], ...(opts.rowsByTable ?? {}) }) as never,
    gipletType: "general",
    systemPromptOverride: "기본 프롬프트",
    dbSourcesOverride: [],
  });

  return capturedSystemPrompt;
}

describe("고객 성향 반영 규칙 주입", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("항상 고객 성향 활용 규칙을 주입한다 (성향의 주체=고객)", async () => {
    const prompt = await capturePrompt();
    expect(prompt).toContain("고객 성향 반영 규칙");
    expect(prompt).toContain("고객 발송 문구");
  });

  it("모를 때 되묻는 확인 질문 문구를 포함한다 (기본톤 1차 출력 + 되묻기)", async () => {
    const prompt = await capturePrompt();
    expect(prompt).toContain("논리적/감성적/실용적 중 어느 쪽에 가까운가요");
  });

  it("3종 톤 기준(논리=근거 / 감성=공감 / 실용=체크리스트)을 포함한다", async () => {
    const prompt = await capturePrompt();
    expect(prompt).toContain("근거");
    expect(prompt).toContain("공감");
    expect(prompt).toContain("체크리스트");
  });

  it("성향은 발송 문구 톤에만 적용하고 직원용 섹션·고정 포맷은 중립 유지한다", async () => {
    const prompt = await capturePrompt();
    expect(prompt).toContain("직원용 섹션");
    expect(prompt).toContain("'DB 확인:' 규칙");
    expect(prompt).toContain("건강 안전기준은 성향과 무관하게 항상 우선");
  });

  it("대화에 저장 회원 이름이 등장하면 그 회원의 성향을 컨텍스트에 주입한다 (계층 C)", async () => {
    const prompt = await capturePrompt({
      message: "홍길동님한테 보낼 문구 정리해줘",
      rowsByTable: {
        contacts: [{ name: "홍길동", personality: "emotional", member_status: "섭취중", care_mode: "집중", notes: null }],
      },
    });
    expect(prompt).toContain("[회원 정보");
    expect(prompt).toContain("홍길동");
    expect(prompt).toContain("감성적");
  });

  it("회원 성향이 미저장(null)이면 '미파악'으로 표기해 되묻도록 한다", async () => {
    const prompt = await capturePrompt({
      message: "홍길동님한테 보낼 문구 정리해줘",
      rowsByTable: {
        contacts: [{ name: "홍길동", personality: null, member_status: "섭취중", care_mode: "집중", notes: null }],
      },
    });
    expect(prompt).toContain("홍길동");
    expect(prompt).toContain("미파악");
  });
});
