"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [team, setTeam] = useState("");
  const [memberType, setMemberType] = useState<"usana" | "general">("usana");
  const [directMentorName, setDirectMentorName] = useState("");
  const [directMentorPhone, setDirectMentorPhone] = useState("");
  const [leadersMentorName, setLeadersMentorName] = useState("");
  const [leadersMentorPhone, setLeadersMentorPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkOnboarding() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .single();

      const profile = profileData as { onboarding_completed: boolean } | null;

      if (profile?.onboarding_completed === true) {
        router.push("/chat");
        return;
      }

      setChecking(false);
    }
    checkOnboarding();
  }, [router]);

  function onlyNumbers(value: string) {
    return value.replace(/\D/g, "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        name,
        phone,
        team,
        member_type: memberType,
        direct_mentor_name: directMentorName,
        direct_mentor_phone: directMentorPhone,
        leaders_mentor_name: leadersMentorName,
        leaders_mentor_phone: leadersMentorPhone,
        onboarding_completed: true,
      } as never)
      .eq("id", user.id);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/chat");
      router.refresh();
    }
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-foreground-secondary text-center">
        서비스 이용을 위해 프로필을 완성해 주세요
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            이름
          </label>
          <Input
            id="name"
            type="text"
            placeholder="홍길동"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="phone" className="text-sm font-medium">
            전화번호
          </label>
          <Input
            id="phone"
            type="tel"
            placeholder="01012345678"
            value={phone}
            onChange={(e) => setPhone(onlyNumbers(e.target.value))}
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">회원 유형</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="memberType"
                value="usana"
                checked={memberType === "usana"}
                onChange={() => setMemberType("usana")}
              />
              <span className="text-sm">유사나 회원</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="memberType"
                value="general"
                checked={memberType === "general"}
                onChange={() => setMemberType("general")}
              />
              <span className="text-sm">일반 회원</span>
            </label>
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="team" className="text-sm font-medium">
            팀명
          </label>
          <Input
            id="team"
            type="text"
            placeholder="소속 팀 또는 조직"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="direct-mentor-name" className="text-sm font-medium">
            시스템 직속 멘토 이름
          </label>
          <Input
            id="direct-mentor-name"
            type="text"
            placeholder="시스템 직속 멘토 이름"
            value={directMentorName}
            onChange={(e) => setDirectMentorName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="direct-mentor-phone" className="text-sm font-medium">
            시스템 직속 멘토 연락처
          </label>
          <Input
            id="direct-mentor-phone"
            type="tel"
            placeholder="01012345678"
            value={directMentorPhone}
            onChange={(e) => setDirectMentorPhone(onlyNumbers(e.target.value))}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="leaders-mentor-name" className="text-sm font-medium">
            시스템 리더스이상 멘토 이름
          </label>
          <Input
            id="leaders-mentor-name"
            type="text"
            placeholder="시스템 리더스이상 멘토 이름"
            value={leadersMentorName}
            onChange={(e) => setLeadersMentorName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="leaders-mentor-phone" className="text-sm font-medium">
            시스템 리더스이상 멘토 연락처
          </label>
          <Input
            id="leaders-mentor-phone"
            type="tel"
            placeholder="01012345678"
            value={leadersMentorPhone}
            onChange={(e) => setLeadersMentorPhone(onlyNumbers(e.target.value))}
            required
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button type="submit" className="w-full" loading={loading}>
          완료
        </Button>
      </form>
    </div>
  );
}
