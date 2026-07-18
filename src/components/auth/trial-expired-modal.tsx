"use client";

import { Sparkles, Lock } from "lucide-react";

export function TrialExpiredModal() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 rounded-2xl border border-border bg-surface p-8 shadow-2xl text-center">
        {/* 아이콘 */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <Lock className="h-8 w-8 text-destructive" />
        </div>

        {/* 제목 */}
        <h2 className="text-xl font-bold text-foreground mb-3">
          무료 체험 기간이 종료되었습니다
        </h2>

        {/* 안내 문구 (임시 — 클라이언트 문구 컨펌 후 수정 필요) */}
        <p className="text-sm text-foreground-secondary leading-relaxed mb-6">
          7일 무료 체험 기간이 만료되었습니다.
          <br />
          계속 이용하시려면 유료 회원으로 전환해 주세요.
          <br /><br />
          <span className="text-foreground-tertiary text-xs">
            ※ 문의: 관리자에게 연락해 주세요
            {/* TODO: 클라이언트 확인 후 연락처/안내 문구 업데이트 */}
          </span>
        </p>

        {/* 브랜드 */}
        <div className="flex items-center justify-center gap-1.5 text-foreground-tertiary text-xs">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>지니아</span>
        </div>
      </div>
    </div>
  );
}
