"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Plus, Archive, Settings, User, X, Sparkles, Users, Calendar, HeartPulse } from "lucide-react";
import { ConversationList } from "@/components/chat/conversation-list";

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[260px] flex-col border-r border-sidebar-border bg-sidebar-bg">
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        <Link href="/chat" className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold"><span className="text-foreground">GENI</span><span className="text-primary">EA</span></span>
        </Link>
        {onClose && <button onClick={onClose} aria-label="메뉴 닫기" className="rounded-lg p-1.5 text-foreground-tertiary hover:bg-sidebar-item-hover md:hidden"><X className="h-5 w-5" /></button>}
      </div>

      <div className="p-3">
        <Link href="/chat" onClick={onClose} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-transparent text-sm font-medium text-foreground transition-colors hover:bg-sidebar-item-hover">
          <Plus className="h-4 w-4" /> 새 대화
        </Link>
      </div>

      <div className="px-2 pb-2">
        <SidebarLink href="/health-check" icon={HeartPulse} label="건강자산 체크" active={pathname.startsWith("/health-check")} onClick={onClose} featured />
      </div>

      <div className="flex-1 overflow-y-auto px-2"><ConversationList /></div>

      <div className="space-y-0.5 border-t border-sidebar-border p-2">
        <SidebarLink href="/contacts" icon={Users} label="회원" active={pathname.startsWith("/contacts")} onClick={onClose} />
        <SidebarLink href="/schedule" icon={Calendar} label="일정" active={pathname.startsWith("/schedule")} onClick={onClose} />
        <SidebarLink href="/archive" icon={Archive} label="아카이브" active={pathname.startsWith("/archive")} onClick={onClose} />
        <SidebarLink href="/settings" icon={Settings} label="설정" active={pathname === "/settings"} onClick={onClose} />
        <SidebarLink href="/profile" icon={User} label="프로필" active={pathname === "/profile"} onClick={onClose} />
      </div>
    </aside>
  );
}

function SidebarLink({
  href, icon: Icon, label, active, onClick, featured,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick?: () => void;
  featured?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-sidebar-item-active font-medium text-sidebar-item-active-text"
          : featured
            ? "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
            : "text-foreground-secondary hover:bg-sidebar-item-hover hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />{label}
    </Link>
  );
}
