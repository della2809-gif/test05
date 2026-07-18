"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MailCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError("이메일 발송에 실패했습니다. 다시 시도해주세요.");
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <MailCheck className="h-8 w-8 text-primary" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">이메일을 확인해주세요</h2>
          <p className="text-sm text-foreground-secondary">
            <span className="font-medium text-foreground">{email}</span>로<br />
            비밀번호 재설정 링크를 발송했습니다.
          </p>
          <p className="text-xs text-foreground-tertiary mt-2">
            메일이 오지 않으면 스팸 폴더를 확인해주세요.
          </p>
        </div>
        <Link href="/login" className="block text-sm text-foreground-secondary hover:text-foreground underline underline-offset-4">
          로그인 화면으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">비밀번호 찾기</h2>
        <p className="text-sm text-foreground-secondary">
          가입한 이메일을 입력하면 재설정 링크를 보내드립니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            이메일
          </label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" loading={loading}>
          재설정 링크 발송
        </Button>
      </form>

      <p className="text-center text-sm text-foreground-secondary">
        <Link href="/login" className="font-medium text-foreground hover:underline">
          로그인으로 돌아가기
        </Link>
      </p>
    </div>
  );
}
