"use client";

import { ArrowUpRight } from "lucide-react";

const HEALTH_ACCOUNT_URL =
  "https://health-asset-coaching.fluffy-cow-3410.chatgpt.site/";
const VISITOR_KEY = "wellset-visitor-id-v1";
const EVENT_KEY = "wellset-journal-events-v1";

type HealthAssetCtaProps = {
  label: string;
  mode: "full" | "sleep" | "energy" | "metabolic" | "muscle" | "parent";
  contentId: string;
  keywordId: string;
  campaignId?: string;
  className?: string;
  view?: "check" | "passport";
};

function ensureVisitorId() {
  const saved = window.localStorage.getItem(VISITOR_KEY);
  if (saved) return saved;
  const created =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(VISITOR_KEY, created);
  return created;
}

export function HealthAssetCta({
  label,
  mode,
  contentId,
  keywordId,
  campaignId = "wellset_journal_health",
  className,
  view = "check",
}: HealthAssetCtaProps) {
  function buildHref(visitorId?: string) {
    const params = new URLSearchParams({
      view,
      mode,
      content_id: contentId,
      keyword_id: keywordId,
      campaign_id: campaignId,
      check_id: mode,
      utm_source: "wellset_journal",
      utm_medium: "contextual_cta",
      utm_campaign: campaignId,
    });
    if (visitorId) params.set("visitor_id", visitorId);
    return `${HEALTH_ACCOUNT_URL}?${params.toString()}`;
  }

  function trackClick(event: React.MouseEvent<HTMLAnchorElement>) {
    try {
      const visitorId = ensureVisitorId();
      event.currentTarget.href = buildHref(visitorId);
      const previous = JSON.parse(
        window.localStorage.getItem(EVENT_KEY) ?? "[]",
      ) as unknown[];
      window.localStorage.setItem(
        EVENT_KEY,
        JSON.stringify([
          ...previous.slice(-99),
          {
            name: "journal_cta_click",
            visitorId,
            contentId,
            keywordId,
            campaignId,
            checkId: mode,
            occurredAt: new Date().toISOString(),
          },
        ]),
      );
    } catch {
      // Navigation remains available when browser storage is unavailable.
    }
  }

  return (
    <a className={className} href={buildHref()} onClick={trackClick}>
      {label}
      <ArrowUpRight size={16} />
    </a>
  );
}
