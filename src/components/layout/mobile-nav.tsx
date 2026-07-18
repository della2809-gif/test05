"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MessageSquare, Archive, Users, Calendar, HeartPulse } from "lucide-react";

export function MobileNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/chat")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-border bg-background pb-safe md:hidden">
      <TabLink href="/chat" icon={MessageSquare} label="채팅" active={false} />
      <TabLink href="/health-check" icon={HeartPulse} label="건강체크" active={pathname.startsWith("/health-check")} />
      <TabLink href="/contacts" icon={Users} label="회원" active={pathname.startsWith("/contacts")} />
      <TabLink href="/schedule" icon={Calendar} label="일정" active={pathname.startsWith("/schedule")} />
      <TabLink href="/archive" icon={Archive} label="아카이브" active={pathname.startsWith("/archive")} />
    </nav>
  );
}

function TabLink({ href, icon: Icon, label, active }: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
}) {
  return <Link href={href} className={cn("flex flex-col items-center gap-0.5 px-2 py-1", active ? "text-primary" : "text-foreground-tertiary")}><Icon className="h-5 w-5" /><span className="text-[10px] font-medium">{label}</span></Link>;
}
