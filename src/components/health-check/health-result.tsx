"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HealthReport } from "@/features/health-check/types";
import { getRiskLabel } from "@/features/health-check/scoring";
import { MedicalDisclaimer } from "./medical-disclaimer";

export function HealthResult({ id, fullReport = false }: { id: string; fullReport?: boolean }) {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/health-assessments/${id}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "결과를 찾을 수 없습니다.");
        return body.data as HealthReport;
      })
      .then(setReport)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "결과를 불러오지 못했습니다."));
  }, [id]);

  if (error) return <StateMessage title={error} />;
  if (!report) return <StateMessage title="건강 결과를 불러오고 있습니다." />;
  if (fullReport) return <FullReport report={report} />;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 lg:px-8">
      {report.safetyWarning && <SafetyAlert />}
      <section className="grid gap-5 md:grid-cols-[.8fr_1.2fr]">
        <article className="rounded-2xl border border-border bg-surface p-7 text-center">
          <div className="mx-auto grid h-44 w-44 place-items-center rounded-full bg-[conic-gradient(var(--primary)_var(--score),var(--muted)_0)] p-3" style={{ "--score": `${report.healthScore}%` } as React.CSSProperties}>
            <div className="grid h-full w-full place-items-center rounded-full bg-surface">
              <div><strong className="block text-5xl tracking-tight">{report.healthScore}</strong><span className="text-xs text-foreground-secondary">건강관리 지표</span></div>
            </div>
          </div>
          <h1 className="mt-5 text-xl font-bold">{report.healthGrade}</h1>
          <p className="mt-2 text-xs text-foreground-secondary">의료 위험도가 아닌 서비스 내부 참고 지표입니다.</p>
        </article>
        <article className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-xs font-bold tracking-[0.15em] text-primary">TOP PRIORITIES</p>
          <h2 className="mt-2 text-xl font-bold">먼저 살펴볼 건강영역</h2>
          <div className="mt-5 space-y-3">
            {report.topPriorities.map((domain, index) => (
              <div className="grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-xl bg-muted/60 p-3" key={domain.code}>
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">{index + 1}</span>
                <div><b className="text-sm">{domain.name}</b><p className="text-xs text-foreground-secondary">{domain.summary}{domain.priorityScore !== undefined ? ` · 우선도 ${domain.priorityScore}` : ""}</p></div>
                <RiskBadge level={domain.level} />
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/health-check/report/${id}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">전체 리포트 보기 <ArrowRight className="h-4 w-4" /></Link>
            <Button variant="outline" onClick={() => window.print()}><Download className="h-4 w-4" /> PDF 저장</Button>
          </div>
        </article>
      </section>

      <ReportSection title="12대 건강자산 결과">
        <div className="space-y-3">
          {report.domains.map((domain) => (
            <div className="grid grid-cols-[92px_1fr_72px] items-center gap-3 text-sm" key={domain.code}>
              <b>{domain.name}</b>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted"><i className={`block h-full rounded-full ${riskBar(domain.level)}`} style={{ width: `${domain.normalizedRisk}%` }} /></div>
              <RiskBadge level={domain.level} />
            </div>
          ))}
        </div>
      </ReportSection>

      <ReportSection title="잘 유지하고 있는 건강자산">
        <div className="grid gap-3 md:grid-cols-3">
          {report.topAssets.map((domain, index) => <article className="rounded-xl border border-border bg-primary-subtle/40 p-4" key={domain.code}><span className="text-xs font-bold text-primary">ASSET 0{index + 1}</span><h3 className="mt-2 font-semibold">{domain.name}</h3><p className="mt-2 text-xs leading-5 text-foreground-secondary">{domain.summary}</p></article>)}
        </div>
      </ReportSection>

      <ReportSection title="생활습관 실천 점수">
        <div className="flex flex-wrap items-end gap-3">
          <strong className="text-4xl tracking-tight text-foreground">{report.lifestyleScore}</strong>
          <span className="pb-1 text-foreground-tertiary">/ 50</span>
          <span className="rounded-full bg-primary-subtle px-3 py-1 text-sm font-bold text-accent-foreground">{report.lifestyleGrade}</span>
          {report.lifestyleAdherence !== undefined && <span className="pb-1 text-sm text-foreground-secondary">권고 실천율 {report.lifestyleAdherence}%</span>}
        </div>
      </ReportSection>

      <ReportSection title="4주 건강관리 미리보기">
        <div className="grid gap-3 md:grid-cols-4">
          {report.roadmap.map((step) => <article className="rounded-xl border border-border p-4" key={step.week}><span className="text-xs font-bold text-primary">WEEK {step.week}</span><h3 className="mt-2 text-sm font-semibold">{step.title}</h3><p className="mt-2 text-xs leading-5 text-foreground-secondary">{step.goal}</p></article>)}
        </div>
      </ReportSection>

      <div className="flex flex-wrap gap-2">
        <Link href="/health-check/new" className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium"><RotateCcw className="h-4 w-4" /> 다시 검사하기</Link>
        <Link href="/health-check" className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium">건강체크 홈</Link>
      </div>
      <MedicalDisclaimer />
    </div>
  );
}

function FullReport({ report }: { report: HealthReport }) {
  const cause = report.rootCauses[0];
  const flowLabels = cause?.flowLabels ?? ["생활습관 및 스트레스", cause?.name ?? "연관 패턴", `${report.topPriorities[0]?.name} 신호`];
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6 print:max-w-none print:p-0">
      <section className="rounded-3xl bg-emerald-950 p-8 text-white print:rounded-none md:p-12">
        <p className="text-xs font-bold tracking-[0.2em] text-emerald-200">GENIEA HEALTH REPORT</p>
        <h1 className="mt-10 text-3xl font-bold tracking-tight md:text-5xl">{report.profile.name}님의<br />건강자산 리포트</h1>
        <p className="mt-4 text-sm text-emerald-100">{new Date(report.createdAt).toLocaleDateString("ko-KR")} · 12대 건강영역 통합 분석</p>
        <p className="mt-8"><strong className="text-5xl">{report.healthScore}</strong> / 100 · {report.healthGrade}</p>
      </section>
      {report.safetyWarning && <SafetyAlert />}
      <ReportSection number="01" title="건강 종합평가">
        <p>{report.overallAssessment}</p>
        <p>이 점수는 의료 위험도나 질병 확률이 아니라 서비스 내부의 건강관리 지표입니다.</p>
        {report.algorithmVersion && (
          <div className="mt-5 rounded-xl border border-border bg-muted/50 p-4">
            <p className="font-semibold">산출 알고리즘 · {report.algorithmVersion}</p>
            <ul className="mt-2">{report.assessmentBasis?.map((basis) => <li key={basis}>{basis}</li>)}</ul>
          </div>
        )}
      </ReportSection>
      <ReportSection number="02" title="건강 상태 요약">
        <div className="space-y-3">{report.domains.map((domain) => <div className="grid grid-cols-[92px_1fr_72px] items-center gap-3 text-sm" key={domain.code}><b>{domain.name}</b><div className="h-2.5 overflow-hidden rounded-full bg-muted"><i className={`block h-full rounded-full ${riskBar(domain.level)}`} style={{ width: `${domain.normalizedRisk}%` }} /></div><RiskBadge level={domain.level} /></div>)}</div>
      </ReportSection>
      <ReportSection number="03" title="주목해야 할 영역">
        <ol className="space-y-3">{report.topPriorities.map((domain, index) => <li className="rounded-xl bg-muted/60 p-4" key={domain.code}><b>{index + 1}. {domain.name}{domain.priorityScore !== undefined ? ` · 우선도 ${domain.priorityScore}/100` : ""}</b><p>{domain.summary}</p>{domain.priorityReasons?.map((reason) => <p className="text-xs text-foreground-secondary" key={reason}>• {reason}</p>)}</li>)}</ol>
      </ReportSection>
      <ReportSection number="04" title="내 몸에서 함께 보이는 기능적 패턴">
        <p>{report.causeAnalysis}</p>
        <div className="mt-4 grid gap-2 text-center text-xs font-semibold md:grid-cols-[1fr_auto_1.4fr_auto_1fr] md:items-center">
          <span className="rounded-lg bg-primary-subtle p-3">{flowLabels[0]}</span>
          <i className="not-italic text-primary">→</i>
          <span className="rounded-lg bg-primary-subtle p-3">{flowLabels[1]}</span>
          <i className="not-italic text-primary">→</i>
          <span className="rounded-lg bg-primary-subtle p-3">{flowLabels[2]}</span>
        </div>
      </ReportSection>
      <ReportSection number="05" title="맞춤 건강관리 프로그램"><p className="mb-4"><strong className="text-foreground">생활습관 점수:</strong> {report.lifestyleScore}/50 · {report.lifestyleGrade}{report.lifestyleAdherence !== undefined ? ` · 권고 실천율 ${report.lifestyleAdherence}%` : ""}</p><ul><li>식사: 규칙적인 식사 간격과 단백질·채소를 포함한 균형 식사를 우선합니다.</li><li>운동: 현재 체력에 맞춰 식후 걷기와 가벼운 근력운동부터 시작합니다.</li><li>수면: 취침 시간보다 기상 시간을 먼저 일정하게 유지합니다.</li><li>영양관리: 식품을 우선하며 보충제는 복용약과 건강상태를 의료진 또는 약사와 확인합니다.</li></ul></ReportSection>
      <ReportSection number="06" title="4주 건강관리 로드맵"><div className="grid gap-3 md:grid-cols-2">{report.roadmap.map((step) => <article className="rounded-xl border border-border p-4" key={step.week}><b>WEEK {step.week} · {step.title}</b><p>{step.goal}</p><ul>{step.actions.map((action) => <li key={action}>{action}</li>)}</ul><p><strong>기대 방향:</strong> {step.expected}</p></article>)}</div></ReportSection>
      <ReportSection number="07" title="건강 코치의 제안"><p>{report.coachMessage}</p><p>혼자 실천하기 어렵다면 기록을 함께 검토할 수 있는 건강 전문가와 상담해 보세요.</p></ReportSection>
      <MedicalDisclaimer />
      <div className="flex gap-2 print:hidden"><Button onClick={() => window.print()}><Download className="h-4 w-4" /> PDF로 저장 / 인쇄</Button><Link href={`/health-check/result/${report.assessmentId}`} className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium">결과 요약 보기</Link></div>
    </div>
  );
}

