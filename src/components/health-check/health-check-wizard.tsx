"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowLeft, ArrowRight, CheckCircle2, Clock3, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ANSWER_OPTIONS, HEALTH_DOMAINS } from "@/features/health-check/data";
import type { AssessmentPayload, Gender, LifestyleProfile, ProfileSummary } from "@/features/health-check/types";
import { MedicalDisclaimer } from "./medical-disclaimer";

type Stage = "intro" | "profile" | "lifestyle" | "questions";
const DRAFT_KEY = "geniea-consumer-health-draft-v3";
const DOMAIN_COUNT = HEALTH_DOMAINS.length;
const QUESTION_COUNT = HEALTH_DOMAINS.reduce((sum, domain) => sum + domain.questions.length, 0);

const initialProfile: ProfileSummary = {
  name: "", gender: "female", age: 40, heightCm: 165, weightKg: 60,
  occupation: "", healthGoal: "", diagnoses: "", medications: "", surgeries: "",
  familyHistory: "", recentCheckup: "", notes: "",
};
const lifestyleItems: [keyof LifestyleProfile, string][] = [
  ["regularMeals", "식사를 규칙적으로 합니다."],
  ["vegetables", "하루 2끼 이상 채소를 섭취합니다."],
  ["fruit", "과일을 하루 1회 이상 섭취합니다."],
  ["protein", "매끼 고기·생선·계란·콩류 등 단백질 식품을 섭취합니다."],
  ["hydration", "하루 약 2L의 물을 마십니다."],
  ["caffeine", "커피와 카페인 음료는 하루 1잔 이하로 마십니다."],
  ["exercise", "일주일에 3회 이상, 30분 이상 운동합니다."],
  ["sleep", "하루 7시간 이상 충분히 수면합니다."],
  ["sunlight", "하루 20분 이상 햇빛을 쬡니다."],
  ["monitoring", "체중과 건강 상태를 정기적으로 확인합니다."],
];

const lifestyleOptions = [
  { score: 5, label: "예" },
  { score: 1, label: "아니오" },
];

