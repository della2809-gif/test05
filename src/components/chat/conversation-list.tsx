"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, Pencil, Check, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { ko } from "date-fns/locale/ko";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Conversation } from "@/types/database";

export function ConversationList() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    async function fetchConversations() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      setConversations((data as Conversation[]) || []);
      setLoading(false);
    }
    fetchConversations();
  }, [pathname]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    function handleExternalTitleUpdate(e: Event) {
      const { id, title } = (e as CustomEvent<{ id: string; title: string }>).detail;
      setConversations((prev) => prev.map((c) => c.id === id ? { ...c, title } : c));
    }
    window.addEventListener("conversationTitleUpdated", handleExternalTitleUpdate);
    return () => window.removeEventListener("conversationTitleUpdated", handleExternalTitleUpdate);
  }, []);

  function startEdit(conversation: Conversation) {
    setEditingId(conversation.id);
    setEditTitle(conversation.title);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
  }

  async function saveEdit(id: string) {
    const trimmed = editTitle.trim();
    if (!trimmed) { cancelEdit(); return; }

    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("conversations") as any)
        .update({ title: trimmed })
        .eq("id", id);
      if (error) throw error;

      setConversations((prev) =>
        prev.map((c) => c.id === id ? { ...c, title: trimmed } : c)
      );
      window.dispatchEvent(new CustomEvent("conversationTitleUpdated", { detail: { id, title: trimmed } }));
      toast.success("제목이 수정되었습니다");
    } catch {
      toast.error("제목 수정 중 오류가 발생했습니다");
    } finally {
      cancelEdit();
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/conversations/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("삭제 실패");

      setConversations((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success("대화가 삭제되었습니다");

      if (pathname === `/chat/${deleteTarget.id}`) {
        router.push("/chat");
      }
    } catch {
      toast.error("삭제 중 오류가 발생했습니다");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        대화가 없습니다
      </p>
    );
  }

  return (
    <>
      <div className="space-y-1 py-2">
        {conversations.map((conversation) => {
          const isActive = pathname === `/chat/${conversation.id}`;
          const isEditing = editingId === conversation.id;

          return (
            <div key={conversation.id} className="group relative">
              {isEditing ? (
                <div className="flex items-center gap-1 px-2 py-1">
                  <input
                    ref={editInputRef}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(conversation.id);
                      if (e.key === "Escape") cancelEdit();
                    }}
                    className="flex-1 rounded px-2 py-1 text-sm bg-surface border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={() => saveEdit(conversation.id)}
                    className="p-1 rounded hover:bg-surface-hover text-emerald-600"
                    aria-label="저장"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-1 rounded hover:bg-surface-hover text-foreground-secondary"
                    aria-label="취소"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    href={`/chat/${conversation.id}`}
                    className={cn(
                      "flex flex-col gap-0.5 rounded-lg px-3 py-2 pr-14 text-sm transition-colors",
                      isActive
                        ? "bg-sidebar-item-active text-sidebar-item-active-text font-medium"
                        : "text-foreground-secondary hover:bg-sidebar-item-hover hover:text-foreground"
                    )}
                  >
                    <span className="truncate">{conversation.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(conversation.updated_at), {
                        addSuffix: true,
                        locale: ko,
                      })}
                    </span>
                  </Link>
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.preventDefault(); startEdit(conversation); }}
                      className="rounded p-1 hover:bg-surface-hover text-foreground-secondary hover:text-foreground"
                      aria-label="제목 수정"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(conversation)}
                      className="rounded p-1 hover:bg-destructive/10 hover:text-destructive text-foreground-secondary"
                      aria-label="대화 삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="대화 삭제"
        description={`"${deleteTarget?.title}" 대화를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        confirmVariant="destructive"
        loading={deleting}
      />
    </>
  );
}
