"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ChatHeader } from "@/components/chat/chat-header";
import { MessageList } from "@/components/chat/message-list";
import type { MessageWithExtras } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { ArchiveSaveDialog } from "@/components/chat/archive-save-dialog";
import { CaseProgress } from "@/components/chat/case-progress";
import type { Conversation, Message, MessageRawContent, AdminCaseStep } from "@/types/database";

type PreAttachment = {
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  content?: string;
};

// 케이스 시작 시 AI 가이드를 띄우기 위한 트리거 멘트.
// 유저 화면에는 노출하지 않고(아래 displayMessages에서 필터), AI 가이드만 표시한다.
const CASE_INIT_TRIGGER = "케이스를 시작해주세요.";

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<MessageWithExtras[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [caseSteps, setCaseSteps] = useState<AdminCaseStep[]>([]);
  const abortRef = useRef(false);
  const pendingInitRef = useRef<{
    content: string;
    messageType: "text" | "voice";
    preAttachments?: PreAttachment[];
  } | null>(null);

  useEffect(() => {
    abortRef.current = false;
    async function fetchData() {
      const supabase = createClient();

      const [{ data: conv }, { data: msgs }] = await Promise.all([
        supabase.from("conversations").select("*").eq("id", id).single(),
        supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", id)
          .order("created_at", { ascending: true }),
      ]);

      if (!conv) {
        router.replace("/chat");
        return;
      }

      const loadedMsgs = (msgs as Message[]) || [];

      // Load raw contents and attachments for all messages
      const allMessageIds = loadedMsgs.map((m) => m.id);
      const userMessageIds = loadedMsgs
        .filter((m) => m.role === "user")
        .map((m) => m.id);

      let rawContentMap: Record<string, MessageRawContent> = {};
      let attachmentsByMsgId: Record<string, import("@/types/database").MessageAttachment[]> = {};

      await Promise.all([
        userMessageIds.length > 0
          ? supabase
              .from("message_raw_contents")
              .select("*")
              .in("message_id", userMessageIds)
              .then(({ data: rawRows }) => {
                if (rawRows) {
                  rawContentMap = Object.fromEntries(
                    (rawRows as MessageRawContent[]).map((r) => [r.message_id, r])
                  );
                }
              })
          : Promise.resolve(),
        allMessageIds.length > 0
          ? supabase
              .from("message_attachments")
              .select("*")
              .in("message_id", allMessageIds)
              .then(({ data: attRows }) => {
                for (const att of (attRows as import("@/types/database").MessageAttachment[]) || []) {
                  if (!attachmentsByMsgId[att.message_id]) {
                    attachmentsByMsgId[att.message_id] = [];
                  }
                  attachmentsByMsgId[att.message_id].push(att);
                }
              })
          : Promise.resolve(),
      ]);

      const messagesWithExtras: MessageWithExtras[] = loadedMsgs.map((m) => ({
        ...m,
        raw_content: rawContentMap[m.id] ?? null,
        attachments: attachmentsByMsgId[m.id] ?? [],
      }));

      if (!abortRef.current) {
        const loadedConv = conv as Conversation;
        setConversation(loadedConv);
        setMessages(messagesWithExtras);
        setLoading(false);

        // 지플릿 AI 웰컴 메시지 처리
        const welcomeKey = `giplet-welcome-${id}`;
        const welcomeMsg = sessionStorage.getItem(welcomeKey);
        if (welcomeMsg && loadedMsgs.length === 0) {
          sessionStorage.removeItem(welcomeKey);
          const welcomeMessage: MessageWithExtras = {
            id: `welcome-${id}`,
            conversation_id: id,
            role: "assistant",
            content: welcomeMsg,
            message_type: "text",
            created_at: new Date().toISOString(),
            raw_content: null,
            attachments: [],
          };
          setMessages([welcomeMessage]);
        }

        // URL 파라미터로 전달된 첫 메시지 처리 (chat/page.tsx에서 즉시 이동한 경우)
        const initQ = searchParams.get("q");
        const initMT = (searchParams.get("mt") || "text") as "text" | "voice";
        const initFlag = searchParams.get("init");
        const caseInitFlag = searchParams.get("case_init");

        if (initQ) {
          pendingInitRef.current = { content: decodeURIComponent(initQ), messageType: initMT };
          router.replace(`/chat/${id}`);
        } else if (caseInitFlag) {
          pendingInitRef.current = { content: CASE_INIT_TRIGGER, messageType: "text" };
          router.replace(`/chat/${id}`);
        } else if (initFlag) {
          const stored = sessionStorage.getItem(`chat-init-${id}`);
          sessionStorage.removeItem(`chat-init-${id}`);
          if (stored) {
            const initData = JSON.parse(stored) as { content: string; messageType: "text" | "voice"; attachments?: PreAttachment[] };
            pendingInitRef.current = { content: initData.content, messageType: initData.messageType || "text", preAttachments: initData.attachments };
          }
          router.replace(`/chat/${id}`);
        }

        // 케이스 대화라면 단계 목록 로드
        if (loadedConv.case_type) {
          const { data: caseRow } = await supabase
            .from("admin_cases")
            .select("id")
            .eq("case_key", loadedConv.case_type)
            .maybeSingle() as unknown as { data: { id: string } | null };
          if (caseRow) {
            const { data: stepRows } = await supabase
              .from("admin_case_steps")
              .select("*")
              .eq("case_id", caseRow.id)
              .order("step_index", { ascending: true }) as unknown as { data: AdminCaseStep[] | null };
            if (!abortRef.current) setCaseSteps(stepRows ?? []);
          }
        }
      }
    }
    fetchData();

    return () => {
      abortRef.current = true;
    };
  }, [id, router]);

  const handleSend = useCallback(
    async (content: string, files?: File[], messageType: 'text' | 'voice' = 'text', preAttachments?: PreAttachment[]) => {
      if (!content.trim() && (!files || files.length === 0)) return;

      setSending(true);

      // Optimistic: add user message immediately
      const optimisticUserMsg: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: id,
        role: "user",
        content,
        message_type: messageType,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUserMsg]);
      setIsTyping(true);

      try {
        // Use pre-uploaded attachments (from chat/page.tsx) or upload files now
        const attachments: PreAttachment[] = preAttachments ? [...preAttachments] : [];
        if (!preAttachments && files && files.length > 0) {
          for (const file of files) {
            const formData = new FormData();
            formData.append("file", file);
            try {
              const uploadRes = await fetch("/api/upload", {
                method: "POST",
                body: formData,
              });
              if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                attachments.push(uploadData);
              } else if (uploadRes.status === 413) {
                // Vercel 본문 한도 초과 — 큰 파일(특히 PC 원본 이미지)일 때 발생
                toast.error(`파일이 너무 커서 업로드할 수 없어요. 4.5MB 이하로 줄여서 올려주세요: ${file.name}`);
              } else {
                const err = await uploadRes.json().catch(() => ({}));
                toast.error(err.error || `파일 업로드 실패: ${file.name}`);
              }
            } catch {
              toast.error(`파일 업로드 중 오류가 발생했습니다: ${file.name}`);
            }
          }
        }

        const res = await fetch(`/api/conversations/${id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            message_type: messageType,
            attachments: attachments.length > 0 ? attachments : undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "메시지 전송 실패");
        }

        // SSE 스트리밍 응답 처리
        if (res.headers.get("content-type")?.includes("text/event-stream")) {
          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          const streamingMsgId = `streaming-${Date.now()}`;
          let firstToken = true;
          let gotAssistant = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const blocks = buffer.split("\n\n");
            buffer = blocks.pop() ?? "";

            for (const block of blocks) {
              const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
              if (!dataLine) continue;

              try {
                const event = JSON.parse(dataLine.slice(6)) as {
                  type: string;
                  message?: MessageWithExtras;
                  text?: string;
                };

                if (event.type === "user_message" && event.message) {
                  const realUserMsg: MessageWithExtras = {
                    ...event.message,
                    raw_content: content
                      ? { id: "", message_id: event.message.id, raw_content: content, created_at: event.message.created_at }
                      : null,
                    attachments: event.message.attachments || [],
                  };
                  setMessages((prev) =>
                    prev.map((m) => (m.id === optimisticUserMsg.id ? realUserMsg : m))
                  );
                } else if (event.type === "token" && event.text) {
                  if (firstToken) {
                    firstToken = false;
                    setIsTyping(false);
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: streamingMsgId,
                        conversation_id: id,
                        role: "assistant" as const,
                        content: event.text!,
                        message_type: "text" as const,
                        created_at: new Date().toISOString(),
                      },
                    ]);
                  } else {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === streamingMsgId
                          ? { ...m, content: m.content + event.text! }
                          : m
                      )
                    );
                  }
                } else if (event.type === "done" && event.message) {
                  gotAssistant = true;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === streamingMsgId
                        ? { ...event.message!, raw_content: null, attachments: [] }
                        : m
                    )
                  );
                } else if (event.type === "error") {
                  toast.error("AI 응답 생성에 실패했습니다. 다시 시도해 주세요.");
                }
              } catch {
                // 파싱 오류 무시
              }
            }
          }

          if (!gotAssistant) {
            toast.error("AI 응답 생성에 실패했습니다. 다시 시도해 주세요.");
          }
        } else {
          // 기존 JSON 응답 처리 (케이스 엔진, 특수 capability 등)
          const { userMessage, assistantMessage } = await res.json();

          const userMessageWithExtras: MessageWithExtras = {
            ...userMessage,
            raw_content: content
              ? {
                  id: "",
                  message_id: userMessage.id,
                  raw_content: content,
                  created_at: userMessage.created_at,
                }
              : null,
            attachments: userMessage.attachments || [],
          };

          setMessages((prev) => {
            const withoutOptimistic = prev.filter((m) => m.id !== optimisticUserMsg.id);
            const newMessages: MessageWithExtras[] = [...withoutOptimistic, userMessageWithExtras];
            if (assistantMessage) {
              newMessages.push(assistantMessage as MessageWithExtras);
            }
            return newMessages;
          });

          if (!assistantMessage) {
            toast.error("AI 응답 생성에 실패했습니다. 다시 시도해 주세요.");
          }
        }

        // 케이스 단계 변경 시 conversation 상태 갱신
        if (conversation?.case_type) {
          const supabase = createClient();
          const { data: freshConv } = await supabase
            .from("conversations")
            .select("case_step, case_context")
            .eq("id", id)
            .single() as unknown as { data: { case_step: number; case_context: unknown } | null };
          if (freshConv) {
            setConversation((prev) => prev ? { ...prev, case_step: freshConv.case_step, case_context: freshConv.case_context as import("@/types/database").Json } : prev);
          }
        }
      } catch (err) {
        // Remove optimistic message on failure
        setMessages((prev) =>
          prev.filter((m) => m.id !== optimisticUserMsg.id)
        );
        toast.error(
          err instanceof Error ? err.message : "오류가 발생했습니다"
        );
      } finally {
        setIsTyping(false);
        setSending(false);
      }
    },
    [id, conversation]
  );

  // URL init 파라미터로 전달된 첫 메시지를 loading 완료 후 자동 전송
  useEffect(() => {
    if (!loading && pendingInitRef.current) {
      const pending = pendingInitRef.current;
      pendingInitRef.current = null;
      handleSend(pending.content, undefined, pending.messageType, pending.preAttachments);
    }
  }, [loading, handleSend]);

  const handleTitleChange = useCallback((newTitle: string) => {
    setConversation((prev) =>
      prev ? { ...prev, title: newTitle } : prev
    );
  }, []);

  useEffect(() => {
    function handleExternalTitleUpdate(e: Event) {
      const { id: updatedId, title } = (e as CustomEvent<{ id: string; title: string }>).detail;
      if (updatedId === id) {
        setConversation((prev) => prev ? { ...prev, title } : prev);
      }
    }
    window.addEventListener("conversationTitleUpdated", handleExternalTitleUpdate);
    return () => window.removeEventListener("conversationTitleUpdated", handleExternalTitleUpdate);
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-foreground" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">대화를 찾을 수 없습니다</p>
      </div>
    );
  }

  // 케이스 시작 트리거 멘트("케이스를 시작해주세요.")는 유저 화면에서 숨긴다 (AI 가이드만 노출)
  const displayMessages = messages.filter(
    (m) => !(m.role === "user" && m.content === CASE_INIT_TRIGGER)
  );

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const rawArchiveContent = lastAssistantMessage?.content ?? "";
  // 특수 포맷 접두사(견적/수당/여행 카드)를 아카이브에 그대로 저장하지 않도록 변환
  const archiveContent = (() => {
    if (rawArchiveContent.startsWith("__QUOTATION__:")) return "[자동 견적 결과]";
    if (rawArchiveContent.startsWith("__COMMISSION__:")) return "[수당 계산 결과]";
    if (rawArchiveContent.startsWith("__TRAVEL__:")) return "[여행 달성 결과]";
    return rawArchiveContent;
  })();

  return (
    <div className="flex h-full flex-col">
      <ChatHeader
        title={conversation.title}
        conversationId={conversation.id}
        onTitleChange={handleTitleChange}
        onSaveArchive={() => setArchiveDialogOpen(true)}
      />
      {conversation.case_type && caseSteps.length > 0 && (
        <CaseProgress
          steps={caseSteps}
          currentStep={conversation.case_step ?? 0}
          isComplete={(conversation.case_context as Record<string, unknown> | null)?.is_complete === true}
        />
      )}
      <MessageList messages={displayMessages} isTyping={isTyping} />
      <ChatInput onSend={handleSend} disabled={sending} />
      <ArchiveSaveDialog
        open={archiveDialogOpen}
        onClose={() => setArchiveDialogOpen(false)}
        conversationId={conversation.id}
        content={archiveContent}
      />
    </div>
  );
}
