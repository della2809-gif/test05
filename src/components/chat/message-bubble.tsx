"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { FileText, ImageIcon, ChevronDown, ChevronUp, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Message, MessageRawContent, MessageAttachment } from "@/types/database";
import { QuotationCard } from "@/components/chat/quotation-card";
import type { QuotationResult } from "@/lib/quotation-engine";
import { CommissionResultCard } from "@/components/chat/commission-result";
import type { CommissionResult, Scenario } from "@/lib/commission-calculator";
import { TravelResultCard } from "@/components/chat/travel-result";
import type { TravelResult } from "@/lib/travel-calculator";
import { PackageQuoteCard } from "@/components/chat/package-quote-card";
import type { PackageQuoteResult } from "@/lib/package-quote-engine";
import { HealthQuoteCard } from "@/components/chat/health-quote-card";
import type { HealthQuoteResult } from "@/lib/health-quote-engine";
import { IntakeGuideCard } from "@/components/chat/intake-guide-card";
import type { IntakeGuidePayload } from "@/lib/intake-guide-engine";
import { UnifiedSearchCard } from "@/components/chat/unified-search-card";
import { UNIFIED_SEARCH_PREFIX, type UnifiedSearchCardPayload } from "@/lib/content-registry-search";

const supabaseStorageClient = createClient();

interface RenderMarkdownProps {
  onImageClick: (url: string) => void;
}

// 마크다운 인라인 파싱 — 링크, 굵게, 기울임, [IMAGE:url] 이미지 지원
function renderMarkdown(text: string, { onImageClick }: RenderMarkdownProps): React.ReactNode {
  const lines = text.split("\n");
  return lines.map((line, lineIdx) => {
    // [IMAGE:url] 패턴이 있는 줄은 이미지 블록으로 렌더링
    const imageMatch = line.match(/^\[IMAGE:(https?:\/\/[^\]]+)\]$/);
    if (imageMatch) {
      return (
        <span key={lineIdx} className="block my-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageMatch[1]}
            alt="참고 이미지"
            className="max-w-[260px] max-h-[200px] rounded-lg object-contain cursor-zoom-in hover:opacity-90 transition-opacity bg-black/5"
            onClick={() => onImageClick(imageMatch[1])}
          />
        </span>
      );
    }

    const parts: React.ReactNode[] = [];
    // 패턴 우선순위: [IMAGE:url] > [text](url) > **bold** > *italic* > bare URL
    // bare URL을 마지막에 두어 마크다운 링크 패턴이 먼저 소비되도록 함
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|\[IMAGE:(https?:\/\/[^\]]+)\]|\[(.+?)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/\S+))/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      if (match[2]) {
        // **bold**
        parts.push(<strong key={match.index}>{match[2]}</strong>);
      } else if (match[3]) {
        // *italic*
        parts.push(<em key={match.index}>{match[3]}</em>);
      } else if (match[4]) {
        // [IMAGE:url] 인라인
        const imgUrl = match[4];
        parts.push(
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={match.index}
            src={imgUrl}
            alt="참고 이미지"
            className="inline-block max-w-[260px] max-h-[200px] rounded-lg object-contain cursor-zoom-in hover:opacity-90 transition-opacity align-middle bg-black/5"
            onClick={() => onImageClick(imgUrl)}
          />
        );
      } else if (match[5] && match[6]) {
        // [text](url)
        parts.push(
          <a
            key={match.index}
            href={match[6]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            {match[5]}
          </a>
        );
      } else if (match[7]) {
        // bare URL — 문장 끝 구두점(.  ,  )  !  ?) 분리 후 링크 처리
        const rawUrl = match[7];
        const trailingMatch = rawUrl.match(/([.,!?)]+)$/);
        const url = trailingMatch ? rawUrl.slice(0, -trailingMatch[1].length) : rawUrl;
        const trailing = trailingMatch ? trailingMatch[1] : "";
        parts.push(
          <a
            key={match.index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity break-all"
          >
            {url}
          </a>
        );
        if (trailing) parts.push(trailing);
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }

    return (
      <span key={lineIdx}>
        {parts.length > 0 ? parts : line}
        {lineIdx < lines.length - 1 && "\n"}
      </span>
    );
  });
}

interface MessageBubbleProps {
  message: Message;
  rawContent?: MessageRawContent | null;
  attachments?: MessageAttachment[];
}