function ReportSection({ number, title, children }: { number?: string; title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border bg-surface p-5 text-sm leading-7 text-foreground-secondary print:break-inside-avoid md:p-7">{number && <p className="text-xs font-bold tracking-[0.15em] text-primary">{number}</p>}<h2 className="mb-4 mt-1 text-xl font-bold text-foreground">{title}</h2>{children}</section>;
}

function RiskBadge({ level }: { level: HealthReport["domains"][number]["level"] }) {
  const styles = { good: "bg-emerald-100 text-emerald-700", attention: "bg-yellow-100 text-yellow-700", warning: "bg-orange-100 text-orange-700", risk: "bg-red-100 text-red-700" };
  return <span className={`rounded-full px-2 py-1 text-center text-[10px] font-bold ${styles[level]}`}>{getRiskLabel(level)}</span>;
}

function riskBar(level: HealthReport["domains"][number]["level"]) {
  return { good: "bg-emerald-500", attention: "bg-yellow-400", warning: "bg-orange-500", risk: "bg-red-500" }[level];
}

function SafetyAlert() {
  return <div className="rounded-xl border-l-4 border-red-500 bg-red-50 p-4 text-sm leading-6 text-red-800"><strong>의료진 확인 우선 안내</strong><br />입력하신 정보 중 의료진의 확인이 우선될 수 있는 항목이 있습니다. 생활습관 프로그램을 시작하기 전에 담당 의료진과 상담해 주세요.</div>;
}

function StateMessage({ title }: { title: string }) {
  return <div className="grid min-h-[50vh] place-items-center px-4"><div className="text-center"><p className="font-semibold">{title}</p><Link className="mt-4 inline-flex text-sm text-primary" href="/health-check">건강체크 홈으로</Link></div></div>;
}
