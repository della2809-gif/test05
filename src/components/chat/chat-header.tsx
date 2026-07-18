"use client";

import { useState, useRef, useEffect } from "react";
import { Bookmark, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface ChatHeaderProps {
  title: string;
  conversationId: string;
  onTitleChange?: (title: string) => void;
  onSaveArchive?: () => void;
}

export function ChatHeader({
  title,
  conversationId,
  onTitleChange,
  onSaveArchive,
}: ChatHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(title);
  }, [title]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function handleSaveTitle() {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setEditValue(title);
      setEditing(false);
      return;
    }
    if (trimmed === title) {
      setEditing(false);
      return;
    }
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("conversations") as any)
        .update({ title: trimmed })
        .eq("id", conversationId);
      if (error) throw error;
      onTitleChange?.(trimmed);
      window.dispatchEvent(new CustomEvent("conversationTitleUpdated", { detail: { id: conversationId, title: trimmed } }));
      toast.success("제목이 저장되었습니다");
    } catch {
      toast.error("제목 저장 실패");
      setEditValue(title);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveTitle();
    }
    if (e.key === "Escape") {
      setEditValue(title);
      setEditing(false);
    }
  }

  return (
    <div className="flex items-center justify-between border-b border-border px-4 lg:px-6 py-3 min-h-[52px]">
      {editing ? (
        <div className="flex flex-1 items-center gap-2 mr-2">
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSaveTitle}
            className="flex-1 rounded-lg border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            onClick={handleSaveTitle}
            className="rounded p-1 hover:bg-surface-hover text-foreground-secondary hover:text-foreground"
            aria-label="저장"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setEditValue(title);
              setEditing(false);
            }}
            className="rounded p-1 hover:bg-surface-hover text-foreground-secondary hover:text-foreground"
            aria-label="취소"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <h2
          className="flex-1 text-sm font-medium truncate cursor-pointer hover:text-foreground-secondary mr-2"
          onClick={() => setEditing(true)}
          title="클릭하여 수정"
        >
          {title}
        </h2>
      )}
      {onSaveArchive && (
        <Button variant="ghost" size="sm" onClick={onSaveArchive} className="gap-1.5 shrink-0">
          <Bookmark className="h-4 w-4" />
          <span className="hidden sm:inline">아카이브 저장</span>
        </Button>
      )}
    </div>
  );
}
