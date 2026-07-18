"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Plus, Lock, Trash2, Send, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { GIPLET_COLOR_PRESETS, getGipletColors } from "@/lib/constants";
import { GipletIconPicker } from "@/components/admin/giplet-icon-picker";
import type { AdminGiplet, AdminCase } from "@/types/database";

const DB_SOURCE_OPTIONS = [
  { value: "templates", label: "미팅 시나리오" },
  { value: "blocks", label: "스크립트 DB" },
  { value: "calculations", label: "수당·여행 계산값" },
  { value: "products", label: "제품 DB" },
  { value: "packages", label: "패키지 DB" },
  { value: "stories", label: "스토리 DB" },
  { value: "links", label: "링크 DB" },
  { value: "images", label: "이미지 DB" },
  { value: "youtube", label: "유튜브 강의" },
  { value: "rag:faqs", label: "FAQ (RAG)" },
  { value: "rag:admin_files", label: "레퍼런스 파일" },
];

const COLOR_OPTIONS = Object.keys(GIPLET_COLOR_PRESETS) as (keyof typeof GIPLET_COLOR_PRESETS)[];

interface GipletForm {
  giplet_key: string;
  name: string;
  description: string;
  tag: string;
  color_scheme: string;
  icon: string | null;
  initial_prompt: string;
  db_sources: string[];
  system_prompt: string;
  case_key: string | null;
  sort_order: number;
  is_active: boolean;
}

const BLANK_FORM: GipletForm = {
  giplet_key: "",
  name: "",
  description: "",
  tag: "",
  color_scheme: "gray",
  icon: null,
  initial_prompt: "",
  db_sources: [],
  system_prompt: "",
  case_key: null,
  sort_order: 0,
  is_active: true,
};

function gipletToForm(g: AdminGiplet): GipletForm {
  return {
    giplet_key: g.giplet_key,
    name: g.name,
    description: g.description ?? "",
    tag: g.tag ?? "",
    color_scheme: g.color_scheme,
    icon: g.icon ?? null,
    initial_prompt: g.initial_prompt,
    db_sources: g.db_sources,
    system_prompt: g.system_prompt,
    case_key: g.case_key ?? null,
    sort_order: g.sort_order ?? 0,
    is_active: g.is_active,
  };
}

