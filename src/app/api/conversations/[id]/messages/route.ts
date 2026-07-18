import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateAIResponse, generateAIResponseWithTools, streamAIResponse } from "@/lib/openai";
import { getCaseSystemPromptOverrides } from "@/lib/case-engine";
import { resolveActionCapability, UNIFIED_SEARCH_SYSTEM_PROMPT } from "@/lib/giplet-pilot";
import { resolveUnifiedSearchRequest } from "@/lib/unified-search";
import { resolveGlobalFunctionIntent } from "@/lib/global-function-intent";
import { buildIntakeGuideFromDatabase } from "@/lib/intake-guide-engine";
import { formatRegistrySearchResults, searchContentRegistry } from "@/lib/content-registry-search";
import { resolveMeetingBusinessRoute } from "@/lib/meeting-business-router";

interface AttachmentInput {
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  content?: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: messages, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true }) as unknown as { data: import("@/types/database").Message[] | null; error: any };

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch attachments for all messages
  const messageIds = (messages || []).map((m) => m.id);
  const attachmentsByMessageId: Record<string, unknown[]> = {};
  if (messageIds.length > 0) {
    const { data: attachments } = await supabase
      .from("message_attachments")
      .select("*")
      .in("message_id", messageIds) as unknown as { data: import("@/types/database").MessageAttachment[] | null; error: any };

    for (const att of attachments || []) {
      if (!attachmentsByMessageId[att.message_id]) {
        attachmentsByMessageId[att.message_id] = [];
      }
      attachmentsByMessageId[att.message_id].push(att);
    }
  }

  const data = (messages || []).map((m) => ({
    ...m,
    attachments: attachmentsByMessageId[m.id] || [],
  }));

  return NextResponse.json({ data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 대화 메시지 수 제한 (최대 200개 — 비용 및 컨텍스트 오용 방지)
  const { count: msgCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", id);

  if ((msgCount ?? 0) >= 200) {
    return NextResponse.json(
      { error: "대화가 너무 길어졌습니다. 새 대화를 시작해주세요." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const attachments: AttachmentInput[] = body.attachments || [];

  // Fetch conversation mode, giplet_type, case 정보
  const { data: conv } = await supabase
    .from("conversations")
    .select("mode, giplet_type, case_type, case_step, case_context")
    .eq("id", id)
    .single() as unknown as {
      data: {
        mode: string;
        giplet_type: string;
        case_type: string | null;
        case_step: number;
        case_context: Record<string, unknown> | null;
      } | null;
      error: unknown;
    };
  const conversationMode = (conv?.mode ?? "self") as "self" | "guide";
  const gipletType = (conv?.giplet_type ?? "general") as string;
  const caseType = conv?.case_type ?? null;
  const caseStep = conv?.case_step ?? 0;
  const caseContext = conv?.case_context ?? null;

  // Determine message_type from attachments
  let messageType: "text" | "file" | "image" = body.message_type || "text";
  if (attachments.length > 0) {
    const IMAGE_TYPES = ["jpg", "jpeg", "png", "image/jpeg", "image/png"];
    const FILE_TYPES = ["pdf", "txt", "xlsx"];
    const hasImage = attachments.some((a) => IMAGE_TYPES.includes(a.file_type));
    const hasFile = attachments.some((a) => FILE_TYPES.includes(a.file_type));
    if (hasFile) messageType = "file";
    else if (hasImage) messageType = "image";
  }

  // 1. Save user message
  const { data: userMessage, error: userError } = await supabase
    .from("messages")
    .insert({
      conversation_id: id,
      role: "user" as const,
      content: body.content || "",
      message_type: messageType,
    } as any)
    .select()
    .single() as unknown as { data: import("@/types/database").Message | null; error: any };

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  // 1-b. Save original user text as raw content (F09)
  if (body.content) {
    await supabase.from("message_raw_contents").insert({
      message_id: userMessage!.id,
      raw_content: body.content,
    } as any);
  }

  // 2. Save attachments to message_attachments table
  if (attachments.length > 0) {
    const attachmentRows = attachments.map((a) => ({
      message_id: userMessage!.id,
      file_name: a.file_name,
      file_path: a.file_path,
      file_type: a.file_type,
      file_size: a.file_size,
    }));
    await supabase.from("message_attachments").insert(attachmentRows as any);
    // 파일 파싱 내용(content)은 AI 컨텍스트 전달에만 사용되며, message_raw_contents에는 저장하지 않음.
    // message_raw_contents는 사용자가 직접 입력한 텍스트만 보관.
  }

  // 3. Fetch recent conversation history for AI context
  // 최신 50개를 내림차순으로 가져와 시간순으로 뒤집는다. 오름차순 limit은 "가장 오래된 50개"를
  // 골라 51번째 메시지부터 최근 대화가 통째로 누락되는 버그였다(긴 지플릿 튜닝 대화에서
  // "좀 전 흐름이 사라짐" 증상의 원인).
  const { data: recentMessages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", id)
    .order("created_at", { ascending: false })
    .limit(50) as unknown as { data: Pick<import("@/types/database").Message, "role" | "content">[] | null; error: any };

  const baseHistory = (recentMessages || []).reverse().map((msg) => ({
    role: msg.role as "user" | "assistant" | "system",
    content: msg.content,
  }));

  // Build enriched content for the current user message (vision + file text)
  const IMAGE_TYPES = ["jpg", "jpeg", "png", "image/jpeg", "image/png"];
  const FILE_TYPES = ["pdf", "txt", "xlsx"];
  const imageAttachments = attachments.filter((a) => IMAGE_TYPES.includes(a.file_type));
  const fileAttachments = attachments.filter((a) => FILE_TYPES.includes(a.file_type));

  let conversationHistory = baseHistory;

  if (imageAttachments.length > 0 || fileAttachments.some((a) => a.content)) {
    const lastIndex = conversationHistory.length - 1;
    if (lastIndex >= 0 && conversationHistory[lastIndex].role === "user") {
      const contentParts: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      > = [];

      const userText = conversationHistory[lastIndex].content;
      const fileTexts = fileAttachments
        .filter((a) => a.content)
        .map((a) => `[파일: ${a.file_name}]\n${a.content}`)
        .join("\n\n");

      const combinedText = [userText, fileTexts].filter(Boolean).join("\n\n");
      if (combinedText) {
        contentParts.push({ type: "text", text: combinedText });
      }

      for (const img of imageAttachments) {
        const { data: urlData } = supabase.storage
          .from("attachments")
          .getPublicUrl(img.file_path);
        if (urlData?.publicUrl) {
          contentParts.push({
            type: "image_url",
            image_url: { url: urlData.publicUrl },
          });
        }
      }

      conversationHistory = [
        ...conversationHistory.slice(0, lastIndex),
        {
          role: "user" as const,
          content: contentParts as unknown as string,
        },
      ];
    }
  }

  // 4. Generate AI response — case_type 우선, 없으면 giplet_type 라우팅
  let assistantMessage = null;
  try {
    let aiContent: string;
    const isImageMessage = messageType === "image" || imageAttachments.length > 0;
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const globalFunctionIntent = resolveGlobalFunctionIntent(body.content || "");
    if (globalFunctionIntent?.intent === "intake_guide") {
      const intakeResult = await buildIntakeGuideFromDatabase(supabase, body.content || "");
      aiContent = intakeResult.status === "ready"
        ? `__INTAKEGUIDE__:${JSON.stringify(intakeResult.payload)}`
        : intakeResult.message;
    } else if (caseType) {
      // ── 케이스 플로우 (스트리밍) ──────────────────────────────────────
      const { systemPromptOverride, dbSourcesOverride } = await getCaseSystemPromptOverrides({
        caseType,
        supabase,
      });

      const { data: savedAttachments } = await supabase
        .from("message_attachments")
        .select("*")
        .eq("message_id", userMessage!.id) as unknown as { data: import("@/types/database").MessageAttachment[] | null; error: unknown };

      const caseEncoder = new TextEncoder();
      const caseSupabase = supabase;
      const caseConvId = id;
      const caseUserMsg = userMessage!;
      const caseStreamParams = {
        messages: conversationHistory,
        userId: user.id,
        supabase,
        mode: conversationMode,
        gipletType,
        systemPromptOverride,
        dbSourcesOverride,
      };

      const caseStreamBody = new ReadableStream({
        async start(controller) {
          controller.enqueue(caseEncoder.encode(
            `data: ${JSON.stringify({ type: "user_message", message: { ...caseUserMsg, attachments: savedAttachments ?? [] } })}\n\n`
          ));

          try {
            let fullContent = "";
            for await (const token of streamAIResponse(caseStreamParams)) {
              fullContent += token;
              controller.enqueue(caseEncoder.encode(
                `data: ${JSON.stringify({ type: "token", text: token })}\n\n`
              ));
            }

            const { data: aiMsg } = await (caseSupabase.from("messages") as any)
              .insert({ conversation_id: caseConvId, role: "assistant", content: fullContent, message_type: "text" })
              .select()
              .single();

            await (caseSupabase.from("conversations") as any)
              .update({ updated_at: new Date().toISOString() })
              .eq("id", caseConvId);

            controller.enqueue(caseEncoder.encode(
              `data: ${JSON.stringify({ type: "done", message: aiMsg })}\n\n`
            ));
          } catch (err) {
            console.error("Case stream AI error:", err);
            controller.enqueue(caseEncoder.encode(
              `data: ${JSON.stringify({ type: "error", message: "AI 응답 생성에 실패했습니다" })}\n\n`
            ));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(caseStreamBody, {
        status: 201,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    } else {
      // ── 지플릿 라우팅 ──────────────────────────────────────
      // admin_giplets DB에서 giplet_key로 조회 (DB 우선, capability 기반 라우팅)
      const FALLBACK_CAPABILITY: Record<string, string | null> = {
        quotation: "health_analysis",
        commission: "commission_calc",
        travel: "travel_calc",
        contact: "contact_register",
      };

      type GipletRuntimeConfig = {
        system_prompt: string;
        db_sources: string[];
        capability: string | null;
        case_key: string | null;
        is_system: boolean;
      };

      const PILOT_GIPLET_CONFIG: Record<string, GipletRuntimeConfig> = {
        unified_search: {
          system_prompt: [
            "사용자의 평소 말투에서 찾는 자료의 유형과 주제를 파악하세요.",
            "이미지, 유튜브, 체험사례, 링크·설명자료, 처방전표, 제품정보와 제품평가를 검색하고 DB에 확인된 자료만 최대 3~5건 제시하세요.",
            "자료가 없으면 없다고 말하고 만들어내지 마세요.",
            "건강·질환·복용약 질문에는 제품을 추천하지 말고 위험 신호와 의료진 확인 필요성을 먼저 안내하세요.",
          ].join("\n"),
          db_sources: ["stories", "links", "images", "youtube", "products"],
          capability: null,
          case_key: null,
          is_system: true,
        },
        meeting_business: {
          system_prompt: [
            "당신은 팀원의 실제 미팅과 사업 실행을 돕는 코치입니다.",
            "사용자의 대상, 현재 상황, 하려는 행동을 파악하고 추가 질문은 꼭 필요한 것만 한 번에 하나씩 하세요.",
            "미팅 시나리오, 스크립트, 유튜브, 링크 DB에서 확인된 근거를 우선 사용하세요.",
            "답변은 지금 말할 첫 문장과 다음 행동이 분명하도록 짧고 실행 가능하게 제시하세요.",
          ].join("\n"),
          db_sources: ["templates", "blocks", "youtube", "links"],
          capability: null,
          case_key: null,
          is_system: false,
        },
        action_calculator: {
          system_prompt: [
            "사용자의 질문을 제품 견적, 수당·CVP, 여행·목표 계산 중 하나로 분류하세요.",
            "계산에 필요한 입력이 부족하면 추측하지 말고 최소 입력값만 물어보세요.",
            "DB의 가격·점수·공식 기준만 사용하고 계산 결과에는 전제와 기준을 함께 표시하세요.",
          ].join("\n"),
          db_sources: ["products", "packages", "calculations", "images"],
          capability: null,
          case_key: null,
          is_system: true,
        },
        function_tools: {
          system_prompt: [
            "당신은 운영자가 관리하는 DB 내용과 승인된 템플릿을 조합해 공유용 결과물을 준비하는 기능도구입니다.",
            "지원 범위는 섭취방법 카드, SNS 카드, 수료증, 감사장, 인증서, 초대장, 공지 카드, 체크리스트입니다.",
            "먼저 사용자가 만들 결과물 종류를 분류하고, 필요한 입력이 부족하면 최소 항목만 한 번에 하나씩 물어보세요.",
            "섭취방법의 섭취량, 시간, 필수 안내, 주의사항은 제품 DB에 확인된 값만 사용하고 임의로 만들거나 바꾸거나 생략하지 마세요.",
            "DB에 확인된 값이나 승인 템플릿이 없으면 완성했다고 말하지 말고 준비되지 않은 항목을 분명히 안내하세요.",
            "디자인 스타일은 바꿀 수 있지만 사실 정보와 안전 문구는 변경하지 마세요.",
          ].join("\n"),
          db_sources: ["products", "images", "templates", "blocks"],
          capability: null,
          case_key: null,
          is_system: false,
        },
      };

      const { data: gipletRow } = await (supabase.from("admin_giplets") as any)
        .select("system_prompt, db_sources, capability, case_key, is_system")
        .eq("giplet_key", gipletType)
        .maybeSingle() as { data: { system_prompt: string; db_sources: string[]; capability: string | null; case_key: string | null; is_system: boolean } | null };

      const resolvedGipletRow = gipletRow ?? PILOT_GIPLET_CONFIG[gipletType] ?? null;

      // 지플릿에 case_key가 연결돼 있으면 케이스 엔진으로 라우팅 (스트리밍)
      if (resolvedGipletRow?.case_key) {
        const effectiveCaseType = resolvedGipletRow.case_key;

        // conversations.case_type이 아직 null이면 최초 진입 — 기록
        if (!caseType) {
          await (supabase.from("conversations") as any)
            .update({ case_type: effectiveCaseType })
            .eq("id", id);
        }

        const { systemPromptOverride: gcSPO, dbSourcesOverride: gcDBO } = await getCaseSystemPromptOverrides({
          caseType: effectiveCaseType,
          supabase,
        });

        const { data: gcSavedAttachments } = await supabase
          .from("message_attachments")
          .select("*")
          .eq("message_id", userMessage!.id) as unknown as { data: import("@/types/database").MessageAttachment[] | null; error: unknown };

        const gcEncoder = new TextEncoder();
        const gcSupabase = supabase;
        const gcConvId = id;
        const gcUserMsg = userMessage!;
        const gcStreamParams = {
          messages: conversationHistory,
          userId: user.id,
          supabase,
          mode: conversationMode,
          gipletType,
          systemPromptOverride: gcSPO,
          dbSourcesOverride: gcDBO,
        };

        const gcStreamBody = new ReadableStream({
          async start(controller) {
            controller.enqueue(gcEncoder.encode(
              `data: ${JSON.stringify({ type: "user_message", message: { ...gcUserMsg, attachments: gcSavedAttachments ?? [] } })}\n\n`
            ));

            try {
              let fullContent = "";
              for await (const token of streamAIResponse(gcStreamParams)) {
                fullContent += token;
                controller.enqueue(gcEncoder.encode(
                  `data: ${JSON.stringify({ type: "token", text: token })}\n\n`
                ));
              }

              const { data: aiMsg } = await (gcSupabase.from("messages") as any)
                .insert({ conversation_id: gcConvId, role: "assistant", content: fullContent, message_type: "text" })
                .select()
                .single();

              await (gcSupabase.from("conversations") as any)
                .update({ updated_at: new Date().toISOString() })
                .eq("id", gcConvId);

              controller.enqueue(gcEncoder.encode(
                `data: ${JSON.stringify({ type: "done", message: aiMsg })}\n\n`
              ));
            } catch (err) {
              console.error("Case(giplet) stream AI error:", err);
              controller.enqueue(gcEncoder.encode(
                `data: ${JSON.stringify({ type: "error", message: "AI 응답 생성에 실패했습니다" })}\n\n`
              ));
            } finally {
              controller.close();
            }
          },
        });

        return new Response(gcStreamBody, {
          status: 201,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
          },
        });
      } else {

      let capability: string | null =
        resolvedGipletRow?.capability ?? FALLBACK_CAPABILITY[gipletType] ?? null;
      if (gipletType === "action_calculator") {
        capability = resolveActionCapability(body.content || "");
      }

      const meetingRoute = gipletType === "meeting_business"
        ? resolveMeetingBusinessRoute(body.content || "")
        : null;
      // system_prompt는 capability 여부와 관계없이 항상 우선 적용
      const baseGipletSystemPrompt = gipletType === "unified_search"
        ? UNIFIED_SEARCH_SYSTEM_PROMPT
        : resolvedGipletRow?.system_prompt || undefined;
      const gipletSystemPrompt = meetingRoute ? `${baseGipletSystemPrompt ?? ""}\n${meetingRoute.prompt}`.trim() : baseGipletSystemPrompt;

      // 코칭 프로필: 계산·검색 capability와 case_key가 없는 커스텀 지플릿(꿈과목표·결심결단 등)은
      // 직원 상담 4단 포맷 대신 질문형 코칭 규칙을 쓴다. 자유채팅(general)과 시스템 기본 지플릿
      // (링크/이미지/FAQ/유튜브/미팅/스토리 등 — capability가 없어도 검색·정리형)은 제외.
      const isCoachingGiplet =
        capability === null && !!resolvedGipletRow && !resolvedGipletRow.case_key && !resolvedGipletRow.is_system && gipletType !== "general";

      // emptySearchFallback: 빈 DB 검색 시 이전 답변 재출력을 막는 지시를 opt-in.
      // buildSystemPrompt 안에서 isCatchAll(general)일 때만 실제 적용되므로, 여기서는 켜두되
      // 전용 지플릿(gipletType이 general이 아님)은 자동 제외되고 자유채팅만 걸린다. (A1)
      const genericOverrides = {
        emptySearchFallback: true,
        ...(isCoachingGiplet ? { promptProfile: "coaching" as const } : {}),
        ...(capability === null && resolvedGipletRow
          ? { systemPromptOverride: gipletSystemPrompt, dbSourcesOverride: meetingRoute?.dbSources ?? resolvedGipletRow.db_sources }
          : (gipletSystemPrompt ? { systemPromptOverride: gipletSystemPrompt } : {})),
      };

      if (gipletType === "unified_search") {
        const unifiedRequest = resolveUnifiedSearchRequest(body.content || "");
        if (unifiedRequest.action !== "search") {
          aiContent = unifiedRequest.message;
        } else {
          const unifiedSources = unifiedRequest.sources;
          const registryResults = await searchContentRegistry(supabase as any, body.content || "", unifiedSources, 5);
          // 통합 자료찾기는 승인된 Registry 결과만 출력한다. 결과가 없을 때
          // 로컬 사례나 일반 AI 답변으로 우회하면 기존 DB가 섞이거나 자료가
          // 있는 것처럼 보일 수 있으므로 빈 카드 상태를 그대로 전달한다.
          aiContent = formatRegistrySearchResults(registryResults);
        }
      } else if (capability === "contact_register") {
        // 회원 등록 지플릿 — function calling
        const result = await generateAIResponseWithTools({
          messages: conversationHistory,
          userId: user.id,
          supabase,
          mode: conversationMode,
          ...(gipletSystemPrompt ? { systemPromptOverride: gipletSystemPrompt } : {}),
        });
        if (result.type === "tool_call" && result.toolName === "register_contact") {
          const args = result.toolArgs as {
            name: string; phone?: string; join_date?: string;
            first_order_date?: string; member_status?: string;
            care_mode?: string; personality?: string; notes?: string;
          };
          await fetch(`${APP_URL}/api/contacts`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: request.headers.get("cookie") ?? "" },
            body: JSON.stringify({
              name: args.name, phone: args.phone ?? null,
              join_date: args.join_date ?? null, first_order_date: args.first_order_date ?? null,
              member_status: args.member_status ?? "신규등록", care_mode: args.care_mode ?? "집중",
              personality: args.personality ?? null,
              contact_frequency: "주1회", coupon_remaining: 2, notes: args.notes ?? null,
            }),
          });
          aiContent = result.finalContent;
        } else {
          aiContent = (result as { type: "text"; content: string }).content;
        }
      } else if (capability === "health_analysis" && isImageMessage) {
        // 자동견적 지플릿 + 이미지 → 건강분석 + 견적 카드
        try {
          const imageUrls = imageAttachments.map((a) => {
            const { data } = supabase.storage.from("attachments").getPublicUrl(a.file_path);
            return data?.publicUrl ?? "";
          }).filter(Boolean);

          const analyzeFormData = new FormData();
          for (const url of imageUrls) {
            const blob = await fetch(url).then((r) => r.blob());
            analyzeFormData.append("images", blob, "image.jpg");
          }
          const analysisRes = await fetch(`${APP_URL}/api/analyze/health-checklist`, {
            method: "POST", body: analyzeFormData,
            headers: { Cookie: request.headers.get("cookie") ?? "" },
          });
          if (analysisRes.ok) {
            const { data: analysis } = await analysisRes.json();
            // 확정 기준안(0707 자동견적로직): OCR 점수/색구간 → 축별 판정 → 등급별 기본구성 +
            // 건강축 추가 제품(불량>경계, 공통 우선, 중복 금지) → 건강분석 카드 + 3단 견적 카드.
            // 조합·수량·금액은 전부 결정적 코드(health-quote-engine)로 계산한다.
            const { buildHealthQuote } = await import("@/lib/health-quote-engine");
            const healthQuote = await buildHealthQuote(analysis, supabase);
            if (healthQuote) {
              aiContent = `__HEALTHQUOTE__:${JSON.stringify({ analysis, result: healthQuote })}`;
            } else {
              // 점수·색구간을 하나도 읽지 못함 → 값을 지어내지 않고 텍스트로 되묻는다
              aiContent = [
                "사진에서 건강체크 그래프의 점수를 정확히 읽지 못했습니다.",
                "정확한 견적을 위해 A~J 축 점수를 텍스트로 알려주세요.",
                "예: A 면역 2, B 순환 5, C 소화 3 … (그래프에 표시된 체크 개수나 점수)",
                "또는 그래프가 선명하게 나온 사진으로 다시 올려주셔도 됩니다.",
              ].join("\n");
            }
          } else {
            aiContent = await generateAIResponse({ messages: conversationHistory, userId: user.id, supabase, mode: conversationMode, gipletType, ...genericOverrides });
          }
        } catch (err) {
          console.error("Health analysis failed:", err);
          aiContent = await generateAIResponse({ messages: conversationHistory, userId: user.id, supabase, mode: conversationMode, gipletType, ...genericOverrides });
        }
      } else if (capability === "health_analysis") {
        // 자동견적 지플릿 + 텍스트 → 카드/텍스트 분기 결정화 (B-3 합의안):
        // Package DB의 정해진 패키지명 정확 매칭 시에만 카드, 자유 입력·혼합 견적·바디용품/화장품은
        // 텍스트 응답으로 고정한다. (00_decisions/2026-07-07_quotation_card-vs-text-branching.md)
        const { matchPackagesExact } = await import("@/lib/package-quote-engine");
        let pkgQuoteContent: string | null = null;
        try {
          const result = await matchPackagesExact(supabase, body.content || "");
          if (result && result.candidates.length > 0) {
            pkgQuoteContent = `__PKGQUOTE__:${JSON.stringify(result)}`;
          }
        } catch (err) {
          console.error("Package quote matching failed:", err);
        }
        aiContent = pkgQuoteContent
          ?? await generateAIResponse({ messages: conversationHistory, userId: user.id, supabase, mode: conversationMode, gipletType, ...genericOverrides });
      } else if (capability === "commission_calc") {
        // 수당 계산 지플릿 — 핵심 입력은 BC별 좌/우 점수, 로직은 BC별 min(좌,우) × 20% 합산.
        // 이미지는 vision을 json_object로 강제해 {bc,left,right} 배열만 구조화 추출하고,
        // 계산은 전부 calcCommission(결정적 코드)이 담당한다. 추출 실패 시 숫자를 지어내지 않고
        // 좌/우 점수를 텍스트로 되묻는다. (B-2: 같은 캡처는 항상 같은 결과)
        const {
          calcCommission,
          calcFromTotalCvp,
          generateScenarios,
          parseVisionShopsJson,
          parseShopLinesFromText,
        } = await import("@/lib/commission-calculator");

        // 1) 텍스트에 좌/우 점수가 직접 있으면 최우선 (되묻기 후 답변 경로 포함)
        let shops = parseShopLinesFromText(body.content || "");

        // 2) 이미지 첨부 시 vision 구조화 추출 (health-checklist route와 동일한 json_object 패턴)
        let visionFailed = false;
        if (shops.length === 0 && isImageMessage && imageAttachments.length > 0) {
          try {
            const imageUrls = imageAttachments.map((a) => {
              const { data } = supabase.storage.from("attachments").getPublicUrl(a.file_path);
              return data?.publicUrl ?? "";
            }).filter(Boolean);

            const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              },
              body: JSON.stringify({
                model: "gpt-4o",
                messages: [{
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: [
                        "이 이미지는 USANA 허브 캡처, 트리뷰 캡처 또는 손글씨 점수표입니다.",
                        "비즈니스센터(BC)별 좌측(Left)/우측(Right) 누적 점수를 추출하세요.",
                        "BC 번호는 001, 002, 003 형식입니다. 이미지에 보이는 숫자만 사용하고 절대 추측하지 마세요.",
                        "숫자를 확실히 읽을 수 없으면 shops를 빈 배열로 반환하세요.",
                        '반드시 아래 JSON 형식으로만 응답하세요: {"shops":[{"bc":"001","left":406,"right":3063}]}',
                      ].join("\n"),
                    },
                    ...imageUrls.map((url) => ({
                      type: "image_url" as const,
                      image_url: { url },
                    })),
                  ],
                }],
                max_tokens: 300,
                temperature: 0,
                response_format: { type: "json_object" },
              }),
            });
            if (visionRes.ok) {
              const visionData = await visionRes.json();
              const raw = visionData.choices?.[0]?.message?.content ?? "";
              const extracted = parseVisionShopsJson(raw);
              if (extracted) shops = extracted;
              else visionFailed = true;
            } else {
              visionFailed = true;
            }
          } catch (e) {
            console.error("Commission vision extraction failed:", e);
            visionFailed = true;
          }
        }

        if (shops.length > 0) {
          // BC별 min(좌,우) × 20% — 결정적 계산 (예: 좌406/우3063 → 406 × 20% = $81.2)
          const result = calcCommission({ shops });
          const scenarios = generateScenarios(result, { shops });
          aiContent = `__COMMISSION__:${JSON.stringify({ result, scenarios })}`;
        } else if (visionFailed) {
          // 추출 실패 → 값을 지어내지 않고 좌/우 점수를 텍스트로 되묻는다 (고정 문구)
          aiContent = [
            "사진에서 BC별 좌/우 점수를 정확히 읽지 못했습니다.",
            "정확한 수당 계산을 위해 BC별 좌측/우측 점수를 텍스트로 알려주세요.",
            "예: 001BC 좌 406 우 3063 / 002BC 좌 5000 우 0 / 003BC 좌 0 우 5000",
            "좌/우 점수를 입력해 주시면 BC별 소실적(좌·우 중 작은 값) × 20% 기준으로 바로 계산해 드립니다.",
          ].join("\n");
        } else {
          // 총 CVP만 입력한 기존 텍스트 경로 (회귀 방지)
          const cvpMatch = (body.content || "").match(/(\d+)\s*(CVP|cvp|점)/);
          const totalCvp = cvpMatch ? parseInt(cvpMatch[1]) : 0;
          if (totalCvp > 0) {
            // BC(가게) 수 파싱 — "2BC", "가게 2개", "비즈니스센터 3개" 등. 미언급 시 1BC.
            // 실적유지 필요점수(1BC=100/2BC+=200)가 BC 수에 따라 달라진다. (클라이언트 7/4 요청)
            const bcMatch = (body.content || "").match(/(\d+)\s*(?:BC|bc|비씨)|(?:가게|비즈니스\s*센터|사업장)\s*(\d+)\s*개/);
            const bcCount = bcMatch ? Math.max(1, parseInt(bcMatch[1] ?? bcMatch[2])) : 1;
            const result = calcFromTotalCvp(totalCvp, 0, bcCount);
            const scenarios = generateScenarios(result, { shops: [] });
            aiContent = `__COMMISSION__:${JSON.stringify({ result, scenarios })}`;
          } else {
            aiContent = await generateAIResponse({ messages: conversationHistory, userId: user.id, supabase, mode: conversationMode, gipletType, ...genericOverrides });
          }
        }
      } else if (capability === "travel_calc") {
        // 여행달성 지플릿 — CVP + 여행 비용 파싱
        const cvpMatch = (body.content || "").match(/(\d+)\s*(CVP|cvp|점)/);
        const currentCvp = cvpMatch ? parseInt(cvpMatch[1]) : 0;
        const budgetMatch = (body.content || "").match(/(\d+)\s*(만|천만|백만)/);
        let travelBudgetKrw = 3_000_000;
        if (budgetMatch) {
          const num = parseInt(budgetMatch[1]);
          if (budgetMatch[2] === "천만") travelBudgetKrw = num * 10_000_000;
          else if (budgetMatch[2] === "백만") travelBudgetKrw = num * 1_000_000;
          else travelBudgetKrw = num * 10_000;
        }
        const weeksMatch = (body.content || "").match(/(\d+)\s*주/);
        const monthsMatch = (body.content || "").match(/(\d+)\s*개월/);
        let weeks = 8;
        if (weeksMatch) weeks = parseInt(weeksMatch[1]);
        else if (monthsMatch) weeks = parseInt(monthsMatch[1]) * 4;

        if (currentCvp > 0) {
          const { calcTravelAchievement } = await import("@/lib/travel-calculator");
          const result = calcTravelAchievement({ currentCvp, travelBudgetKrw, weeks });
          aiContent = `__TRAVEL__:${JSON.stringify({ result })}`;
        } else {
          aiContent = await generateAIResponse({ messages: conversationHistory, userId: user.id, supabase, mode: conversationMode, gipletType, ...genericOverrides });
        }
      } else {
        // 나머지 — generic AI: 스트리밍 응답 반환
        const streamParams = {
          messages: conversationHistory,
          userId: user.id,
          supabase,
          mode: conversationMode,
          gipletType,
          ...genericOverrides,
        };

        const { data: savedAttachments } = await supabase
          .from("message_attachments")
          .select("*")
          .eq("message_id", userMessage!.id) as unknown as { data: import("@/types/database").MessageAttachment[] | null; error: any };

        const encoder = new TextEncoder();
        const supabaseRef = supabase;
        const convId = id;
        const userMsgSnapshot = userMessage!;

        const streamBody = new ReadableStream({
          async start(controller) {
            // 첫 이벤트: 저장된 사용자 메시지 전달
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: "user_message", message: { ...userMsgSnapshot, attachments: savedAttachments ?? [] } })}\n\n`
            ));

            try {
              let fullContent = "";
              for await (const token of streamAIResponse(streamParams)) {
                fullContent += token;
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: "token", text: token })}\n\n`
                ));
              }

              // AI 응답 DB 저장
              const { data: aiMsg } = await (supabaseRef.from("messages") as any)
                .insert({ conversation_id: convId, role: "assistant", content: fullContent, message_type: "text" })
                .select()
                .single();

              // 대화 updated_at 갱신
              await (supabaseRef.from("conversations") as any)
                .update({ updated_at: new Date().toISOString() })
                .eq("id", convId);

              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: "done", message: aiMsg })}\n\n`
              ));
            } catch (err) {
              console.error("Stream AI error:", err);
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: "error", message: "AI 응답 생성에 실패했습니다" })}\n\n`
              ));
            } finally {
              controller.close();
            }
          },
        });

        return new Response(streamBody, {
          status: 201,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
          },
        });
      }
      } // end: gipletRow?.case_key else
    }

    // 5. Save AI response (non-streaming paths only)
    const { data: aiMessage, error: aiError } = await supabase
      .from("messages")
      .insert({
        conversation_id: id,
        role: "assistant" as const,
        content: aiContent,
        message_type: "text",
      } as any)
      .select()
      .single() as unknown as { data: import("@/types/database").Message | null; error: any };

    if (aiError) {
      console.error("Failed to save AI response:", aiError.message);
    } else {
      assistantMessage = aiMessage;

      // 자동견적(OCR) 결과가 있으면 consultations에도 저장 (상담 기록 저장 — 스펙 11장)
      if (aiContent.startsWith("__HEALTHQUOTE__:")) {
        try {
          const payload = JSON.parse(aiContent.slice("__HEALTHQUOTE__:".length));
          await (supabase.from("consultations") as any).insert({
            user_id: user.id,
            conversation_id: id,
            health_scores: payload.analysis?.scores ?? null,
            lifestyle_slots: payload.analysis?.lifestyle ?? null,
            inbody_data: payload.analysis?.inbody ?? null,
            judgment: payload.result
              ? { axes: payload.result.axes, overallGrade: payload.result.overallGrade, resetPurpose: payload.result.resetPurpose }
              : null,
            quotation: payload.result?.tiers ?? null,
            recommended_products: payload.result
              ? payload.result.tiers?.premium?.lines
                  ?.filter((l: { source: string }) => l.source === "axis")
                  .map((l: { product_name: string }) => l.product_name) ?? null
              : null,
            order_status: "pending",
          });
        } catch (e) {
          console.error("Failed to save consultation:", e);
        }
      }

      // 견적 결과가 있으면 consultations에도 저장
      if (aiContent.startsWith("__QUOTATION__:")) {
        try {
          const quotationPayload = JSON.parse(aiContent.slice("__QUOTATION__:".length));
          await (supabase.from("consultations") as any).insert({
            user_id: user.id,
            conversation_id: id,
            health_scores: quotationPayload.analysis?.scores ?? null,
            lifestyle_slots: quotationPayload.analysis?.lifestyle ?? null,
            inbody_data: quotationPayload.analysis?.inbody ?? null,
            judgment: quotationPayload.judgment ?? null,
            quotation: quotationPayload.quotation ?? null,
            recommended_products: quotationPayload.judgment?.additionalProducts ?? null,
            order_status: "pending",
          });
        } catch (e) {
          console.error("Failed to save consultation:", e);
        }
      }
    }
  } catch (err) {
    console.error("AI response generation failed:", err);
    // We still return the user message even if AI fails
  }

  // 6. Update conversation's updated_at (non-streaming paths)
  await (supabase.from("conversations") as any)
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  // Fetch saved attachments to return with userMessage
  const { data: savedAttachments } = await supabase
    .from("message_attachments")
    .select("*")
    .eq("message_id", userMessage!.id) as unknown as { data: import("@/types/database").MessageAttachment[] | null; error: any };

  return NextResponse.json(
    {
      userMessage: { ...(userMessage as import("@/types/database").Message), attachments: savedAttachments || [] },
      assistantMessage,
    },
    { status: 201 }
  );
}
