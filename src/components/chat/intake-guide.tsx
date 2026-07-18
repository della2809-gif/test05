"use client";

import { useState } from "react";

const NUTRIMILL_TYPE = ["뉴트리밀 액티브", "뉴트리밀 일반"];
// 맛 구성 (클라이언트 확정값, 2026-06-11)
const NUTRIMILL_FLAVOR_ACTIVE = ["소이바닐라", "소이초코", "웨이초코", "소이바닐라(개별포장)", "소이초코(개별포장)"];
const NUTRIMILL_FLAVOR_REGULAR = ["바닐라", "초코", "딸기", "카푸치노"];

interface IntakeGuideProps {
  defaultQty?: number; // 뉴트리밀 권장 수량
}

export function IntakeGuide({ defaultQty = 2 }: IntakeGuideProps) {
  const [type, setType] = useState(NUTRIMILL_TYPE[0]);
  const [flavor, setFlavor] = useState("");
  const [qty, setQty] = useState(defaultQty);
  const [extras, setExtras] = useState({ shaker: false, zipbag: false });

  const flavors = type === NUTRIMILL_TYPE[0] ? NUTRIMILL_FLAVOR_ACTIVE : NUTRIMILL_FLAVOR_REGULAR;

  const summary = [
    `${type} ${qty}통`,
    flavor ? `맛: ${flavor}` : "",
    extras.shaker ? "+ 쉐이커" : "",
    extras.zipbag ? "+ 지퍼백" : "",
  ].filter(Boolean).join(" / ");

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3 mt-2">
      <p className="text-xs font-semibold text-foreground">섭취방법 선택</p>

      {/* 뉴트리밀 종류 */}
      <div className="space-y-1.5">
        <p className="text-xs text-foreground-secondary">뉴트리밀 종류</p>
        <div className="flex gap-2">
          {NUTRIMILL_TYPE.map((t) => (
            <button
              key={t}
              onClick={() => { setType(t); setFlavor(""); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                type === t ? "bg-foreground text-background border-foreground" : "bg-surface border-border text-foreground-secondary hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 맛 선택 */}
      <div className="space-y-1.5">
        <p className="text-xs text-foreground-secondary">맛 선택</p>
        <div className="flex gap-1.5 flex-wrap">
          {flavors.map((f) => (
            <button
              key={f}
              onClick={() => setFlavor(f === flavor ? "" : f)}
              className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                flavor === f ? "bg-primary text-primary-fg border-primary" : "bg-surface border-border text-foreground-secondary hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* 수량 */}
      <div className="flex items-center gap-3">
        <p className="text-xs text-foreground-secondary">수량</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="h-6 w-6 rounded-md border border-border text-sm flex items-center justify-center hover:bg-surface-hover">−</button>
          <span className="text-sm font-medium w-6 text-center">{qty}</span>
          <button onClick={() => setQty(qty + 1)} className="h-6 w-6 rounded-md border border-border text-sm flex items-center justify-center hover:bg-surface-hover">+</button>
          <span className="text-xs text-foreground-secondary">통</span>
        </div>
      </div>

      {/* 추가 옵션 */}
      <div className="flex gap-3">
        {[{ key: "shaker", label: "+ 쉐이커" }, { key: "zipbag", label: "+ 지퍼백" }].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-1.5 text-xs text-foreground-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={extras[key as keyof typeof extras]}
              onChange={(e) => setExtras((p) => ({ ...p, [key]: e.target.checked }))}
              className="rounded"
            />
            {label}
          </label>
        ))}
      </div>

      {/* 요약 */}
      {summary && (
        <p className="text-xs text-foreground bg-surface-hover rounded-lg px-3 py-2">{summary}</p>
      )}
    </div>
  );
}
