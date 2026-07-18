"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clipboard,
  Database,
  Gauge,
  Lightbulb,
  RefreshCw,
  Save,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  CATEGORY_META,
  DEFAULT_CONTENT_MIX,
  DEFAULT_CONTENT_TOPICS,
  MODE_META,
} from "@/features/content-ai/data";
import { generateWeeklyCalendar, validateContentMix } from "@/features/content-ai/recommendation";
import {
  CONTENT_CATEGORIES,
  type CalendarRecommendation,
  type ContentMix,
  type RecommendationMode,
} from "@/features/content-ai/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MODES = Object.keys(MODE_META) as RecommendationMode[];

interface StrategyWriteResult {
  error: { message: string } | null;
}

interface StrategyTableWriter {
  upsert(
    values: {
      id: string;
      name: string;
      campaign_name: string;
      health_ratio: number;
      lifestyle_ratio: number;
      ai_tech_ratio: number;
      health_assets_ratio: number;
      community_ratio: number;
      recommendation_mode: RecommendationMode;
      is_active: boolean;
      created_by: null;
    },
    options: { onConflict: string },
  ): PromiseLike<StrategyWriteResult>;
}

function MixEditor({
  mix,
  onChange,
}: {
  mix: ContentMix;
  onChange: (mix: ContentMix) => void;
}) {
  const total = CONTENT_CATEGORIES.reduce((sum, category) => sum + mix[category], 0);

  return (
    <Card className="p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">콘텐츠 운영 비율</h2>
          <p className="mt-1 text-xs text-foreground-secondary">
            이번 캠페인에서 다룰 분야별 비중입니다.
          </p>
        </div>
        <Badge variant={total === 100 ? "success" : "warning"}>합계 {total}%</Badge>
      </div>

      <div className="space-y-4">
        {CONTENT_CATEGORIES.map((category) => {
          const meta = CATEGORY_META[category];
          return (
            <label key={category} className="block">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{meta.label}</span>
                <span className="tabular-nums text-foreground-secondary">{mix[category]}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={mix[category]}
                onChange={(event) =>
                  onChange({ ...mix, [category]: Number(event.target.value) })
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                aria-label={`${meta.label} 비율`}
              />
            </label>
          );
        })}
      </div>

      <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-muted">
        {CONTENT_CATEGORIES.map((category) => (
          <div
            key={category}
            style={{
              width: `${mix[category]}%`,
              backgroundColor: CATEGORY_META[category].color,
            }}
          />
        ))}
      </div>
    </Card>
  );
}

function ModeSelector({
  mode,
  onChange,
}: {
  mode: RecommendationMode;
  onChange: (mode: RecommendationMode) => void;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4">
        <h2 className="font-semibold text-foreground">추천 목적</h2>
        <p className="mt-1 text-xs text-foreground-secondary">
          이번 주 콘텐츠가 가장 잘해야 할 일을 선택하세요.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {MODES.map((value) => {
          const selected = value === mode;
          return (
            <button
              type="button"
              key={value}
              onClick={() => onChange(value)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                selected
                  ? "border-primary bg-primary-subtle"
                  : "border-border bg-background hover:border-border-hover",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {MODE_META[value].label}
                </span>
                {selected && <Check className="h-4 w-4 text-primary" />}
              </div>
              <p className="mt-1 text-xs leading-5 text-foreground-secondary">
                {MODE_META[value].description}
              </p>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function CalendarCard({ item }: { item: CalendarRecommendation }) {
  const meta = CATEGORY_META[item.topic.interestCategory];

  return (
    <article className="group relative rounded-2xl border border-border bg-background p-4 transition-colors hover:border-border-hover">
      <div
        className="absolute inset-y-4 left-0 w-1 rounded-r-full"
        style={{ backgroundColor: meta.color }}
      />
      <div className="ml-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: meta.color }}
          >
            {item.day}
          </span>
          <Badge variant="outline">{meta.shortLabel}</Badge>
          <Badge>{item.format}</Badge>
          <span className="ml-auto text-xs font-medium tabular-nums text-foreground-tertiary">
            적합도 {Math.round(item.score)}
          </span>
        </div>

        <h3 className="mt-3 text-base font-semibold leading-6 text-foreground">
          {item.topic.title}
        </h3>
        <p className="mt-1.5 text-xs leading-5 text-foreground-secondary">
          {item.topic.audienceProblem}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.topic.healthAssetCodes.slice(0, 4).map((code) => (
            <span
              key={code}
              className="rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground"
            >
              {code}
            </span>
          ))}
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <div className="flex items-center gap-2 text-xs text-foreground-secondary">
            <Target className="h-3.5 w-3.5 text-primary" />
            <span>CTA {item.topic.ctaLevel}단계</span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-medium text-foreground">{item.topic.recommendedCta}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-foreground-tertiary">
            <Lightbulb className="h-3.5 w-3.5" />
            {item.reason}
          </div>
          <p className="mt-2 text-[11px] text-foreground-tertiary">
            추천 채널 · {item.channel}
          </p>
        </div>
      </div>
    </article>
  );
}

export function ContentAiDashboard() {
  const [mix, setMix] = useState<ContentMix>(DEFAULT_CONTENT_MIX);
  const [mode, setMode] = useState<RecommendationMode>("balanced");
  const [calendar, setCalendar] = useState<CalendarRecommendation[]>(() =>
    generateWeeklyCalendar(DEFAULT_CONTENT_TOPICS, {
      mix: DEFAULT_CONTENT_MIX,
      mode: "balanced",
    }),
  );
  const [saving, setSaving] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(() => new Date());

  const total = useMemo(
    () => CONTENT_CATEGORIES.reduce((sum, category) => sum + mix[category], 0),
    [mix],
  );

  function handleGenerate() {
    if (!validateContentMix(mix)) {
      toast.error(`운영 비율의 합계를 100%로 맞춰주세요. 현재 ${total}%입니다.`);
      return;
    }
    setCalendar(generateWeeklyCalendar(DEFAULT_CONTENT_TOPICS, { mix, mode }));
    setGeneratedAt(new Date());
    toast.success("새 주간 콘텐츠 캘린더를 만들었습니다.");
  }

  async function handleSaveStrategy() {
    if (!validateContentMix(mix)) {
      toast.error("운영 비율의 합계를 100%로 맞춰주세요.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    // 수동 DB 타입은 Supabase SDK의 관계 추론에서 신규 테이블을 never로 좁힐 수 있어
    // 이 화면에 필요한 upsert 계약만 명시한다.
    const strategyTable = supabase.from(
      "content_strategy_settings",
    ) as unknown as StrategyTableWriter;
    const { error } = await strategyTable.upsert(
      {
        id: "00000000-0000-0000-0000-000000000001",
        name: "기본 콘텐츠 전략",
        campaign_name: "이번 달 캠페인",
        health_ratio: mix.health,
        lifestyle_ratio: mix.lifestyle,
        ai_tech_ratio: mix.ai_tech,
        health_assets_ratio: mix.health_assets,
        community_ratio: mix.community,
        recommendation_mode: mode,
        is_active: true,
        created_by: null,
      },
      { onConflict: "id" },
    );
    setSaving(false);

    if (error) {
      toast.error("DB 마이그레이션 적용 후 전략을 저장할 수 있습니다.");
      return;
    }
    toast.success("콘텐츠 전략을 저장했습니다.");
  }

  async function handleCopy() {
    const text = calendar
      .map(
        (item) =>
          `${item.day}요일 | ${CATEGORY_META[item.topic.interestCategory].label}\n주제: ${item.topic.title}\n형식: ${item.format} · ${item.channel}\nCTA: ${item.topic.recommendedCta}`,
      )
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    toast.success("주간 캘린더를 클립보드에 복사했습니다.");
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <Sparkles className="h-4 w-4" />
            WELLSET Content AI
          </div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">
            관심사에서 건강자산으로 이어지는 콘텐츠
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground-secondary">
            건강, 라이프스타일, AI, 가족 같은 유입 관심사를 조합해 브랜드 비율에 맞는
            주간 콘텐츠와 자연스러운 CTA를 추천합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleSaveStrategy} loading={saving}>
            <Save className="h-4 w-4" />
            전략 저장
          </Button>
          <Button onClick={handleGenerate} disabled={total !== 100}>
            <RefreshCw className="h-4 w-4" />
            캘린더 생성
          </Button>
        </div>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3 bg-background">
          <div className="rounded-xl bg-primary-subtle p-2.5 text-primary">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{DEFAULT_CONTENT_TOPICS.length}</p>
            <p className="text-xs text-foreground-secondary">검수된 기본 주제</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 bg-background">
          <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            <Gauge className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">6</p>
            <p className="text-xs text-foreground-secondary">추천 목적 모드</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 bg-background">
          <div className="rounded-xl bg-violet-50 p-2.5 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">7일</p>
            <p className="text-xs text-foreground-secondary">주간 발행 캘린더</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <MixEditor mix={mix} onChange={setMix} />
          <ModeSelector mode={mode} onChange={setMode} />
        </aside>

        <section className="rounded-2xl border border-border bg-surface p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">이번 주 콘텐츠 캘린더</h2>
              </div>
              <p className="mt-1 text-xs text-foreground-secondary">
                {MODE_META[mode].label} · {generatedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 생성
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Clipboard className="h-3.5 w-3.5" />
              복사
            </Button>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {calendar.map((item) => (
              <CalendarCard key={`${item.day}-${item.topic.id}`} item={item} />
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        추천 콘텐츠는 건강정보 제공과 생활습관 점검을 위한 초안입니다. 질환의 진단·치료·처방을
        단정하지 않으며, 의료적 판단이 필요한 내용은 전문가 검수를 거쳐 발행하세요.
      </div>
    </div>
  );
}
