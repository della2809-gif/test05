"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGipletColors } from "@/lib/constants";
import { GipletIconPicker } from "@/components/admin/giplet-icon-picker";
import type { AdminCase, AdminGiplet, GuideStep } from "@/types/database";

interface CaseForm {
  name: string;
  description: string;
  guide_steps: GuideStep[];
  icon: string | null;
  sort_order: number;
  is_active: boolean;
}

const BLANK_FORM: CaseForm = {
  name: "",
  description: "",
  guide_steps: [],
  icon: null,
  sort_order: 0,
  is_active: true,
};

function normalizeGuideSteps(steps: (GuideStep | string)[] | null | undefined): GuideStep[] {
  return (steps ?? [])
    .map((step) => (typeof step === "string" ? { title: step } : step))
    .map((step) => ({
      title: step.title ?? "",
      description: step.description ?? "",
      collection_items_text: step.collection_items_text ?? "",
      linked_giplets: step.linked_giplets ?? [],
    }));
}

function caseToForm(c: AdminCase): CaseForm {
  return {
    name: c.name,
    description: c.description ?? "",
    guide_steps: normalizeGuideSteps(c.guide_steps),
    icon: c.icon ?? null,
    sort_order: c.sort_order ?? 0,
    is_active: c.is_active,
  };
}

