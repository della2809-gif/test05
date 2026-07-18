"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

function NewScheduleForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: params.get("title") ?? "",
    schedule_type: params.get("type") ?? "meeting",
    life_layer: "",
    scheduled_date: params.get("date") ?? new Date().toISOString().split("T")[0],
    scheduled_time: "",
    notes: "",
  });

  const selectClass = "rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-full";

  async function handleSave() {
    if (!form.title.trim()) { toast.error("제목을 입력해주세요."); return; }
    if (!form.scheduled_date) { toast.error("날짜를 선택해주세요."); return; }
    setSaving(true);

    const res = await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        scheduled_time: form.scheduled_time || null,
        life_layer: form.life_layer || null,
        notes: form.notes || null,
        contact_id: params.get("contact_id") || null,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "저장에 실패했습니다.");
    } else {
      toast.success("일정이 추가됐습니다.");
      router.push("/schedule");
    }
    setSaving(false);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 rounded-lg hover:bg-surface-hover">
            <ArrowLeft className="h-5 w-5 text-foreground-secondary" />
          </button>
          <h1 className="text-xl font-bold text-foreground">일정 추가</h1>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">제목 *</label>
            <Input placeholder="미팅, 팔로업, AO 확인..." value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} autoFocus />
          </div>

          {[
            { label: "유형", field: "schedule_type", options: [
              { value: "meeting", label: "미팅/상담" },
              { value: "followup", label: "팔로업" },
              { value: "ao_check", label: "AO 확인" },
              { value: "milestone", label: "마일스톤" },
              { value: "personal", label: "개인 일정" },
            ]},
            { label: "라이프 레이어", field: "life_layer", options: [
              { value: "", label: "선택 안함" },
              { value: "개인", label: "개인" },
              { value: "가족", label: "가족" },
              { value: "본업", label: "본업" },
              { value: "유사나", label: "유사나" },
              { value: "투잡", label: "투잡" },
            ]},
          ].map(({ label, field, options }) => (
            <div key={field} className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{label}</label>
              <select value={(form as Record<string, string>)[field]} onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))} className={selectClass}>
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">날짜 *</label>
              <input type="date" value={form.scheduled_date} onChange={(e) => setForm((p) => ({ ...p, scheduled_date: e.target.value }))} className={selectClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">시간 (선택)</label>
              <input type="time" value={form.scheduled_time} onChange={(e) => setForm((p) => ({ ...p, scheduled_time: e.target.value }))} className={selectClass} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">메모</label>
            <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="특이사항, 준비사항 등" rows={2}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => router.back()} className="flex-1">취소</Button>
          <Button onClick={handleSave} loading={saving} className="flex-1">저장</Button>
        </div>
      </div>
    </div>
  );
}

export default function NewSchedulePage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Spinner size="lg" /></div>}>
      <NewScheduleForm />
    </Suspense>
  );
}