// ── 왼쪽 패널 ────────────────────────────────────────────────
interface GipletListPanelProps {
  giplets: AdminGiplet[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (g: AdminGiplet) => void;
  onNew: () => void;
}

function GipletListPanel({ giplets, loading, selectedId, onSelect, onNew }: GipletListPanelProps) {
  const system = giplets.filter((g) => g.is_system).sort((a, b) => a.sort_order - b.sort_order);
  const custom = giplets.filter((g) => !g.is_system).sort((a, b) => a.sort_order - b.sort_order);

  function GipletRow({ g }: { g: AdminGiplet }) {
    const colors = getGipletColors(g.color_scheme);
    const isSelected = selectedId === g.id;
    return (
      <button
        onClick={() => onSelect(g)}
        className={cn(
          "w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all",
          isSelected
            ? "bg-primary/10 text-foreground font-medium"
            : "hover:bg-muted text-foreground-secondary hover:text-foreground"
        )}
      >
        <span className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", colors.bg, colors.border, "border")} />
        <span className="text-sm flex-1 truncate">{g.name}</span>
        {g.is_system && <Lock className="h-3 w-3 text-foreground-tertiary flex-shrink-0" />}
        {!g.is_active && (
          <span className="text-[10px] text-foreground-tertiary bg-muted px-1 rounded">off</span>
        )}
      </button>
    );
  }

  return (
    <div className="w-64 flex-shrink-0 border-r border-border flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">지플릿</h2>
        <Button size="sm" variant="outline" onClick={onNew} className="h-7 px-2 text-xs gap-1">
          <Plus className="h-3.5 w-3.5" />
          새 지플릿
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <>
            {system.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-tertiary px-3 pb-1">시스템</p>
                <div className="space-y-0.5">
                  {system.map((g) => <GipletRow key={g.id} g={g} />)}
                </div>
              </div>
            )}
            {custom.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-tertiary px-3 pb-1">커스텀</p>
                <div className="space-y-0.5">
                  {custom.map((g) => <GipletRow key={g.id} g={g} />)}
                </div>
              </div>
            )}
            {giplets.length === 0 && (
              <p className="text-xs text-foreground-secondary text-center py-8">지플릿이 없습니다</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── 중간 설정 패널 ────────────────────────────────────────────
interface GipletSettingsPanelProps {
  form: GipletForm;
  selected: AdminGiplet | null;
  isNew: boolean;
  dirty: boolean;
  saving: boolean;
  cases: AdminCase[];
  onFormChange: (patch: Partial<GipletForm>) => void;
  onSave: () => void;
  onDelete: () => void;
}

function GipletSettingsPanel({
  form, selected, isNew, dirty, saving, cases, onFormChange, onSave, onDelete,
}: GipletSettingsPanelProps) {
  if (!selected && !isNew) {
    return (
      <div className="w-[460px] flex-shrink-0 border-r border-border flex items-center justify-center text-foreground-secondary text-sm">
        왼쪽에서 지플릿을 선택하거나 새로 만드세요
      </div>
    );
  }

  function toggleDbSource(val: string) {
    const next = form.db_sources.includes(val)
      ? form.db_sources.filter((s) => s !== val)
      : [...form.db_sources, val];
    onFormChange({ db_sources: next });
  }

  return (
    <div className="w-[460px] flex-shrink-0 border-r border-border flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {isNew ? "새 지플릿" : selected?.name}
          </h2>
          {dirty && <span className="text-xs text-amber-500 font-medium">• 미저장</span>}
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 지플릿 키 (신규 생성 시만 표시) */}
        {isNew && (
          <div>
            <label className="text-xs font-medium text-foreground-secondary block mb-1">
              지플릿 키 *
              <span className="ml-1 text-foreground-tertiary font-normal">(영문·숫자·_ 만 사용)</span>
            </label>
            <Input
              value={form.giplet_key}
              onChange={(e) =>
                onFormChange({ giplet_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })
              }
              placeholder="예: commission_custom"
            />
            <p className="text-[11px] text-foreground-tertiary mt-1">저장 후 변경 불가. 대화에서 이 지플릿을 식별하는 고유 ID입니다.</p>
          </div>
        )}

        {/* 이름 */}
        <div>
          <label className="text-xs font-medium text-foreground-secondary block mb-1">이름 *</label>
          <Input
            value={form.name}
            onChange={(e) => onFormChange({ name: e.target.value })}
            placeholder="예: 수당 계산"
          />
        </div>

        {/* 설명 */}
        <div>
          <label className="text-xs font-medium text-foreground-secondary block mb-1">설명</label>
          <Input
            value={form.description}
            onChange={(e) => onFormChange({ description: e.target.value })}
            placeholder="이 지플릿이 하는 일을 한 줄로 설명하세요"
          />
        </div>

        {/* 노출 순서 */}
        <div>
          <label className="text-xs font-medium text-foreground-secondary block mb-1">노출 순서</label>
          <Input
            type="number"
            value={form.sort_order}
            onChange={(e) => onFormChange({ sort_order: Number(e.target.value) || 0 })}
            placeholder="0"
          />
          <p className="text-[11px] text-foreground-tertiary mt-1">숫자가 작을수록 사용자 화면에서 먼저 표시됩니다.</p>
        </div>

        {/* 태그 */}
        <div>
          <label className="text-xs font-medium text-foreground-secondary block mb-1">태그</label>
          <Input
            value={form.tag}
            onChange={(e) => onFormChange({ tag: e.target.value })}
            placeholder="예: 📸 사진 첨부"
          />
        </div>

        {/* 색상 */}
        <div>
          <label className="text-xs font-medium text-foreground-secondary block mb-1.5">색상</label>
          <div className="flex flex-wrap gap-1.5">
            {COLOR_OPTIONS.map((key) => {
              const c = GIPLET_COLOR_PRESETS[key];
              const isSelected = form.color_scheme === key;
              return (
                <button
                  key={key}
                  onClick={() => onFormChange({ color_scheme: key })}
                  title={key}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-all",
                    c.bg.split(" ")[0],
                    isSelected ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                  )}
                />
              );
            })}
          </div>
        </div>

        {/* 아이콘 */}
        <div>
          <label className="text-xs font-medium text-foreground-secondary block mb-1.5">
            아이콘
            <span className="ml-1 text-foreground-tertiary font-normal">(메인 카드에 표시)</span>
          </label>
          <GipletIconPicker
            value={form.icon}
            onChange={(icon) => onFormChange({ icon })}
          />
          <p className="text-[11px] text-foreground-tertiary mt-1.5">
            자동(지팡이 아이콘)을 고르면 지플릿 이름으로 아이콘을 자동 매칭합니다.
          </p>
        </div>

        {/* 시작 프롬프트 */}
        <div>
          <label className="text-xs font-medium text-foreground-secondary block mb-1">
            시작 프롬프트
            <span className="ml-1 text-foreground-tertiary font-normal">(채팅 시작 시 자동 입력)</span>
          </label>
          <Textarea
            value={form.initial_prompt}
            onChange={(e) => onFormChange({ initial_prompt: e.target.value })}
            placeholder="예: 수당 계산해줘. 현재 CVP는 "
            rows={4}
            className="text-sm resize-y"
          />
        </div>

        {/* DB 소스 */}
        <div>
          <label className="text-xs font-medium text-foreground-secondary block mb-1.5">참조 DB</label>
          <div className="flex flex-wrap gap-1.5">
            {DB_SOURCE_OPTIONS.map((opt) => {
              const selected = form.db_sources.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleDbSource(opt.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                    selected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-surface border-border text-foreground-secondary hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 케이스 연결 */}
        <div>
          <label className="text-xs font-medium text-foreground-secondary block mb-1">
            케이스 연결
            <span className="ml-1 text-foreground-tertiary font-normal">(단계형 대화 흐름)</span>
          </label>
          <select
            value={form.case_key ?? ""}
            onChange={(e) => onFormChange({ case_key: e.target.value || null })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">연결 안 함 (일반 지플릿)</option>
            {cases.map((c) => (
              <option key={c.case_key} value={c.case_key}>
                {c.name} ({c.case_key})
              </option>
            ))}
          </select>
          {form.case_key && (
            <p className="text-[11px] text-primary mt-1">
              ✓ 이 지플릿 선택 시 &quot;{cases.find(c => c.case_key === form.case_key)?.name}&quot; 케이스 흐름으로 진행됩니다. 아래 시스템 프롬프트는 무시됩니다.
            </p>
          )}
        </div>

        {/* 시스템 프롬프트 */}
        <div>
          <label className="text-xs font-medium text-foreground-secondary block mb-1">
            시스템 프롬프트
            {form.case_key && (
              <span className="ml-1 text-foreground-tertiary font-normal line-through">(케이스 연결 시 미사용)</span>
            )}
          </label>
          <Textarea
            value={form.system_prompt}
            onChange={(e) => onFormChange({ system_prompt: e.target.value })}
            placeholder={`AI가 이 지플릿에서 어떻게 행동해야 할지 작성하세요.

예시:
당신은 USANA 수당 계산 전문가입니다.
사용자가 CVP를 입력하면 현재 직급을 확인하고,
3가지 성장 시나리오별 수당을 계산해 표로 제시하세요.`}
            rows={10}
            className="font-mono text-xs resize-y"
          />
        </div>

        {/* 활성화 토글 */}
        {!isNew && (
          <div className="flex items-center gap-3 py-2">
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
            <span className="text-xs text-foreground-tertiary">
              {form.is_active ? "사용자에게 표시됨" : "숨김 처리됨"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 오른쪽 프리뷰 패널 ──────────────────────────────────────
interface PreviewMessage {
  role: "user" | "assistant";
  content: string;
}

interface ContextInfo {
  db_sources_loaded: Array<{ key: string; label: string; count: number }>;
  system_prompt_chars: number;
  estimated_tokens: number;
}

interface GipletPreviewPanelProps {
  form: GipletForm;
  hasSelection: boolean;
}

function GipletPreviewPanel({ form, hasSelection }: GipletPreviewPanelProps) {
  const [messages, setMessages] = useState<PreviewMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [contextInfo, setContextInfo] = useState<ContextInfo | null>(null);
  const [showContext, setShowContext] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    // 이전 요청 취소
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const apiMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: userMsg },
      ];

      const res = await fetch("/api/admin/test-giplet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: form.system_prompt,
          db_sources: form.db_sources,
          messages: apiMessages,
          debug: true,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "응답 생성 실패");
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
      if (data.contextInfo) setContextInfo(data.contextInfo);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // 사용자가 초기화했으므로 오류 표시 안 함
      } else {
        toast.error("응답 생성 중 오류가 발생했습니다. 다시 시도해주세요.");
        setMessages((prev) => prev.slice(0, -1));
      }
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    // 진행 중인 요청 취소
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setMessages([]);
    setContextInfo(null);
    setInput("");
    setLoading(false);
  }

  if (!hasSelection) {
    return (
      <div className="flex-1 flex items-center justify-center text-foreground-secondary text-sm">
        지플릿을 선택하면 프리뷰가 표시됩니다
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <h2 className="text-sm font-semibold text-foreground">프리뷰 채팅</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-tertiary">현재 (미저장) 프롬프트 기준</span>
          <Button size="sm" variant="outline" onClick={handleReset}
            className="h-7 px-2 text-xs gap-1">
            <RefreshCw className="h-3 w-3" />
            초기화
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowContext((v) => !v)}
            className="h-7 px-2 text-xs gap-1">
            {showContext ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            컨텍스트
          </Button>
        </div>
      </div>

      {/* 컨텍스트 디버그 패널 */}
      {showContext && contextInfo && (
        <div className="border-b border-border bg-muted/50 px-4 py-2.5 flex-shrink-0 text-xs space-y-1.5">
          <div className="flex gap-4">
            <span className="text-foreground-secondary">
              시스템 프롬프트: <strong className="text-foreground">{contextInfo.system_prompt_chars.toLocaleString()}자</strong>
            </span>
            <span className="text-foreground-secondary">
              예상 토큰: <strong className="text-foreground">~{contextInfo.estimated_tokens.toLocaleString()}</strong>
            </span>
          </div>
          {contextInfo.db_sources_loaded.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {contextInfo.db_sources_loaded.map((src) => (
                <span key={src.key}
                  className="bg-background border border-border rounded px-2 py-0.5 text-foreground-secondary">
                  {src.label}
                  {src.count >= 0 && <strong className="text-foreground ml-1">{src.count}건</strong>}
                  {src.count === -1 && <strong className="text-primary ml-1">RAG</strong>}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-foreground-tertiary text-sm">
            메시지를 입력해 AI 응답을 테스트하세요
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap",
              m.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-muted text-foreground rounded-bl-sm"
            )}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 bg-foreground-tertiary rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 bg-foreground-tertiary rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 bg-foreground-tertiary rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="flex-shrink-0 border-t border-border p-3 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !loading) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="테스트 메시지 입력..."
          disabled={loading}
          className="flex-1 text-sm"
        />
        <Button onClick={handleSend} disabled={!input.trim() || loading} size="sm" className="px-3">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────
export default function AdminGipletsPage() {
  const [giplets, setGiplets] = useState<AdminGiplet[]>([]);
  const [cases, setCases] = useState<AdminCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<GipletForm>(BLANK_FORM);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminGiplet | null>(null);

  const selected = giplets.find((g) => g.id === selectedId) ?? null;

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: gipletsData }, { data: casesData }] = await Promise.all([
        (supabase.from("admin_giplets") as any)
          .select("*")
          .order("is_system", { ascending: false })
          .order("sort_order", { ascending: true }),
        (supabase.from("admin_cases") as any)
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);
      setGiplets((gipletsData as AdminGiplet[]) ?? []);
      setCases((casesData as AdminCase[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  function handleSelect(g: AdminGiplet) {
    setSelectedId(g.id);
    setIsNew(false);
    setForm(gipletToForm(g));
    setDirty(false);
  }

  function handleNew() {
    setSelectedId(null);
    setIsNew(true);
    setForm(BLANK_FORM);
    setDirty(true);
  }

  const handleFormChange = useCallback((patch: Partial<GipletForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }, []);

  async function handleSave() {
    if (!form.name.trim()) { toast.error("지플릿 이름을 입력하세요."); return; }
    if (isNew && !form.giplet_key.trim()) { toast.error("지플릿 키를 입력하세요. (영문·숫자·_)"); return; }
    setSaving(true);
    const supabase = createClient();

    if (isNew) {
      const { data, error } = await (supabase.from("admin_giplets") as any)
        .insert({
          giplet_key: form.giplet_key.trim(),
          name: form.name.trim(),
          description: form.description.trim() || null,
          tag: form.tag.trim() || null,
          color_scheme: form.color_scheme,
          icon: form.icon || null,
          initial_prompt: form.initial_prompt,
          db_sources: form.db_sources,
          system_prompt: form.system_prompt,
          case_key: form.case_key || null,
          is_system: false,
          is_active: form.is_active,
          sort_order: form.sort_order,
        })
        .select()
        .single();
      if (error) {
        toast.error(error.message.includes("unique") ? "이미 존재하는 지플릿 키입니다. 다른 키를 입력하세요." : "저장 실패");
      } else {
        const created = data as AdminGiplet;
        setGiplets((prev) => [...prev, created].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
        setSelectedId(created.id);
        setIsNew(false);
        setForm(gipletToForm(created));
        setDirty(false);
        toast.success("새 지플릿이 생성되었습니다.");
      }
    } else if (selected) {
      const updatePayload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        tag: form.tag.trim() || null,
        color_scheme: form.color_scheme,
        icon: form.icon || null,
        initial_prompt: form.initial_prompt,
        db_sources: form.db_sources,
        case_key: form.case_key || null,
        is_active: form.is_active,
        sort_order: form.sort_order,
        system_prompt: form.system_prompt,
      };

      const { data, error } = await (supabase.from("admin_giplets") as any)
        .update(updatePayload)
        .eq("id", selected.id)
        .select()
        .single();
      if (error) {
        toast.error("저장 실패");
      } else {
        const updated = data as AdminGiplet;
        setGiplets((prev) => prev.map((g) => g.id === updated.id ? updated : g).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
        setForm(gipletToForm(updated));
        setDirty(false);
        toast.success("저장됨");
      }
    }

    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const supabase = createClient();
    const { error } = await (supabase.from("admin_giplets") as any)
      .delete()
      .eq("id", deleteTarget.id);
    if (error) { toast.error("삭제 실패"); return; }
    setGiplets((prev) => prev.filter((g) => g.id !== deleteTarget.id));
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
        <h1 className="text-xl font-bold text-foreground">지플릿 관리</h1>
        <p className="text-xs text-foreground-secondary mt-0.5">
          지플릿별 시스템 프롬프트와 참조 DB를 설정하고, 우측 프리뷰에서 즉시 테스트하세요.
        </p>
      </div>

      {/* 3-패널 레이아웃 */}
      <div className="flex flex-1 min-h-0">
        <GipletListPanel
          giplets={giplets}
          loading={loading}
          selectedId={selectedId}
          onSelect={handleSelect}
          onNew={handleNew}
        />
        <GipletSettingsPanel
          form={form}
          selected={selected}
          isNew={isNew}
          dirty={dirty}
          saving={saving}
          cases={cases}
          onFormChange={handleFormChange}
          onSave={handleSave}
          onDelete={() => selected && setDeleteTarget(selected)}
        />
        <GipletPreviewPanel
          form={form}
          hasSelection={isNew || !!selected}
        />
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="지플릿 삭제"
        description={`"${deleteTarget?.name}" 지플릿을 삭제합니다. 이 지플릿을 사용 중인 대화에는 영향이 없습니다.`}
        confirmText="삭제"
        confirmVariant="destructive"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
