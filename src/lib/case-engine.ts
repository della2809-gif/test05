import type { SupabaseClient } from "@supabase/supabase-js";
import { generateAIResponse } from "./openai";
import type { AdminCase, GuideStep } from "../types/database";

interface GipletRow {
  giplet_key: string;
  name: string;
  description: string | null;
  system_prompt: string;
  db_sources: string[];
}

interface ProcessCaseMessageParams {
  caseType: string;
  caseStep: number;
  caseContext: Record<string, unknown> | null;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  userId: string;
  mode: "self" | "guide";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>;
}

export interface CaseProcessResult {
  aiContent: string;
  newStep: number;
  updatedContext: Record<string, unknown>;
  isComplete: boolean;
}

const CTX_JSON_RE = /__CTX_JSON__\s*:?\s*([\s\S]*?)\s*:?\s*__CTX_JSON_END__/g;

export function formatGuideSteps(
  steps: GuideStep[] | string[] | null | undefined,
  gipletNameMap?: Record<string, string>,
): string {
  if (!steps || steps.length === 0) return "";

  const formattedSteps = steps
    .map((step, index) => {
      const normalizedStep: GuideStep = typeof step === "string" ? { title: step } : step;
      const title = normalizedStep.title?.trim();
      if (!title) return "";

      const lines = [`${index + 1}. ${title}`];
      const description = normalizedStep.description?.trim();
      if (description) lines.push(`설명: ${description}`);

      const collectionItems = normalizedStep.collection_items_text
        ?.split("\n")
        .map((item) => item.replace(/^\s*[-*\d.)]+\s*/, "").trim())
        .filter(Boolean);
      if (collectionItems && collectionItems.length > 0) {
        lines.push(`수집 항목:\n${collectionItems.map((item) => `  - ${item}`).join("\n")}`);
      }

      // 연결된 자료는 내부 키(youtube, image 등) 대신 사람이 읽는 이름으로 표기한다.
      // 내부 키가 그대로 노출되면 AI가 "연결된 지플릿은 youtube입니다"처럼 키를 그대로 답변에 출력해버린다.
      const linkedGiplets = normalizedStep.linked_giplets?.filter(Boolean) ?? [];
      if (linkedGiplets.length > 0) {
        const names = linkedGiplets.map((key) => gipletNameMap?.[key] ?? key);
        lines.push(`이 단계에서 활용할 자료: ${names.join(", ")}`);
      }

      return lines.join("\n");
    })
    .filter(Boolean);

  return formattedSteps.join("\n\n");
}

export function getGuideStepGipletKeys(steps: GuideStep[] | null | undefined): string[] {
  return [...new Set((steps ?? []).flatMap((step) => step.linked_giplets ?? []).filter(Boolean))];
}

export function parseCaseMarkers(rawResponse: string, previousContext: Record<string, unknown>): {
  content: string;
  updatedContext: Record<string, unknown>;
  done: boolean;
} {
  const updatedContext = { ...previousContext };
  let content = rawResponse;
  const done = rawResponse.includes("__CTX_DONE__");

  for (const match of rawResponse.matchAll(CTX_JSON_RE)) {
    const jsonText = match[1]?.trim();
    if (!jsonText) continue;
    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed)) {
        if (value !== undefined && value !== null && String(value).trim() !== "") {
          updatedContext[key] = value;
        }
      }
    } catch {
      // 모델이 마커를 깨뜨린 경우 사용자 응답은 유지하되 구조화 업데이트만 건너뜁니다.
    }
  }

  if (done) updatedContext._ctx_complete = true;
  content = content.replace(CTX_JSON_RE, "").replace(/__CTX_DONE__/g, "").trim();

  return { content, updatedContext, done };
}

export function hasContextChanged(
  beforeContext: Record<string, unknown> | null | undefined,
  afterContext: Record<string, unknown> | null | undefined,
): boolean {
  return JSON.stringify(beforeContext ?? {}) !== JSON.stringify(afterContext ?? {});
}

