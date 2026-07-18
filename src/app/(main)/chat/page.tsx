"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/chat/empty-state";
import { ChatInput } from "@/components/chat/chat-input";
import type { AdminGiplet, Profile } from "@/types/database";

export default function ChatPage() {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  // 설정의 기본 모드로 초기화 — 텍스트 입력과 지플릿/케이스 시작 모두에 적용된다.
  const [selectedMode, setSelectedMode] = useState<"self" | "guide">("self");

  useEffect(() => {
    async function loadDefaultMode() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profileData } = await supabase
        .from("profiles")
        .select("mode")
        .eq("id", user.id)
        .single();
      const profile = profileData as Pick<Profile, "mode"> | null;
      if (profile?.mode) setSelectedMode(profile.mode);
    }
    loadDefaultMode();
  }, []);

  async function handleSend(content: string, files?: File[], messageType: 'text' | 'voice' = 'text', mode?: "self" | "guide", gipletType?: string) {
    if (!content.trim() && (!files || files.length === 0)) return;
    setSending(true);
    try {
      // Create conversation with giplet_type
      const convRes = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: content.slice(0, 50) || "새 대화", mode: mode ?? selectedMode, giplet_type: gipletType ?? "general" }),
      });
      if (!convRes.ok) {
        const err = await convRes.json();
        throw new Error(err.error || "대화 생성 실패");
      }
      const { data: conversation } = await convRes.json();

      if (files && files.length > 0) {
        // Upload files first, then store for conversation page to send
        const attachments: Array<{
          file_path: string;
          file_name: string;
          file_type: string;
          file_size: number;
          content?: string;
        }> = [];
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
            } else {
              const err = await uploadRes.json().catch(() => ({}));
              toast.error(err.error || `파일 업로드 실패: ${file.name}`);
            }
          } catch {
            toast.error(`파일 업로드 중 오류가 발생했습니다: ${file.name}`);
          }
        }
        sessionStorage.setItem(
          `chat-init-${conversation.id}`,
          JSON.stringify({ content, messageType: messageType || "text", attachments })
        );
        router.push(`/chat/${conversation.id}?init=1`);
      } else {
        // Text-only: pass via URL param — conversation page sends immediately
        router.push(`/chat/${conversation.id}?q=${encodeURIComponent(content)}&mt=${messageType || "text"}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류가 발생했습니다");
      setSending(false);
    }
  }

  // 지플릿 카드 클릭 — giplet_type 고정 후 대화 생성
  async function handleSelectGiplet(giplet: AdminGiplet, mode: "self" | "guide") {
    setSending(true);
    try {
      const convRes = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: giplet.name,
          mode: mode ?? selectedMode,
          giplet_type: giplet.giplet_key,
        }),
      });
      if (!convRes.ok) {
        const err = await convRes.json();
        throw new Error(err.error || "대화 생성 실패");
      }
      const { data: conversation } = await convRes.json();

      // initial_prompt를 AI 웰컴 메시지로 표시하기 위해 sessionStorage에 저장
      const welcomeMsg = giplet.initial_prompt?.trim();
      if (welcomeMsg) {
        sessionStorage.setItem(`giplet-welcome-${conversation.id}`, welcomeMsg);
      }

      router.push(`/chat/${conversation.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류가 발생했습니다");
      setSending(false);
    }
  }

  // 케이스 카드 클릭 — case_type으로 대화 생성
  async function handleSelectCase(caseKey: string, caseName: string, mode: "self" | "guide") {
    setSending(true);
    try {
      const convRes = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: caseName,
          mode,
          giplet_type: "general",
          case_type: caseKey,
        }),
      });
      if (!convRes.ok) {
        const err = await convRes.json();
        throw new Error(err.error || "대화 생성 실패");
      }
      const { data: conversation } = await convRes.json();

      // 케이스 시작 메시지는 대화 페이지에서 전송 (즉시 이동 후 스트리밍)
      router.push(`/chat/${conversation.id}?case_init=1`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류가 발생했습니다");
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 relative overflow-hidden">
        <EmptyState
          onSelectGiplet={handleSelectGiplet}
          onSelectCase={handleSelectCase}
          onNavigate={(href) => router.push(href)}
          defaultMode={selectedMode}
        />
        {sending && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
              <p className="text-sm text-foreground-secondary">대화를 시작하는 중...</p>
            </div>
          </div>
        )}
      </div>
      <ChatInput onSend={handleSend} disabled={sending} />
    </div>
  );
}
