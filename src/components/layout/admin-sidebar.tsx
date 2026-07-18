"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ADMIN_MENU_SECTIONS } from "@/lib/constants";
import {
  LayoutDashboard, Users, FileText, Blocks, MessageSquare,
  Calculator, Upload, Package, Package2, ArrowLeft, X, Sparkles,
  BookOpen, Link as LinkIcon, HelpCircle, Image as ImageIcon, Video, Workflow, Zap, BrainCircuit,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Users, FileText, Blocks, MessageSquare,
  Calculator, Upload, Package, Package2, BookOpen, LinkIcon, HelpCircle, ImageIcon, Video, Workflow, Zap,
  BrainCircuit,
};

interface AdminSidebarProps {
  onClose?: () => void;
}

export function AdminSidebar({ onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[240px] flex-col border-r border-sidebar-border bg-sidebar-bg">
      {/* Header */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold text-foreground">관리자</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-foreground-tertiary hover:bg-sidebar-item-hover md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Menu Items */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {ADMIN_MENU_SECTIONS.map((section) => (
          <div key={section.section}>
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-foreground-tertiary">
              {section.section}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = iconMap[item.icon];
                const isActive = item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-sidebar-item-active text-sidebar-item-active-text font-medium"
                        : "text-foreground-secondary hover:bg-sidebar-item-hover hover:text-foreground"
                    )}
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Back to Service */}
      <div className="border-t border-sidebar-border p-2">
        <Link
          href="/chat"
          onClick={onClose}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground-secondary hover:bg-sidebar-item-hover hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          서비스로 돌아가기
        </Link>
      </div>
    </aside>
  );
}