// 케이스 시스템 프롬프트·DB 소스를 준비하는 함수 (스트리밍/비스트리밍 공용)
export async function getCaseSystemPromptOverrides({
  caseType,
  supabase,
}: {
  caseType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>;
}): Promise<{ systemPromptOverride: string; dbSourcesOverride: string[] }> {
  const { data: caseRow } = await (supabase
    .from("admin_cases")
    .select("*")
    .eq("case_key", caseType)
    .eq("is_active", true)
    .maybeSingle() as unknown as Promise<{ data: AdminCase | null }>);

  const guideSteps: GuideStep[] = (caseRow?.guide_steps as GuideStep[]) ?? [];
  const stepLinkedGipletKeys = getGuideStepGipletKeys(guideSteps);

  const { data: gipletsData } = await (supabase
    .from("admin_giplets")
    .select("giplet_key, name, description, system_prompt, db_sources")
    .in("giplet_key", stepLinkedGipletKeys.length > 0 ? stepLinkedGipletKeys : ["__none__"])
    .eq("is_active", true) as unknown as Promise<{ data: GipletRow[] | null }>);

  const linkedGiplets = gipletsData ?? [];
  // 내부 키(giplet_key) → 사람이 읽는 이름. 가이드 텍스트에서 키 노출을 막기 위함.
  const gipletNameMap = Object.fromEntries(linkedGiplets.map((g) => [g.giplet_key, g.name]));
  const guideStepsText = formatGuideSteps(guideSteps, gipletNameMap);
  const dbSourcesOverride = [...new Set(linkedGiplets.flatMap((g) => g.db_sources))];
  const gipletsSection = linkedGiplets
    .map((g) => `### ${g.name}\n${g.system_prompt || g.description || ""}`)
    .join("\n\n");

  const systemPromptOverride = `당신은 ${caseRow?.name ?? "케이스"} AI 코치입니다.

${guideStepsText ? `[업무 진행 가이드]\n${guideStepsText}\n\n` : ""}[지침]
- 사용자가 케이스를 시작하면 업무 진행 가이드를 먼저 목차처럼 보여주세요.
- 사용자가 번호나 단계명을 말하면 해당 단계의 설명과 수집 항목에 맞춰 안내하세요.
- 해당 단계에 수집 항목이 있으면 답변을 만들기 전에 누락된 정보를 먼저 자연스럽게 물어보세요.
- 단계에 연결된 자료(유튜브 영상·이미지 등)가 있으면, 아래 '참고 데이터'의 [유튜브 강의 DB]·[이미지 자료 DB]에서 실제 항목을 찾아 클릭 가능한 링크(예: [영상 제목](URL)) 또는 이미지(예: [IMAGE:URL]) 형식으로 직접 제공하세요. 자료가 있는데 링크/이미지를 빼먹지 마세요.
- "youtube", "image", "지플릿", "연결된 지플릿" 같은 내부 용어나 키 이름을 답변에 그대로 쓰지 마세요. 사용자에게는 실제 링크·이미지·내용으로 보여주세요.
- 응답 후 사용자가 다음에 진행할 수 있는 단계를 자연스럽게 제안하세요.

[역할 및 수행 가능한 작업]
${gipletsSection || "단계별 연결 자료 없음"}`;

  return { systemPromptOverride, dbSourcesOverride };
}

export async function processCaseMessage({
  caseType,
  caseStep,
  caseContext,
  messages,
  userId,
  mode,
  supabase,
}: ProcessCaseMessageParams): Promise<CaseProcessResult> {
  const { systemPromptOverride, dbSourcesOverride } = await getCaseSystemPromptOverrides({
    caseType,
    supabase,
  });

  const ctx = caseContext ?? {};

  const rawResponse = await generateAIResponse({
    messages,
    userId,
    supabase,
    mode,
    systemPromptOverride,
    dbSourcesOverride,
  });

  return {
    aiContent: rawResponse.trim(),
    newStep: caseStep,
    updatedContext: ctx,
    isComplete: false,
  };
}

// 프론트엔드용 케이스 조회
export async function loadCaseWithSteps(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  caseType: string,
): Promise<{ caseRow: AdminCase; steps: [] } | null> {
  const { data: caseRow } = await (supabase
    .from("admin_cases")
    .select("*")
    .eq("case_key", caseType)
    .maybeSingle() as unknown as Promise<{ data: AdminCase | null }>);

  return caseRow ? { caseRow, steps: [] } : null;
}