// ── 왼쪽 케이스 목록 패널 ──────────────────────────────────────
function CaseListPanel({
  cases, loading, selectedId, onSelect, onNew,
}: {
  cases: AdminCase[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (c: AdminCase) => void;
  onNew: () => void;
}) {
  return (
    <div className="w-64 flex-shrink-0 border-r border-border flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">케이스</h2>
        <Button size="sm" variant="outline" onClick={onNew} className="h-7 px-2 text-xs gap-1">
          <Plus className="h-3.5 w-3.5" />
          새 케이스
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : cases.length === 0 ? (
          <p className="text-xs text-foreground-secondary text-center py-8">케이스가 없습니다</p>
        ) : (
          cases.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className={cn(
                "w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all",
                selectedId === c.id
                  ? "bg-primary/10 text-foreground font-medium"
                  : "hover:bg-muted text-foreground-secondary hover:text-foreground"
              )}
            >
              <span className="text-sm flex-1 truncate">{c.name}</span>
              {!c.is_active && (
                <span className="text-[10px] text-foreground-tertiary bg-muted px-1 rounded">off</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── 오른쪽 설정 패널 ──────────────────────────────────────────
function CaseSettingsPanel({
  form, selected, isNew, dirty, saving, giplets, newCaseKey, onNewCaseKeyChange, onFormChange, onSave, onDelete,
}: {
  form: CaseForm;
  selected: AdminCase | null;
  isNew: boolean;
  dirty: boolean;
  saving: boolean;
  giplets: AdminGiplet[];
  newCaseKey: string;
  onNewCaseKeyChange: (value: string) => void;
  onFormChange: (patch: Partial<CaseForm>) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  if (!selected && !isNew) {
    return (
      <div className="flex-1 flex items-center justify-center text-foreground-secondary text-sm">
        왼쪽에서 케이스를 선택하거나 새로 만드세요
      </div>
    );
  }

  function addGuideStep() {
    onFormChange({
      guide_steps: [
        ...form.guide_steps,
        { title: "", description: "", collection_items_text: "", linked_giplets: [] },
      ],
    });
  }

  function updateGuideStep(idx: number, patch: Partial<GuideStep>) {
    onFormChange({
      guide_steps: form.guide_steps.map((step, i) => (i === idx ? { ...step, ...patch } : step)),
    });
  }

  function removeGuideStep(idx: number) {
    onFormChange({ guide_steps: form.guide_steps.filter((_, i) => i !== idx) });
  }

  function toggleStepGiplet(idx: number, key: string) {
    const step = form.guide_steps[idx];
    const selected = step.linked_giplets ?? [];
    const linked_giplets = selected.includes(key)
      ? selected.filter((k) => k !== key)
      : [...selected, key];
    updateGuideStep(idx, { linked_giplets });
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {isNew ? "새 케이스" : selected?.name}
          </h2>
          {dirty && <span className="text-xs text-amber-500 font-medium">• 미저장</span>}
        </div>
        <div className="flex items-center gap-2">
          {!isNew && selected && (
            <Button size="sm" variant="outline" onClick={onDelete}
              className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button size="sm" onClick={onSave} loading={saving} disabled={!dirty} className="h-7 px-3 text-xs">
            저장
          </Button>
        </div>
      </div>

      {/* 폼 */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">

        {/* 기본 정보 */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-tertiary mb-3">기본 정보</h3>
          <div className="space-y-3">
            {isNew && (
              <div>
                <label className="text-xs font-medium text-foreground-secondary block mb-1">
                  케이스 키 * <span className="text-foreground-tertiary font-normal">(영문·숫자·_ 만 사용)</span>
                </label>
                <Input
                  value={newCaseKey}
                  onChange={(e) => {
                    const v = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                    onNewCaseKeyChange(v);
                    onFormChange({ name: form.name }); // dirty 트리거
                  }}
                  placeholder="예: meeting_prep"
                  className="font-mono text-sm"
                />
              </div>
            )}
            {!isNew && selected && (
              <div>
                <label className="text-xs font-medium text-foreground-secondary block mb-1">케이스 키</label>
                <div className="text-sm font-mono text-foreground-secondary bg-muted px-3 py-2 rounded-lg">{selected.case_key}</div>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-foreground-secondary block mb-1">케이스 이름 *</label>
              <Input
                value={form.name}
                onChange={(e) => onFormChange({ name: e.target.value })}
                placeholder="예: 미팅 사전 준비"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground-secondary block mb-1">설명</label>
              <Input
                value={form.description}
                onChange={(e) => onFormChange({ description: e.target.value })}
                placeholder="이 케이스가 다루는 상황을 간략히 설명하세요"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground-secondary block mb-1.5">
                아이콘 <span className="text-foreground-tertiary font-normal">(메인 카드에 표시)</span>
              </label>
              <GipletIconPicker
                value={form.icon}
                onChange={(icon) => onFormChange({ icon })}
              />
              <p className="text-[11px] text-foreground-tertiary mt-1.5">
                자동(지팡이 아이콘)을 고르면 케이스 이름으로 아이콘을 자동 매칭합니다.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground-secondary block mb-1">노출 순서</label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => onFormChange({ sort_order: Number(e.target.value) || 0 })}
                placeholder="0"
                className="text-sm"
              />
              <p className="text-[11px] text-foreground-tertiary mt-1">숫자가 작을수록 사용자 화면에서 먼저 표시됩니다.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-foreground-secondary">활성화</span>
              <button
                onClick={() => onFormChange({ is_active: !form.is_active })}
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                  form.is_active ? "bg-primary" : "bg-muted-foreground/30"
                )}
              >
                <span className={cn(
                  "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                  form.is_active ? "translate-x-4.5" : "translate-x-0.5"
                )} />
              </button>
            </div>
          </div>
        </section>

        <div className="border-t border-border" />

        {/* 업무 가이드 */}
        <section>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-tertiary mb-1">업무 가이드</h3>
              <p className="text-xs text-foreground-secondary">
                사용자에게 보여줄 단계별 목차입니다. 각 단계마다 설명, 수집 항목, 연결 지플릿을 따로 설정할 수 있습니다.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={addGuideStep} className="h-8 px-3 text-xs gap-1 flex-shrink-0">
              <Plus className="h-3.5 w-3.5" />
              단계 추가
            </Button>
          </div>

          {form.guide_steps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-xs text-foreground-tertiary">
              아직 업무 단계가 없습니다. “단계 추가”를 눌러 예: 건강 상태 확인, 자동 견적 생성, 회원 등록 같은 흐름을 추가하세요.
            </div>
          ) : (
            <div className="space-y-3">
              {form.guide_steps.map((step, idx) => (
                <div key={idx} className="rounded-xl border border-border bg-surface p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary flex-shrink-0">
                      {idx + 1}
                    </span>
                    <Input
                      value={step.title ?? ""}
                      onChange={(e) => updateGuideStep(idx, { title: e.target.value })}
                      placeholder="단계명 예: 자동 견적 생성"
                      className="text-sm flex-1"
                    />
                    <button
                      onClick={() => removeGuideStep(idx)}
                      className="text-foreground-tertiary hover:text-red-500 transition-colors p-1"
                      aria-label="단계 삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground-secondary block mb-1">단계 설명</label>
                    <Textarea
                      value={step.description ?? ""}
                      onChange={(e) => updateGuideStep(idx, { description: e.target.value })}
                      placeholder="이 단계에서 사용자가 무엇을 해야 하는지 짧게 설명하세요."
                      rows={2}
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground-secondary block mb-1">이 단계에서 수집할 항목</label>
                    <Textarea
                      value={step.collection_items_text ?? ""}
                      onChange={(e) => updateGuideStep(idx, { collection_items_text: e.target.value })}
                      placeholder={`예:\n예산\n섭취 대상\n현재 복용 제품\n선호 제품군`}
                      rows={4}
                      className="text-sm"
                    />
                    <p className="text-[11px] text-foreground-tertiary mt-1">한 줄에 하나씩 입력하면 AI가 해당 단계 진입 시 참고합니다.</p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground-secondary block mb-2">이 단계에서 사용할 지플릿</label>
                    {giplets.length === 0 ? (
                      <p className="text-xs text-foreground-tertiary">사용 가능한 지플릿이 없습니다.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {giplets.map((g) => {
                          const colors = getGipletColors(g.color_scheme);
                          const selected = (step.linked_giplets ?? []).includes(g.giplet_key);
                          return (
                            <button
                              key={g.giplet_key}
                              onClick={() => toggleStepGiplet(idx, g.giplet_key)}
                              className={cn(
                                "flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all",
                                selected
                                  ? `${colors.bg} ${colors.border} border`
                                  : "bg-muted/30 border-border hover:border-border-hover"
                              )}
                            >
                              <span className={cn("h-2 w-2 rounded-full flex-shrink-0 border", colors.bg, colors.border)} />
                              <span className={cn("text-xs font-medium truncate", selected ? colors.color : "text-foreground-secondary")}>{g.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────────
export default function AdminCasesPage() {
  const [cases, setCases] = useState<AdminCase[]>([]);
  const [giplets, setGiplets] = useState<AdminGiplet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<CaseForm>(BLANK_FORM);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminCase | null>(null);

  const selected = cases.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: casesData }, { data: gipletsData }] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("admin_cases") as any).select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("admin_giplets") as any)
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);
      setCases((casesData as AdminCase[]) ?? []);
      setGiplets((gipletsData as AdminGiplet[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  function handleSelect(c: AdminCase) {
    setSelectedId(c.id);
    setIsNew(false);
    setForm(caseToForm(c));
    setDirty(false);
    setNewCaseKeyState("");
  }

  function handleNew() {
    setSelectedId(null);
    setIsNew(true);
    setForm(BLANK_FORM);
    setDirty(true);
    setNewCaseKeyState("");
  }

  const handleFormChange = useCallback((patch: Partial<CaseForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }, []);

  // newCaseKey는 폼 외부에서 관리 (Input ref 방식 대신 state)
  const [newCaseKey, setNewCaseKeyState] = useState("");

  async function handleSave() {
    if (!form.name.trim()) { toast.error("케이스 이름을 입력하세요."); return; }
    if (isNew && !newCaseKey.trim()) { toast.error("케이스 키를 입력하세요."); return; }

    setSaving(true);
    const supabase = createClient();

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      guide_steps: form.guide_steps
        .map((step) => ({
          title: step.title.trim(),
          description: step.description?.trim() || "",
          collection_items_text: step.collection_items_text?.trim() || "",
          linked_giplets: step.linked_giplets ?? [],
        }))
        .filter((step) => step.title),
      icon: form.icon || null,
      sort_order: form.sort_order,
      is_active: form.is_active,
    };

    if (isNew) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("admin_cases") as any)
        .insert({ case_key: newCaseKey.trim(), ...payload })
        .select()
        .single();
      if (error) {
        toast.error(error.message.includes("unique") ? "이미 존재하는 케이스 키입니다." : "저장 실패");
      } else {
        const created = data as AdminCase;
        setCases((prev) => [...prev, created].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
        setSelectedId(created.id);
        setIsNew(false);
        setForm(caseToForm(created));
        setDirty(false);
        toast.success("케이스가 생성되었습니다.");
      }
    } else if (selected) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("admin_cases") as any)
        .update(payload)
        .eq("id", selected.id)
        .select()
        .single();
      if (error) {
        toast.error("저장 실패");
      } else {
        const updated = data as AdminCase;
        setCases((prev) => prev.map((c) => c.id === updated.id ? updated : c).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
        setForm(caseToForm(updated));
        setDirty(false);
        toast.success("저장됨");
      }
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("admin_cases") as any).delete().eq("id", deleteTarget.id);
    if (error) { toast.error("삭제 실패"); return; }
    setCases((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    if (selectedId === deleteTarget.id) {
      setSelectedId(null);
      setIsNew(false);
      setForm(BLANK_FORM);
      setDirty(false);
    }
    toast.success("삭제됨");
    setDeleteTarget(null);
  }

  return (
    <div className="flex flex-col -mx-4 -my-6 md:-mx-8 md:-my-8 h-[calc(100dvh-48px)] md:h-[calc(100dvh-56px)]">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-border flex-shrink-0">
        <h1 className="text-xl font-bold text-foreground">케이스 관리</h1>
        <p className="text-xs text-foreground-secondary mt-0.5">
          업무 가이드 단계별 수집 항목과 연결 지플릿을 설정합니다. 사용자가 케이스를 시작하면 단계별 목차를 기준으로 필요한 정보를 확인합니다.
        </p>
      </div>

      {/* 2-패널 */}
      <div className="flex flex-1 min-h-0">
        <CaseListPanel
          cases={cases}
          loading={loading}
          selectedId={selectedId}
          onSelect={handleSelect}
          onNew={handleNew}
        />
        <CaseSettingsPanel
          form={form}
          selected={selected}
          isNew={isNew}
          dirty={dirty}
          saving={saving}
          giplets={giplets}
          newCaseKey={newCaseKey}
          onNewCaseKeyChange={setNewCaseKeyState}
          onFormChange={handleFormChange}
          onSave={handleSave}
          onDelete={() => selected && setDeleteTarget(selected)}
        />
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="케이스 삭제"
        description={`"${deleteTarget?.name}" 케이스를 삭제합니다. 이 케이스를 사용 중인 지플릿 연결도 해제됩니다.`}
        confirmText="삭제"
        confirmVariant="destructive"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
