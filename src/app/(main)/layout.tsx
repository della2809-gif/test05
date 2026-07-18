"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { TrialExpiredModal } from "@/components/auth/trial-expired-modal";
import { createClient } from "@/lib/supabase/client";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [trialExpired, setTrialExpired] = useState(false);
  const pathname = usePathname();
  const isChatPage = pathname.startsWith("/chat");

  useEffect(() => {
    async function checkTrial() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("status, role, free_trial_expires_at")
        .eq("id", user.id)
        .single();

      if (!profile) return;

      // 어드민 또는 Paid → 제한 없음
      if (profile.role === "admin" || profile.status === "paid") return;

      // free_trial_expires_at이 NULL → 기존 가입자, 무제한
      if (!profile.free_trial_expires_at) return;

      // 만료 여부 체크
      if (new Date(profile.free_trial_expires_at) < new Date()) {
        setTrialExpired(true);
      }
    }

    checkTrial();
  }, []);

  return (
    <div className="flex h-dvh bg-background">
      {/* 체험 기간 만료 모달 (닫기 불가) */}
      {trialExpired && <TrialExpiredModal />}

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[260px] animate-in slide-in-from-left duration-200">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className={`flex-1 overflow-auto${isChatPage ? "" : " pb-14 md:pb-0"}`}>
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar — 비채팅 페이지에서만 표시 */}
      <MobileNav />
    </div>
  );
}
