"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Save } from "lucide-react";
import type { AdminSystemPrompt } from "@/types/database";

const GIPLET_TABS = [
  { type: "general", label: "기본" },
  { type: "meeting", label: "미팅준비" },
  { type: "quotation", label: "자동견적" },
  { type: "commission", label: "수당계산" },
  { type: "story", label: "스토리" },
  { type: "schedule", label: "일정관리" },
  { type: "travel", label: "여행달성" },
];

export default function AdminPromptsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [promptsByType, setPromptsByType] = useState<Record<string, AdminSystemPrompt | null>>({});
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPromptForType = useCallback(async (gipletType: string) => {
    // 이미 로드한 타입은 재로드하지 않음 (null 포함 캐시)
    if (Object.prototype.hasOwnProperty.call(promptsByType, gipletType)) {
      setContent(promptsByType[gipletType]?.content ?? "");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await (supabase
      .from("admin_system_prompts")
      .select("*")
      .eq("giplet_type", gipletType)
      .maybeSingle() as unknown as Promise<{ data: AdminSystemPrompt | null; error: unknown }>);

    if (error) {
      toast.error("시스템 프롬프트를 불러오지 못했습니다.");
    } else {
      setPromptsByType((prev) => ({ ...prev, [gipletType]: data }));
      setContent(data?.content ?? "");
    }
    setLoading(false);
  }, [promptsByType]);

  useEffect(() => {
    loadPromptForType("general");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTabChange(type: string) {
    setActiveTab(type);
    loadPromptForType(type);
  }

  async function handleSave() {
    if (!content.trim()) {
      toast.error("내용을 입력해주세요.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await (supabase.from("admin_system_prompts") as any)
      .upsert(
        {
          content: content.trim(),
          giplet_type: activeTab,
          ...(user?.id ? { updated_by: user.id } : {}),
        },
        { onConflict: "giplet_type" }
      )
      .select()
      .single();

    if (error) {
      toast.error("저장에 실패했습니다.");
    } else {
      setPromptsByType((prev) => ({ ...prev, [activeTab]: data as AdminSystemPrompt }));
      toast.success("시스템 프롬프트가 저장되었습니다.");
    }
    setSaving(false);
  }

  const currentPrompt = promptsByType[activeTab];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">지플릿 프롬프트</h1>
          <p className="text-sm text-foreground-secondary mt-1">지플릿별 AI 역할·성격을 정의합니다. 각 지플릿마다 다른 프롬프트를 설정할 수 있습니다.</p>
        </div>
        <Button onClick={handleSave} size="sm" loading={saving}>
          <Save className="h-4 w-4" />
          저장
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {GIPLET_TABS.map((tab) => (
          <button
            key={tab.type}
            onClick={() => handleTabChange(tab.type)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.type
                ? "bg-foreground text-background"
                : "bg-surface border border-border text-foreground-secondary hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">프롬프트 내용 *</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="시스템 프롬프트 내용을 입력하세요..."
              rows={20}
              className="font-mono text-sm resize-y"
            />
          </div>

          {activeTab === "meeting" && (
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
              <p className="text-xs text-blue-800 dark:text-blue-300 font-medium mb-1">미팅준비 프롬프트 작성 팁</p>
              <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
                <li>사용자가 고객 정보를 한 번에 모두 입력해도 인식할 수 있도록 지시하세요</li>
                <li>예: "이름, 나이, 건강목표 등의 정보를 한 번에 입력하거나 순서대로 답해도 됩니다"</li>
                <li>순차 질문 방식과 일괄 입력 방식을 모두 지원하도록 프롬프트를 설계하세요</li>
              </ul>
            </div>
          )}

          {currentPrompt?.updated_at && (
            <p className="text-xs text-foreground-tertiary">
              마지막 수정: {format(new Date(currentPrompt.updated_at), "yyyy년 MM월 dd일 HH:mm", { locale: ko })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
