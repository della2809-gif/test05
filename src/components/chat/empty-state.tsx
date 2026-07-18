"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Calculator,
  Camera,
  CircleHelp,
  ClipboardList,
  Compass,
  DollarSign,
  FileText,
  Folder,
  Heart,
  ImageIcon,
  Link,
  type LucideIcon,
  MessageCircle,
  Plane,
  PlayCircle,
  RotateCcw,
  Search,
  Sparkles,
  Stethoscope,
  Target,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getIconByName, isImageIconValue } from "@/lib/giplet-icons";
import { isPilotHostname, PILOT_GIPLETS } from "@/lib/giplet-pilot";
import type { AdminCase, AdminGiplet } from "@/types/database";

type GipletIconConfig = {
  Icon: LucideIcon;
  className: string;
  // 커스텀 업로드 이미지 URL. 있으면 Lucide 대신 <img>로 렌더한다.
  imageSrc?: string;
};

// CR-002: 클라이언트 요청은 "형형색색"이 아니라 깔끔한 모노톤.
// 아이콘 '모양'으로 기능을 구분하고, 색은 단색(중립색)으로 통일한다.
const ICON_TONE = "text-foreground-secondary";

const GIPLET_ICONS: Record<string, GipletIconConfig> = {
  quotation: { Icon: Camera, className: ICON_TONE },
  auto_quote: { Icon: Calculator, className: ICON_TONE },
  commission: { Icon: DollarSign, className: ICON_TONE },
  travel: { Icon: Plane, className: ICON_TONE },
  contact: { Icon: Users, className: ICON_TONE },
  story: { Icon: Heart, className: ICON_TONE },
  my_story: { Icon: FileText, className: ICON_TONE },
  business: { Icon: Sparkles, className: ICON_TONE },
  list: { Icon: ClipboardList, className: ICON_TONE },
  link: { Icon: Link, className: ICON_TONE },
  image: { Icon: ImageIcon, className: ICON_TONE },
  meeting: { Icon: PlayCircle, className: ICON_TONE },
  faq: { Icon: CircleHelp, className: ICON_TONE },
  youtube: { Icon: PlayCircle, className: ICON_TONE },
  general: { Icon: MessageCircle, className: ICON_TONE },
  meeting_prep: { Icon: FileText, className: ICON_TONE },
  new_product: { Icon: Stethoscope, className: ICON_TONE },
  product: { Icon: Search, className: ICON_TONE },
  product_search: { Icon: Search, className: ICON_TONE },
  product_recommendation: { Icon: Sparkles, className: ICON_TONE },
};

function getGipletIcon(key: string, name?: string | null): GipletIconConfig {
  if (GIPLET_ICONS[key]) return GIPLET_ICONS[key];

  const label = `${key} ${name ?? ""}`.toLowerCase();
  if (label.includes("현실") || label.includes("점검")) return { Icon: Target, className: ICON_TONE };
  if (label.includes("목표") || label.includes("꿈")) return { Icon: Target, className: ICON_TONE };
  if (label.includes("수당")) return { Icon: DollarSign, className: ICON_TONE };
  if (label.includes("여행")) return { Icon: Plane, className: ICON_TONE };
  if (label.includes("사업")) return { Icon: Sparkles, className: ICON_TONE };
  if (label.includes("마이스토리") || label.includes("my story")) return { Icon: FileText, className: ICON_TONE };
  if (label.includes("명단") || label.includes("회원")) return { Icon: Users, className: ICON_TONE };
  if (label.includes("제품 정보") || label.includes("제품 정보 검색")) return { Icon: Search, className: ICON_TONE };
  if (label.includes("제품 추천") || label.includes("견적")) return { Icon: Sparkles, className: ICON_TONE };
  if (label.includes("건강")) return { Icon: Stethoscope, className: ICON_TONE };
  if (label.includes("이미지")) return { Icon: ImageIcon, className: ICON_TONE };
  if (label.includes("유튜브") || label.includes("youtube")) return { Icon: PlayCircle, className: ICON_TONE };
  if (label.includes("링크")) return { Icon: Link, className: ICON_TONE };
  if (label.includes("faq")) return { Icon: CircleHelp, className: ICON_TONE };
  if (label.includes("상담")) return { Icon: MessageCircle, className: ICON_TONE };
  if (label.includes("미팅")) return { Icon: PlayCircle, className: ICON_TONE };
  if (label.includes("스토리")) return { Icon: Heart, className: ICON_TONE };
  if (label.includes("자료")) return { Icon: Folder, className: ICON_TONE };
  if (label.includes("기트") || label.includes("복제")) return { Icon: RotateCcw, className: ICON_TONE };
  if (label.includes("리더")) return { Icon: Compass, className: ICON_TONE };
  if (label.includes("강의")) return { Icon: BookOpen, className: ICON_TONE };

  return { Icon: Sparkles, className: ICON_TONE };
}

// 운영자가 지정한 아이콘(icon 컬럼)이 있으면 우선 사용, 없으면 기존 자동 매칭으로 폴백.
// icon 값이 http(s) URL이면 커스텀 업로드 이미지로 취급한다.
function resolveGipletIcon(icon: string | null | undefined, key: string, name?: string | null): GipletIconConfig {
  if (isImageIconValue(icon)) {
    // Icon은 타입 충족용 폴백(imageSrc가 있으면 렌더에 쓰이지 않음)
    return { Icon: ImageIcon, className: ICON_TONE, imageSrc: icon as string };
  }
  const named = getIconByName(icon);
  if (named) return { Icon: named, className: ICON_TONE };
  return getGipletIcon(key, name);
}