export function HealthCheckWizard() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("intro");
  const [consented, setConsented] = useState(false);
  const [profile, setProfile] = useState<ProfileSummary>(initialProfile);
  const [lifestyle, setLifestyle] = useState<Partial<LifestyleProfile>>({});
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [domainIndex, setDomainIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
      if (!draft) return;
      setProfile((current) => ({ ...current, ...draft.profile }));
      setLifestyle((current) => ({ ...current, ...draft.lifestyle }));
      setAnswers(draft.answers ?? {});
      setDomainIndex(draft.domainIndex ?? 0);
    } catch {
      sessionStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    if (stage === "intro") return;
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ profile, lifestyle, answers, domainIndex }));
  }, [stage, profile, lifestyle, answers, domainIndex]);

  const currentDomain = HEALTH_DOMAINS[domainIndex];
  const answeredCount = Object.keys(answers).length;
  const currentComplete = currentDomain.questions.every((question) => answers[question.code] !== undefined);
  const profileValid = useMemo(
    () => profile.name.trim().length > 0 && profile.age > 0 && profile.heightCm > 0 && profile.weightKg > 0,
    [profile],
  );
  const lifestyleComplete = lifestyleItems.every(([key]) => lifestyle[key] !== undefined);

  function go(next: Stage) {
    setStage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    setSaving(true);
    setError("");
    if (!lifestyleComplete) return;
    const payload: AssessmentPayload = { profile, lifestyle: lifestyle as LifestyleProfile, answers };
    try {
      const response = await fetch("/api/health-assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "결과를 저장하지 못했습니다.");
      sessionStorage.removeItem(DRAFT_KEY);
      router.push(`/health-check/result/${result.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "잠시 후 다시 시도해 주세요.");
      setSaving(false);
    }
  }

  if (stage === "intro") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <section className="overflow-hidden rounded-3xl border border-border bg-surface">
          <div className="bg-gradient-to-br from-emerald-950 via-emerald-800 to-emerald-600 px-6 py-12 text-white md:px-12">
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15"><Sparkles className="h-7 w-7" /></div>
            <p className="text-xs font-semibold tracking-[0.2em] text-emerald-100">GENIEA FUNCTIONAL HEALTH COACH</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">내 몸의 신호를 읽고<br />건강자산을 키우세요.</h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-emerald-50 md:text-base">12대 건강영역을 단계별로 점검하고, 현재의 건강상태 확인과 건강관리 방향을 설정합니다.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs text-emerald-50">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2"><Clock3 className="h-3.5 w-3.5" /> 약 8~10분</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2"><Activity className="h-3.5 w-3.5" /> {DOMAIN_COUNT}영역 · {QUESTION_COUNT}문항</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2"><Save className="h-3.5 w-3.5" /> 자동 임시저장</span>
            </div>
          </div>
          <div className="space-y-5 p-6 md:p-10">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 text-sm leading-6">
              <input className="mt-1 accent-emerald-600" type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} />
              <span>개인정보가 맞춤 건강관리 진단에 저장에 활용되는 것에 동의합니다.</span>
            </label>
            <Button size="lg" className="w-full" disabled={!consented} onClick={() => go("profile")}>건강체크 시작하기 <ArrowRight className="h-4 w-4" /></Button>
            <MedicalDisclaimer />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-10">
      <Progress stage={stage} answeredCount={answeredCount} />

      {stage === "profile" && (
        <section className="rounded-2xl border border-border bg-surface p-5 md:p-8">
          <SectionHeader eyebrow="STEP 1 · 기본정보" title="기본정보를 알려주세요." description="필수 항목은 결과 계산에만 사용하며, 건강 이력은 선택 입력입니다." />
          <div className="mt-7 grid gap-5 md:grid-cols-2">
            <Field label="이름 또는 닉네임"><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
            <Field label="성별">
              <select className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm" value={profile.gender} onChange={(e) => setProfile({ ...profile, gender: e.target.value as Gender })}>
                <option value="female">여성</option><option value="male">남성</option><option value="other">기타 / 응답하지 않음</option>
              </select>
            </Field>
            <Field label="나이"><Input type="number" min={14} max={100} value={profile.age} onChange={(e) => setProfile({ ...profile, age: Number(e.target.value) })} /></Field>
            <Field label="키 (cm)"><Input type="number" value={profile.heightCm} onChange={(e) => setProfile({ ...profile, heightCm: Number(e.target.value) })} /></Field>
            <Field label="체중 (kg)"><Input type="number" value={profile.weightKg} onChange={(e) => setProfile({ ...profile, weightKg: Number(e.target.value) })} /></Field>
            <Field label="허리둘레 (cm)" optional><Input type="number" value={profile.waistCm ?? ""} onChange={(e) => setProfile({ ...profile, waistCm: e.target.value ? Number(e.target.value) : undefined })} /></Field>
            <Field label="건강 목표" optional><Input value={profile.healthGoal ?? ""} onChange={(e) => setProfile({ ...profile, healthGoal: e.target.value })} placeholder="예: 오후 피로 줄이기" /></Field>
            <Field label="진단받은 질환" optional><Input value={profile.diagnoses ?? ""} onChange={(e) => setProfile({ ...profile, diagnoses: e.target.value })} /></Field>
            <Field label="복용약" optional><Input value={profile.medications ?? ""} onChange={(e) => setProfile({ ...profile, medications: e.target.value })} /></Field>
            <Field label="수술 이력" optional><Input value={profile.surgeries ?? ""} onChange={(e) => setProfile({ ...profile, surgeries: e.target.value })} /></Field>
            <Field label="가족력" optional><Input value={profile.familyHistory ?? ""} onChange={(e) => setProfile({ ...profile, familyHistory: e.target.value })} /></Field>
            <Field label="최근 건강검진" optional><Input value={profile.recentCheckup ?? ""} onChange={(e) => setProfile({ ...profile, recentCheckup: e.target.value })} /></Field>
            <Field label="특이사항" optional><Input value={profile.notes ?? ""} onChange={(e) => setProfile({ ...profile, notes: e.target.value })} placeholder="의료진 확인이 필요한 내용 포함" /></Field>
          </div>
          <Actions onBack={() => go("intro")} onNext={() => go("lifestyle")} nextDisabled={!profileValid} />
        </section>
      )}

      {stage === "lifestyle" && (
        <section className="rounded-2xl border border-border bg-surface p-5 md:p-8">
          <SectionHeader eyebrow="STEP 2 · 생활습관" title="평소 생활습관은 어떤가요?" description="최근 한 달을 기준으로 각 문항에 예 또는 아니오로 답해 주세요." />
          <div className="mt-4 space-y-3">
            {lifestyleItems.map(([key, label], index) => (
              <fieldset className="rounded-xl border border-border p-4" key={key}>
                <legend className="px-1 text-sm font-semibold">{index + 1}. {label}</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {lifestyleOptions.map(({ score, label: optionLabel }) => {
                    const selected = lifestyle[key] === score;
                    return (
                      <button
                        type="button"
                        key={score}
                        aria-pressed={selected}
                        onClick={() => setLifestyle({ ...lifestyle, [key]: score })}
                        className={`flex min-h-16 items-center justify-center rounded-xl border px-4 text-sm transition-colors ${selected ? "border-primary bg-primary-subtle font-bold text-accent-foreground ring-2 ring-primary/20" : "border-border bg-background text-foreground-secondary hover:border-primary/50 hover:bg-surface-hover"}`}
                      >
                        <span>{optionLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
          {lifestyleComplete && (
            <div className="mt-5 rounded-xl border border-primary/20 bg-primary-subtle p-4 text-sm">
              <span className="text-foreground-secondary">생활습관 점수</span>
              <strong className="ml-2 text-lg text-accent-foreground">{Object.values(lifestyle).reduce((sum, score) => sum + (score ?? 0), 0)} / 50</strong>
            </div>
          )}
          <Actions onBack={() => go("profile")} onNext={() => go("questions")} nextDisabled={!lifestyleComplete} />
        </section>
      )}

      {stage === "questions" && (
        <section className="rounded-2xl border border-border bg-surface p-5 md:p-8">
          <SectionHeader eyebrow={`${domainIndex + 1} / ${DOMAIN_COUNT} · ${answeredCount}문항 응답`} title={currentDomain.name} />
          <div className="mt-7 space-y-4">
            {currentDomain.questions.map((question, index) => (
              <article className="rounded-xl border border-border p-4 md:p-5" key={question.code}>
                <p className="font-medium leading-6">{index + 1}. {question.genderText?.[profile.gender] ?? question.text}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                  {ANSWER_OPTIONS.map((option) => (
                    <label className={`cursor-pointer rounded-lg border px-2 py-3 text-center text-xs transition-colors ${answers[question.code] === option.value ? "border-primary bg-primary-subtle font-semibold text-accent-foreground" : "border-border text-foreground-secondary hover:bg-surface-hover"}`} key={option.value}>
                      <input className="sr-only" type="radio" name={question.code} checked={answers[question.code] === option.value} onChange={() => setAnswers({ ...answers, [question.code]: option.value })} />
                      {option.label}
                    </label>
                  ))}
                </div>
              </article>
            ))}
          </div>
          {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
          <div className="mt-7 flex justify-between gap-3">
            <Button variant="outline" onClick={() => domainIndex === 0 ? go("lifestyle") : setDomainIndex(domainIndex - 1)}><ArrowLeft className="h-4 w-4" /> 이전</Button>
            {domainIndex < DOMAIN_COUNT - 1 ? (
              <Button disabled={!currentComplete} onClick={() => { setDomainIndex(domainIndex + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>다음 영역 <ArrowRight className="h-4 w-4" /></Button>
            ) : (
              <Button loading={saving} disabled={!currentComplete} onClick={submit}><CheckCircle2 className="h-4 w-4" /> 결과 확인하기</Button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Progress({ stage, answeredCount }: { stage: Stage; answeredCount: number }) {
  const percent = stage === "profile" ? 10 : stage === "lifestyle" ? 20 : 20 + Math.round((answeredCount / QUESTION_COUNT) * 80);
  return <div className="mb-5"><div className="mb-2 flex justify-between text-xs font-medium text-foreground-secondary"><span>건강자산 체크 진행률</span><span>{Math.min(100, percent)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><i className="block h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, percent)}%` }} /></div></div>;
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <header><p className="text-xs font-bold tracking-[0.15em] text-primary">{eyebrow}</p><h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>{description && <p className="mt-2 text-sm leading-6 text-foreground-secondary">{description}</p>}</header>;
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return <label className="space-y-2"><span className="text-sm font-medium">{label} {optional && <em className="not-italic text-xs font-normal text-foreground-tertiary">선택</em>}</span>{children}</label>;
}

function Actions({ onBack, onNext, nextDisabled }: { onBack: () => void; onNext: () => void; nextDisabled?: boolean }) {
  return <div className="mt-8 flex justify-between gap-3"><Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" /> 이전</Button><Button disabled={nextDisabled} onClick={onNext}>다음 <ArrowRight className="h-4 w-4" /></Button></div>;
}