export function MessageBubble({ message, rawContent, attachments = [] }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [showRaw, setShowRaw] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // __QUOTATION__: 접두어 감지
  const QUOTATION_PREFIX = "__QUOTATION__:";
  const isQuotation = !isUser && message.content?.startsWith(QUOTATION_PREFIX);
  let quotationData: { analysis: unknown; judgment: unknown; quotation: QuotationResult } | null = null;
  if (isQuotation) {
    try {
      quotationData = JSON.parse(message.content.slice(QUOTATION_PREFIX.length));
    } catch {
      // 파싱 실패 시 일반 텍스트로 표시
    }
  }

  // __COMMISSION__: 접두어 감지
  const COMMISSION_PREFIX = "__COMMISSION__:";
  const isCommission = !isUser && message.content?.startsWith(COMMISSION_PREFIX);
  let commissionData: { result: CommissionResult; scenarios: Scenario[] } | null = null;
  if (isCommission) {
    try {
      commissionData = JSON.parse(message.content.slice(COMMISSION_PREFIX.length));
    } catch {
      // 파싱 실패 시 일반 텍스트로 표시
    }
  }

  // __TRAVEL__: 접두어 감지
  const TRAVEL_PREFIX = "__TRAVEL__:";
  const isTravel = !isUser && message.content?.startsWith(TRAVEL_PREFIX);
  let travelData: { result: TravelResult } | null = null;
  if (isTravel) {
    try {
      travelData = JSON.parse(message.content.slice(TRAVEL_PREFIX.length));
    } catch {
      // 파싱 실패 시 일반 텍스트로 표시
    }
  }

  // __HEALTHQUOTE__: 접두어 감지 (건강체크표 OCR → 건강분석 + 3단 견적 카드)
  const HEALTHQUOTE_PREFIX = "__HEALTHQUOTE__:";
  const isHealthQuote = !isUser && message.content?.startsWith(HEALTHQUOTE_PREFIX);
  let healthQuoteData: { analysis: unknown; result: HealthQuoteResult } | null = null;
  if (isHealthQuote) {
    try {
      healthQuoteData = JSON.parse(message.content.slice(HEALTHQUOTE_PREFIX.length));
    } catch {
      // 파싱 실패 시 일반 텍스트로 표시
    }
  }

  // __PKGQUOTE__: 접두어 감지 (텍스트 기반 패키지 견적)
  const PKGQUOTE_PREFIX = "__PKGQUOTE__:";
  const isPkgQuote = !isUser && message.content?.startsWith(PKGQUOTE_PREFIX);
  let pkgQuoteData: PackageQuoteResult | null = null;
  if (isPkgQuote) {
    try {
      pkgQuoteData = JSON.parse(message.content.slice(PKGQUOTE_PREFIX.length));
    } catch {
      // 파싱 실패 시 일반 텍스트로 표시
    }
  }

  const INTAKE_GUIDE_PREFIX = "__INTAKEGUIDE__:";
  const isIntakeGuide = !isUser && message.content?.startsWith(INTAKE_GUIDE_PREFIX);
  let intakeGuideData: IntakeGuidePayload | null = null;
  if (isIntakeGuide) {
    try {
      intakeGuideData = JSON.parse(message.content.slice(INTAKE_GUIDE_PREFIX.length));
    } catch {
      // 파싱 실패 시 일반 텍스트로 표시
    }
  }

  const isUnifiedSearch = !isUser && message.content?.startsWith(UNIFIED_SEARCH_PREFIX);
  let unifiedSearchData: UnifiedSearchCardPayload | null = null;
  if (isUnifiedSearch) {
    try {
      unifiedSearchData = JSON.parse(message.content.slice(UNIFIED_SEARCH_PREFIX.length));
    } catch {
      // 파싱 실패 시 일반 텍스트로 표시
    }
  }

  const IMAGE_TYPES = ["jpg", "jpeg", "png", "image/jpeg", "image/png"];

  function getPublicUrl(filePath: string) {
    const { data } = supabaseStorageClient.storage.from("attachments").getPublicUrl(filePath);
    return data?.publicUrl ?? "";
  }

  function handleDownload(att: MessageAttachment) {
    const url = getPublicUrl(att.file_path);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = att.file_name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }

  return (
    <>
      <div
        className={cn(
          "flex w-full",
          isUser ? "justify-end" : "justify-start"
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            (isQuotation && quotationData) || (isCommission && commissionData) || (isTravel && travelData) || (isPkgQuote && pkgQuoteData) || (isHealthQuote && healthQuoteData) || (isIntakeGuide && intakeGuideData) || (isUnifiedSearch && unifiedSearchData)
              ? "max-w-[95%] md:max-w-[95%]"
              : "max-w-[80%] md:max-w-[85%]",
            isUser
              ? "bg-bubble-user text-bubble-user-fg rounded-br-md"
              : "bg-bubble-assistant text-bubble-assistant-fg rounded-bl-md"
          )}
        >
          {/* 여행달성 카드 렌더링 */}
          {isUnifiedSearch && unifiedSearchData ? (
            <UnifiedSearchCard payload={unifiedSearchData} />
          ) : isIntakeGuide && intakeGuideData ? (
            <div className="w-full max-w-sm">
              <IntakeGuideCard result={intakeGuideData} />
            </div>
          ) : isTravel && travelData ? (
            <div className="w-full max-w-sm">
              <TravelResultCard result={travelData.result} />
            </div>
          ) : isCommission && commissionData ? (
            /* 수당 계산 카드 렌더링 */
            <div className="w-full max-w-sm">
              <CommissionResultCard result={commissionData.result} scenarios={commissionData.scenarios} />
            </div>
          ) : isPkgQuote && pkgQuoteData ? (
            /* 패키지 견적 카드 렌더링 (텍스트 질의) */
            <div className="w-full max-w-sm">
              <PackageQuoteCard result={pkgQuoteData} />
            </div>
          ) : isHealthQuote && healthQuoteData ? (
            /* 건강체크표 OCR → 건강 분석 + 3단 견적 카드 렌더링 */
            <div className="w-full max-w-sm">
              <HealthQuoteCard result={healthQuoteData.result} />
            </div>
          ) : isQuotation && quotationData ? (
            /* 견적 카드 렌더링 */
            <div className="w-full max-w-sm">
              {(quotationData.analysis as { summary?: string } | null)?.summary && (
                <p className="text-xs text-foreground-secondary mb-2">
                  {(quotationData.analysis as { summary: string }).summary}
                </p>
              )}
              <QuotationCard result={quotationData.quotation} />
            </div>
          ) : (
            message.content && (
              <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                {renderMarkdown(message.content, { onImageClick: setLightboxUrl })}
              </div>
            )
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className={cn("space-y-1.5", message.content ? "mt-2" : "")}>
              {attachments.map((att) => {
                const isImage = IMAGE_TYPES.includes(att.file_type);
                if (isImage) {
                  const url = getPublicUrl(att.file_path);
                  return (
                    <div key={att.id} className="relative inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={att.file_name}
                        className="max-w-[240px] max-h-[200px] rounded-lg object-contain cursor-zoom-in hover:opacity-90 transition-opacity bg-black/5"
                        onClick={() => setLightboxUrl(url)}
                      />
                    </div>
                  );
                }
                return (
                  <button
                    key={att.id}
                    onClick={() => handleDownload(att)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs w-full text-left hover:opacity-80 transition-opacity",
                      isUser
                        ? "bg-white/20 text-bubble-user-fg"
                        : "bg-black/10 text-bubble-assistant-fg"
                    )}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate max-w-[200px] flex-1">{att.file_name}</span>
                    <Download className="h-3 w-3 shrink-0 opacity-70" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Raw content toggle — user messages only */}
          {isUser && rawContent && (
            <div className="mt-2">
              <button
                onClick={() => setShowRaw((v) => !v)}
                className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100 transition-opacity"
              >
                {showRaw ? (
                  <>
                    <ChevronUp className="h-3 w-3" /> 원문 접기
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" /> 원문 보기
                  </>
                )}
              </button>
              {showRaw && (
                <div className="mt-1.5 rounded-lg bg-black/10 px-3 py-2 text-xs whitespace-pre-wrap break-words">
                  {rawContent.raw_content}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Image lightbox — 핀치줌·더블탭·휠줌·드래그 지원 (모바일에서 이미지가 화면 맞춤으로만
          보여 확대 불가하던 문제 해결). 확대 상태에서 드래그가 닫기로 오인되지 않게
          닫기는 X 버튼으로만 동작한다. */}
      {mounted && lightboxUrl && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/85">
          <button
            className="absolute top-4 right-4 z-[10000] rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
            onClick={() => setLightboxUrl(null)}
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
          <TransformWrapper
            doubleClick={{ mode: "toggle" }}
            pinch={{ step: 5 }}
            wheel={{ step: 0.2 }}
            minScale={1}
            maxScale={6}
            centerOnInit
          >
            <TransformComponent
              wrapperStyle={{ width: "100vw", height: "100vh" }}
              contentStyle={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxUrl}
                alt="전체 이미지"
                className="max-w-[95vw] max-h-[92vh] rounded-lg object-contain shadow-2xl select-none"
                draggable={false}
              />
            </TransformComponent>
          </TransformWrapper>
        </div>,
        document.body
      )}
    </>
  );
}
