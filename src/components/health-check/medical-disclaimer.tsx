import { ShieldCheck } from "lucide-react";
import { MEDICAL_DISCLAIMER } from "@/features/health-check/scoring";

export function MedicalDisclaimer() {
  return (
    <aside className="flex gap-3 rounded-xl border border-border bg-muted/60 p-4 text-xs leading-5 text-foreground-secondary">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p><strong className="text-foreground">의료 안내</strong><br />{MEDICAL_DISCLAIMER}</p>
    </aside>
  );
}
