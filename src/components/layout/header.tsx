"use client";

import { Menu, Sparkles } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="flex h-12 md:h-14 items-center justify-between border-b border-border bg-background px-4">
      {/* Left: hamburger (mobile) */}
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-foreground-secondary hover:bg-surface-hover md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Center: logo (mobile) */}
      <div className="flex items-center gap-1.5 md:hidden">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-base font-semibold">
          <span className="text-foreground">GENI</span>
          <span className="text-primary">EA</span>
        </span>
      </div>

      {/* Desktop: empty left */}
      <div className="hidden md:block" />

      {/* Right: theme toggle */}
      <ThemeToggle />
    </header>
  );
}
