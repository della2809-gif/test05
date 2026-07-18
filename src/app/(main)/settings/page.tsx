"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import type { Profile } from "@/types/database";

type Mode = "self" | "guide";

const MODE_OPTIONS: { value: Mode; title: string; description: string }[] = [
  { value: "self", title: "셀프 모드", description: "내 기록을 정리합니다" },
  { value: "guide", title: "가이드 모드", description: "고객·파트너 상담을 정리합니다" },
];

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("self");
  const [savingMode, setSavingMode] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      setUserId(user.id);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("mode")
        .eq("id", user.id)
        .single();
      const profile = profileData as Pick<Profile, "mode"> | null;
      if (profile?.mode) setMode(profile.mode);

      setLoading(false);
    }
    checkAuth();
  }, [router]);

  async function handleSelectMode(next: Mode) {
    if (next === mode || savingMode || !userId) return;
    const previous = mode;
    setMode(next);
    setSavingMode(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ mode: next } as never)
      .eq("id", userId);

    setSavingMode(false);

    if (error) {
      setMode(previous);
      toast.error("모드 변경에 실패했습니다");
    } else {
      toast.success("기본 모드가 변경되었습니다");
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleDeleteAccount() {
    setDeleting(true);

    const response = await fetch("/api/account/delete", { method: "DELETE" });

    if (!response.ok) {
      setDeleting(false);
      setDeleteDialogOpen(false);
      toast.error("탈퇴 처리에 실패했습니다");
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    setDeleting(false);
    setDeleteDialogOpen(false);
    toast.success("계정이 탈퇴 처리되었습니다");
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-lg space-y-8">
        <div>
          <h1 className="text-xl font-bold">설정</h1>
        </div>

        <hr className="border-border" />

        {/* Default mode */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">기본 모드</h2>
            <p className="text-xs text-foreground-tertiary mt-0.5">
              새 대화를 시작할 때 기본으로 적용되는 모드입니다
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {MODE_OPTIONS.map((option) => {
              const selected = mode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelectMode(option.value)}
                  disabled={savingMode}
                  aria-pressed={selected}
                  className={`flex flex-col gap-1 rounded-2xl border px-4 py-3.5 text-left transition-all disabled:opacity-60 ${
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface hover:bg-surface-hover hover:border-border-hover"
                  }`}
                >
                  <span className="text-sm font-semibold text-foreground">{option.title}</span>
                  <span className="text-xs text-foreground-tertiary">{option.description}</span>
                </button>
              );
            })}
          </div>
        </section>

        <hr className="border-border" />

        {/* Logout */}
        <section>
          <Button variant="secondary" onClick={handleSignOut} className="w-full">
            로그아웃
          </Button>
        </section>

        <hr className="border-border" />

        {/* Delete Account */}
        <section className="space-y-3">
          <Button
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
            className="w-full"
          >
            회원 탈퇴
          </Button>
        </section>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteAccount}
        title="회원 탈퇴"
        description="정말로 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmText="탈퇴하기"
        confirmVariant="destructive"
        loading={deleting}
      />
    </div>
  );
}
