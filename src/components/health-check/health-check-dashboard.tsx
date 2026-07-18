"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ArrowRight, ClipboardCheck, FileText, History, Sparkles } from "lucide-react";
import { MedicalDisclaimer } from "./medical-disclaimer";

interface AssessmentSummary {
  id: string;
  health_score: number;
  health_grade: string;
  created_at: string;
}

export function HealthCheckDashboard() {
  const [items, setItems] = useState<AssessmentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/health-assessments")
      .then((response) => response.ok ? response.json() : { data: [] })
      .then(({ data }) => setItems(data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const latest = items[0];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-background to-lime-50 p-6 dark:border-emerald-900 dark:from-emerald-950/50 dark:to-background md:p-10">
        <div className="grid items-center gap-8 md:grid-cols-[1.25fr_.75fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-subtle px-3 py-1 text-xs font-semibold text-accent-foreground">
              <Sparkles className="h-3.5 w-3.5" /> GENIEA FUNCTIONAL HEALTH COACH
            </span>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              내 몸의 신호를 읽고,<br />건강자산을 키우세요.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-foreground-secondary md:text-base">
              12대 건강영역 60문항으로 현재 상태를 차분히 점검하고,
              우선 관리영역과 4주 실천 방향을 확인합니다.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/health-check/new" className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover">
                건강체크 시작하기 <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/health-report-preview" className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover">
                샘플 보고서 보기 <FileText className="h-4 w-4" />
              </Link>
              <Link href="/health-report-mobile-preview" className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover">
                모바일 화면 보기
              </Link>
              <span className="text-xs text-foreground-tertiary">약 8~10분 · 60문항</span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-border dark:bg-surface">
            {latest ? (
              <>
                <p className="text-xs font-semibold text-foreground-secondary">최근 건강관리 지표</p>
                <div className="mt-3 flex items-end gap-2"><strong className="text-6xl tracking-tight">{latest.health_score}</strong><span className="mb-2 text-sm text-foreground-tertiary">/ 100</span></div>
                <p className="mt-2 font-semibold text-primary">{latest.health_grade}</p>
                <Link href={`/health-check/result/${latest.id}`} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-foreground">최근 결과 보기 <ArrowRight className="h-4 w-4" /></Link>
              </>
            ) : (
              <div className="py-4 text-center">
                <Activity className="mx-auto h-10 w-10 text-primary" />
                <p className="mt-4 font-semibold">{loading ? "검사 기록 확인 중..." : "첫 건강체크를 시작해 보세요."}</p>
                <p className="mt-2 text-xs leading-5 text-foreground-secondary">현재 상태를 기록하면 다음 검사에서 변화를 비교할 수 있습니다.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          [ClipboardCheck, "12대 건강자산", "혈당대사부터 회복력까지 몸의 신호를 균형 있게 살펴봅니다."],
          [FileText, "맞춤 리포트", "우선영역·건강자산·원인 후보·4주 로드맵을 정리합니다."],
          [History, "변화 기록", "과거 결과를 보관하고 재검사 시 변화 흐름을 확인합니다."],
        ].map(([Icon, title, description]) => {
          const FeatureIcon = Icon as typeof Activity;
          return <article className="rounded-2xl border border-border bg-surface p-5" key={title as string}><FeatureIcon className="h-5 w-5 text-primary" /><h2 className="mt-4 font-semibold">{title as string}</h2><p className="mt-2 text-sm leading-6 text-foreground-secondary">{description as string}</p></article>;
        })}
      </section>

      {items.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-semibold">과거 건강체크</h2>
          <div className="mt-4 divide-y divide-border">
            {items.map((item) => (
              <Link className="flex items-center justify-between py-4 text-sm" href={`/health-check/result/${item.id}`} key={item.id}>
                <div><b>{item.health_score}점 · {item.health_grade}</b><p className="mt-1 text-xs text-foreground-tertiary">{new Date(item.created_at).toLocaleDateString("ko-KR")}</p></div>
                <ArrowRight className="h-4 w-4 text-foreground-tertiary" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <MedicalDisclaimer />
    </div>
  );
}