function GipletIcon({ icon, size = "md" }: { icon: GipletIconConfig; size?: "md" | "lg" }) {
  const { Icon, className, imageSrc } = icon;
  const sizeClass = size === "lg" ? "h-6 w-6" : "h-5 w-5";
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 transition group-hover:bg-white/10">
      {imageSrc ? (
        // CR-002 모노톤 통일: 컬러 원본이어도 카드에서는 회색조로 표시
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt="" className={`${sizeClass} object-contain grayscale`} />
      ) : (
        <Icon className={`${sizeClass} ${className}`} strokeWidth={2.2} />
      )}
    </span>
  );
}

interface EmptyStateProps {
  onSelectGiplet?: (giplet: AdminGiplet, mode: "self" | "guide") => void;
  onSelectCase?: (caseKey: string, caseName: string, mode: "self" | "guide") => void;
  onNavigate?: (href: string) => void;
  // 사용자가 설정에서 고른 기본 모드. 지플릿/케이스 시작 시 conversation.mode에 반영된다.
  defaultMode?: "self" | "guide";
}

export function EmptyState({ onSelectGiplet, onSelectCase, onNavigate, defaultMode = "self" }: EmptyStateProps) {
  const [giplets, setGiplets] = useState<AdminGiplet[]>([]);
  const [cases, setCases] = useState<AdminCase[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      (supabase.from("admin_giplets"))
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      (supabase.from("admin_cases"))
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]).then(([{ data: gipletsData }, { data: casesData }]) => {
      if (isPilotHostname(window.location.hostname)) {
        setGiplets(PILOT_GIPLETS);
        setCases([]);
        setLoaded(true);
        return;
      }

      // case_key가 있는 지플릿은 지플릿 그리드에서 제외 (케이스 섹션에서 표시)
      const caseKeys = new Set((casesData as AdminCase[] ?? []).map((c) => c.case_key));
      const pureGiplets = (gipletsData as AdminGiplet[] ?? []).filter(
        (g) => !g.case_key || !caseKeys.has(g.case_key)
      );

      setGiplets(pureGiplets);
      // 활성화된 케이스를 모두 표시 (giplet 연결 여부와 무관)
      setCases(casesData as AdminCase[] ?? []);
      setLoaded(true);
    });
  }, []);

  function handleCaseClick(c: AdminCase) {
    onSelectCase?.(c.case_key, c.name, defaultMode);
  }

  function handleGipletClick(g: AdminGiplet) {
    onSelectGiplet?.(g, defaultMode);
  }

  return (
    <div className="flex h-full flex-col items-center px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-lg space-y-6 my-auto">

        {/* 인사 */}
        <div className="text-center space-y-1.5">
          <h2 className="text-xl font-bold text-foreground">안녕하세요 ^^</h2>
          <p className="text-sm text-foreground-secondary">어떻게 시작할까요?</p>
        </div>

        {/* 케이스 섹션 */}
        {loaded && cases.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-tertiary mb-2.5">
              케이스 — 단계별 워크플로우
            </p>
            <div className="space-y-2">
              {cases.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleCaseClick(c)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border bg-surface hover:bg-surface-hover hover:border-border-hover transition-all text-left group"
                >
                  <GipletIcon icon={resolveGipletIcon(c.icon, c.case_key, c.name)} size="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">{c.name}</div>
                    {c.description && (
                      <div className="text-xs text-foreground-tertiary mt-0.5 truncate">{c.description}</div>
                    )}
                  </div>
                  <span className="text-foreground-tertiary group-hover:text-foreground-secondary transition-colors text-lg flex-shrink-0">›</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 지플릿 섹션 */}
        {loaded && giplets.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-tertiary mb-2.5">
              지플릿 — 단발 실행
            </p>
            <div className={giplets.length === 3 ? "grid grid-cols-3 gap-2" : "grid grid-cols-4 gap-2"}>
              {giplets.map((g) => (
                <button
                  key={g.id}
                  onClick={() => handleGipletClick(g)}
                  className="group flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border border-border bg-surface hover:bg-surface-hover hover:border-border-hover transition-all"
                >
                  <GipletIcon icon={resolveGipletIcon(g.icon, g.giplet_key, g.name)} />
                  <span className="text-[11px] font-medium text-foreground text-center leading-tight">
                    {g.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 로딩 */}
        {!loaded && (
          <div className="flex justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        )}

        {/* 바로가기 */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onNavigate?.("/contacts")}
            className="group flex flex-col gap-1 px-4 py-3.5 rounded-2xl border border-border bg-surface hover:bg-surface-hover hover:border-border-hover transition-all text-left"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-foreground-tertiary group-hover:bg-emerald-500 transition-colors flex-shrink-0" />
              <span className="text-sm font-semibold text-foreground">회원 관리</span>
            </div>
            <p className="text-xs text-foreground-tertiary">회원·고객 보기</p>
          </button>
          <button
            onClick={() => onNavigate?.("/schedule")}
            className="group flex flex-col gap-1 px-4 py-3.5 rounded-2xl border border-border bg-surface hover:bg-surface-hover hover:border-border-hover transition-all text-left"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-foreground-tertiary group-hover:bg-orange-500 transition-colors flex-shrink-0" />
              <span className="text-sm font-semibold text-foreground">일정 관리</span>
            </div>
            <p className="text-xs text-foreground-tertiary">미팅·팔로업 일정 보기</p>
          </button>
        </div>

      </div>
    </div>
  );
}
