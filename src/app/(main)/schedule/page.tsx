"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, Calendar, Users, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, addDays, isToday, isTomorrow, isPast } from "date-fns";
import { ko } from "date-fns/locale";

interface Schedule {
  id: string;
  contact_id: string | null;
  title: string;
  schedule_type: string;
  life_layer: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  is_done: boolean;
  notes: string | null;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  ao_check:  { label: "AO 확인",  color: "text-amber-600 dark:text-amber-400",  icon: "🔄" },
  milestone: { label: "마일스톤", color: "text-purple-600 dark:text-purple-400", icon: "🏁" },
  meeting:   { label: "미팅",     color: "text-blue-600 dark:text-blue-400",     icon: "🤝" },
  followup:  { label: "팔로업",   color: "text-emerald-600 dark:text-emerald-400", icon: "📞" },
  personal:  { label: "개인",     color: "text-foreground-secondary",            icon: "📌" },
};

function dateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return "오늘";
  if (isTomorrow(d)) return "내일";
  return format(d, "M/d (E)", { locale: ko });
}

const LIFE_LAYERS = [
  { value: "", label: "전체" },
  { value: "개인", label: "개인" },
  { value: "가족", label: "가족" },
  { value: "본업", label: "본업" },
  { value: "유사나", label: "유사나" },
  { value: "투잡", label: "투잡" },
];

export default function SchedulePage() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"week" | "all">("week");
  const [lifeLayer, setLifeLayer] = useState("");

  const today = new Date();
  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const load = useCallback(async () => {
    setLoading(true);
    const from = activeSection === "week" ? weekStart : format(today, "yyyy-MM-dd");
    const to = activeSection === "week" ? weekEnd : format(addDays(today, 30), "yyyy-MM-dd");
    const params = new URLSearchParams({ from, to });
    if (lifeLayer) params.set("life_layer", lifeLayer);
    const res = await fetch(`/api/schedules?${params}`);
    if (!res.ok) { toast.error("일정을 불러오지 못했습니다."); setLoading(false); return; }
    const { data } = await res.json();
    setSchedules(data ?? []);
    setLoading(false);
  }, [activeSection, lifeLayer, weekStart, weekEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function toggleDone(s: Schedule) {
    await fetch(`/api/schedules/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_done: !s.is_done }),
    });
    setSchedules((prev) => prev.map((x) => x.id === s.id ? { ...x, is_done: !x.is_done } : x));
  }

  // 핵심 관리 항목 (AO, 마일스톤) 상단 고정
  const critical = schedules.filter((s) =>
    ["ao_check", "milestone"].includes(s.schedule_type) && !s.is_done
  );
  const people = schedules.filter((s) =>
    ["meeting", "followup"].includes(s.schedule_type)
  );
  const others = schedules.filter((s) => s.schedule_type === "personal");

  const overdueCount = schedules.filter(
    (s) => !s.is_done && isPast(new Date(s.scheduled_date)) && !isToday(new Date(s.scheduled_date))
  ).length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-lg px-4 py-6 space-y-5">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">일정 관리</h1>
            <p className="text-xs text-foreground-secondary mt-0.5">
              {format(today, "yyyy년 M월 d일 (E)", { locale: ko })}
              {overdueCount > 0 && (
                <span className="ml-2 text-destructive font-medium">미완료 {overdueCount}건</span>
              )}
            </p>
          </div>
          <Button size="sm" onClick={() => router.push("/schedule/new")}>
            <Plus className="h-4 w-4 mr-1" /> 추가
          </Button>
        </div>

        {/* 기간 탭 */}
        <div className="flex gap-2">
          {[{ key: "week", label: "이번 주" }, { key: "all", label: "30일" }].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key as "week" | "all")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeSection === key
                  ? "bg-foreground text-background"
                  : "bg-surface border border-border text-foreground-secondary hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Life Layer 필터 */}
        <div className="flex gap-1.5 flex-wrap">
          {LIFE_LAYERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setLifeLayer(value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                lifeLayer === value
                  ? "bg-foreground text-background"
                  : "bg-surface border border-border text-foreground-secondary hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : (
          <div className="space-y-5">
            {/* A. 핵심 관리 (AO/마일스톤) */}
            {critical.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="h-4 w-4 text-amber-500" />
                  <p className="text-sm font-semibold text-foreground">핵심 관리</p>
                </div>
                <div className="space-y-1.5">
                  {critical.map((s) => (
                    <ScheduleItem key={s.id} s={s} onToggle={toggleDone} />
                  ))}
                </div>
              </section>
            )}

            {/* B. 사람 기반 (미팅/팔로업) */}
            {people.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <p className="text-sm font-semibold text-foreground">사람 관리</p>
                </div>
                <div className="space-y-1.5">
                  {people.map((s) => (
                    <ScheduleItem key={s.id} s={s} onToggle={toggleDone} />
                  ))}
                </div>
              </section>
            )}

            {/* C. 기타 일정 */}
            {others.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-foreground-secondary" />
                  <p className="text-sm font-semibold text-foreground">기타 일정</p>
                </div>
                <div className="space-y-1.5">
                  {others.map((s) => (
                    <ScheduleItem key={s.id} s={s} onToggle={toggleDone} />
                  ))}
                </div>
              </section>
            )}

            {schedules.length === 0 && (
              <div className="text-center py-12 text-foreground-secondary text-sm">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>일정이 없습니다</p>
                <p className="text-xs mt-1">회원 등록 시 AO/마일스톤이 자동 추가됩니다</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ScheduleItem({ s, onToggle }: { s: Schedule; onToggle: (s: Schedule) => void }) {
  const config = TYPE_CONFIG[s.schedule_type] ?? TYPE_CONFIG.personal;
  const overdue = !s.is_done && isPast(new Date(s.scheduled_date)) && !isToday(new Date(s.scheduled_date));

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
      s.is_done ? "border-border bg-surface opacity-50" : overdue ? "border-destructive/30 bg-destructive/5" : "border-border bg-surface"
    }`}>
      <button
        onClick={() => onToggle(s)}
        className={`mt-0.5 shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
          s.is_done ? "bg-emerald-500 border-emerald-500" : "border-border hover:border-foreground"
        }`}
      >
        {s.is_done && <Check className="h-3 w-3 text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs">{config.icon}</span>
          <p className={`text-sm font-medium ${s.is_done ? "line-through text-foreground-secondary" : "text-foreground"}`}>
            {s.title}
          </p>
          {s.life_layer && (
            <span className="text-xs text-foreground-tertiary">#{s.life_layer}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className={`text-xs ${overdue ? "text-destructive font-medium" : "text-foreground-secondary"}`}>
            {dateLabel(s.scheduled_date)}
            {s.scheduled_time && ` ${s.scheduled_time.slice(0, 5)}`}
          </p>
          <span className={`text-xs ${config.color}`}>{config.label}</span>
        </div>
        {s.notes && <p className="text-xs text-foreground-tertiary mt-0.5 truncate">{s.notes}</p>}
      </div>
    </div>
  );
}
