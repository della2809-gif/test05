import { afterEach, describe, expect, it, vi } from "vitest";

import { generateAIResponse } from "../openai";

// 2026-07-07 C-5/C-4/C-2 프롬프트 조립 검증:
// 1) 자료 조회성 질문(보여줘/찾아줘…)은 채팅 경로(emptySearchFallback)에서 4단 포맷을 생략하고
//    자료 즉시 출력 프롬프트(STAFF_DATA_LOOKUP_PROMPT)로 조립된다.
// 2) 상담성 질문은 기존 4단(STAFF_ASSISTANT_PROMPT)을 유지한다.
// 3) 번호 선택 후속턴("3번")은 직전 어시스턴트 답변의 [IMAGE:URL] 목록을 재주입한다.
// 4) 이미지·링크 URL 창작 금지 가드(IMAGE_URL_GUARD)는 모든 조립 경로에 공통 주입된다.

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
  in() { return this; }
  ilike() { return this; }
  order() { return this; }
  limit() { return this; }
  maybeSingle() {
    return Promise.resolve({ data: null, error: null });
  }

  then(resolve: (value: { data: unknown[]; error: null }) => void) {
    return Promise.resolve({ data: this.rowsByTable[this.table] ?? [], error: null }).then(resolve);
  }
}

function createSupabaseMock(rowsByTable: Record<string, unknown[]> = {}) {
  return {
    from: vi.fn((table: string) => new QueryMock(table, rowsByTable)),
    rpc: vi.fn(async () => ({ data: [], error: null })),
  };
}

async function capturePrompt(opts: {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  emptySearchFallback?: boolean;
  promptProfile?: "staff" | "coaching";
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
    messages: opts.messages,
    userId: "user-1",
    supabase: createSupabaseMock({ memories: [] }) as never,
    gipletType: "general",
    systemPromptOverride: "기본 프롬프트",
    dbSourcesOverride: [],
    emptySearchFallback: opts.emptySearchFallback ?? true,
    ...(opts.promptProfile ? { promptProfile: opts.promptProfile } : {}),
  });

  return capturedSystemPrompt;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("C-5 자료 조회성 질문 4단 생략", () => {
  it("'원고 보여줘' 류 조회 질문이면 4단 포맷 대신 자료 즉시 출력 프롬프트를 쓴다", async () => {
    const prompt = await capturePrompt({
      messages: [{ role: "user", content: "사업설명 원고 6번 보여줘" }],
    });
    expect(prompt).toContain("자료(원고·스크립트·사례·이미지·링크·영상 등) 조회 요청");
    expect(prompt).not.toContain("반드시 다음 제목을 그대로 사용해 답하세요: '1) 상담 판단'");
  });

  it("상담성 질문이면 기존 4단 포맷을 유지한다", async () => {
    const prompt = await capturePrompt({
      messages: [{ role: "user", content: "혈압약 드시는 고객님이 영양제 여쭤보시는데 어떻게 안내할까요?" }],
    });
    expect(prompt).toContain("'1) 상담 판단', '2) 추천 방향', '3) 고객 발송 문구', '4) 추가 확인 질문'");
    expect(prompt).not.toContain("자료(원고·스크립트·사례·이미지·링크·영상 등) 조회 요청");
  });

  it("채팅 generic 경로가 아니면(emptySearchFallback 미설정) 조회 질문이어도 4단을 유지한다", async () => {
    const prompt = await capturePrompt({
      messages: [{ role: "user", content: "사례 자료 보여줘" }],
      emptySearchFallback: false,
    });
    expect(prompt).toContain("'1) 상담 판단', '2) 추천 방향', '3) 고객 발송 문구', '4) 추가 확인 질문'");
  });

  it("코칭 프로필은 조회 질문이어도 코칭 규칙을 유지한다(건드리지 않음)", async () => {
    const prompt = await capturePrompt({
      messages: [{ role: "user", content: "자료 보여줘" }],
      promptProfile: "coaching",
    });
    expect(prompt).toContain("코칭 대화 규칙");
    expect(prompt).not.toContain("자료(원고·스크립트·사례·이미지·링크·영상 등) 조회 요청");
  });
});

describe("C-4 번호 선택 후속턴 이미지 재주입", () => {
  it("'3번' 입력 시 직전 답변의 [IMAGE:URL] 목록을 순서대로 재주입한다", async () => {
    const prompt = await capturePrompt({
      messages: [
        { role: "user", content: "기트 자료 보여줘" },
        {
          role: "assistant",
          content:
            "1. 기트 카드 A [IMAGE:https://x.supabase.co/storage/v1/object/public/admin-images/a.jpg]\n" +
            "2. 기트 카드 B [IMAGE:https://x.supabase.co/storage/v1/object/public/admin-images/b.jpg]",
        },
        { role: "user", content: "3번" },
      ],
    });
    expect(prompt).toContain("[직전 턴 이미지 목록 — 번호 선택 응답용]");
    expect(prompt).toContain("1. [IMAGE:https://x.supabase.co/storage/v1/object/public/admin-images/a.jpg]");
    expect(prompt).toContain("2. [IMAGE:https://x.supabase.co/storage/v1/object/public/admin-images/b.jpg]");
    // 재주입 근거가 있으므로 빈 검색 가드(재출력 금지)가 빠진다
    expect(prompt).not.toContain("중요(DB 근거 없음)");
  });

  it("직전 답변에 이미지가 없으면 재주입하지 않는다", async () => {
    const prompt = await capturePrompt({
      messages: [
        { role: "user", content: "안녕" },
        { role: "assistant", content: "안녕하세요" },
        { role: "user", content: "3번" },
      ],
    });
    expect(prompt).not.toContain("[직전 턴 이미지 목록");
  });
});

describe("C-2/C-3 URL 창작 금지 가드", () => {
  it("staff·조회·코칭 모든 경로에 URL 창작 금지 가드가 주입된다", async () => {
    const staff = await capturePrompt({
      messages: [{ role: "user", content: "고객 응대 문구 정리해줘" }],
    });
    const lookup = await capturePrompt({
      messages: [{ role: "user", content: "사례 이미지 보여줘" }],
    });
    const coaching = await capturePrompt({
      messages: [{ role: "user", content: "요즘 고민이 많아요" }],
      promptProfile: "coaching",
    });
    for (const p of [staff, lookup, coaching]) {
      expect(p).toContain("이미지·링크 URL 절대 규칙");
      expect(p).toContain("example.com, via.placeholder.com 같은 예시·placeholder 주소는 어떤 경우에도 쓰지 마세요");
    }
  });
});
