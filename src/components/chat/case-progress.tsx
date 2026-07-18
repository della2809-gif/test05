"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminCaseStep } from "@/types/database";

interface CaseProgressProps {
  steps: AdminCaseStep[];
  currentStep: number;
  isComplete: boolean;
}

export function CaseProgress({ steps, currentStep, isComplete }: CaseProgressProps) {
  if (steps.length === 0) return null;

  return (
    <div className="border-b border-border bg-surface px-4 py-2.5">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        {steps.map((step, i) => {
          const isDone = isComplete || i < currentStep;
          const isCurrent = !isComplete && i === currentStep;

          return (
            <div key={step.id} className="flex items-center gap-1.5 flex-shrink-0">
              {/* 스텝 노드 */}
              <div
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                  isDone
                    ? "bg-primary text-primary-foreground"
                    : isCurrent
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-muted text-foreground-tertiary"
                )}
              >
                {isDone ? (
                  <Check className="h-3 w-3 flex-shrink-0" />
                ) : (
                  <span className="h-3 w-3 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                )}
                <span className="max-w-[100px] truncate">{step.name}</span>
              </div>

              {/* 연결선 */}
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "h-px w-4 flex-shrink-0 transition-colors",
                    i < currentStep ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}

        {isComplete && (
          <div className="flex-shrink-0 ml-1 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-xs font-medium flex items-center gap-1">
            <Check className="h-3 w-3" />
            완료
          </div>
        )}
      </div>
    </div>
  );
}
