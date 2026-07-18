"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { Profile } from "@/types/database";

interface ProfileForm {
  email: string;
  name: string;
  phone: string;
  team: string;
}

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    email: "",
    name: "",
    phone: "",
    team: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("name, phone, team")
        .eq("id", user.id)
        .single();

      const profile = profileData as Pick<Profile, "name" | "phone" | "team"> | null;

      setForm({
        email: user.email ?? "",
        name: profile?.name ?? "",
        phone: profile?.phone ?? "",
        team: profile?.team ?? "",
      });

      setLoading(false);
    }
    loadProfile();
  }, []);

  function handleChange(field: keyof ProfileForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  async function handleSave() {
    if (!userId) return;
    setSaving(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        name: form.name,
        phone: form.phone,
        team: form.team,
      } as never)
      .eq("id", userId);

    setSaving(false);

    if (error) {
      toast.error("저장에 실패했습니다");
    } else {
      toast.success("저장되었습니다");
    }
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
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-xl font-bold">프로필 수정</h1>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">이메일</label>
            <Input
              value={form.email}
              disabled
              className="bg-muted"
              readOnly
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">이름</label>
            <Input
              value={form.name}
              onChange={handleChange("name")}
              placeholder="이름을 입력하세요"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">연락처</label>
            <Input
              value={form.phone}
              onChange={handleChange("phone")}
              placeholder="연락처를 입력하세요"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">팀</label>
            <Input
              value={form.team}
              onChange={handleChange("team")}
              placeholder="팀을 입력하세요"
            />
          </div>

        </div>

        <Button
          onClick={handleSave}
          loading={saving}
          className="w-full"
        >
          저장
        </Button>
      </div>
    </div>
  );
}
