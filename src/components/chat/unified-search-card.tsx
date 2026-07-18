"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Box, ChevronRight, ExternalLink, Images, Link2, Medal, Star, Video, X } from "lucide-react";
import type { UnifiedSearchCardPayload } from "@/lib/content-registry-search";
import { cn } from "@/lib/utils";

type UnifiedSearchCardProps = {
  payload: UnifiedSearchCardPayload;
};

function RatingStars({ score }: { score: number | null }) {
  const starScore = typeof score === "number" && score >= 0 && score <= 5 ? score : null;
  if (starScore === null) return null;
  const filled = Math.round(starScore);
  return (
    <div className="flex items-center gap-0.5" aria-label={`평점 ${score}점`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn(
            "h-4 w-4",
            index < filled ? "fill-blue-500 text-blue-500" : "fill-transparent text-blue-200",
          )}
        />
      ))}
    </div>
  );
}

export function UnifiedSearchCard({ payload }: UnifiedSearchCardProps) {
  const [gallery, setGallery] = useState<UnifiedSearchCardPayload["results"][number] | null>(null);


  const galleryImages = useMemo(() => gallery?.images.filter(Boolean) ?? [], [gallery]);

  return (
    <>
      <div className="w-full max-w-md space-y-3">
        <div>
          <p className="font-semibold text-foreground">
            {payload.results.length > 0 ? "관련 자료를 찾았어요." : "현재 등록된 자료를 찾지 못했어요."}
          </p>
          <p className="mt-1 text-xs text-foreground-secondary">
            {payload.results.length > 0
              ? "먼저 보기 좋은 자료부터 보여드릴게요."
              : "다른 표현이나 제품명·주제명으로 다시 검색해 주세요."}
          </p>
        </div>

        <div className="space-y-2.5">
          {payload.results.map((result) => {
            const isRating = result.sourceTable === "supplement_product_ratings";
            const isStory = result.sourceTable === "blood_story_cases";
            const isYoutube = result.sourceTable === "youtube_transcripts";
            const isLink = result.sourceTable === "links";
            const isProduct = result.sourceTable === "admin_products";
            const isReference = isStory || isYoutube || isLink;
            const heroUrl = result.images[0] ?? result.thumbnailUrl;
            const accentClass = isRating
              ? "border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/30"
              : isReference
                ? "border-violet-200 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/25"
                : "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/25";

            return (
              <article key={result.id} className={cn("overflow-hidden rounded-2xl border", accentClass)}>
                {heroUrl && (
                  <button
                    type="button"
                    className="relative block w-full bg-black/5 text-left"
                    onClick={() => {
                      if (result.images.length > 0) setGallery(result);
                      else if (result.resourceUrl) window.open(result.resourceUrl, "_blank", "noopener,noreferrer");
                    }}
                    aria-label={`${result.title} 상세 이미지 보기`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={heroUrl}
                      alt={result.title}
                      className="max-h-64 w-full object-contain"
                    />
                    {result.images.length > 1 && (
                      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/75 px-2.5 py-1 text-xs font-medium text-white">
                        <Images className="h-3.5 w-3.5" />
                        {result.images.length}장 이어보기
                      </span>
                    )}
                  </button>
                )}

                <div className="space-y-2.5 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className={cn(
                        "mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        isRating
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                          : isReference
                            ? "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200",
                      )}>
                        {isRating ? <Star className="h-3 w-3" /> : isProduct ? <Box className="h-3 w-3" /> : isYoutube ? <Video className="h-3 w-3" /> : isLink ? <Link2 className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
                        {result.typeLabel}
                      </span>
                      <h3 className="line-clamp-2 font-semibold text-foreground">{result.title}</h3>
                    </div>
                    {result.images.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setGallery(result)}
                        className="shrink-0 rounded-full p-1 text-foreground-secondary hover:bg-black/5"
                        aria-label="상세 보기"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {isRating && result.rating && (
                    <div className="rounded-xl border border-blue-100 bg-white/80 p-3 dark:border-blue-900 dark:bg-black/10">
                      <div className="flex flex-wrap items-center gap-2">
                        <RatingStars score={result.rating.rating_score} />
                        {result.rating.rating_score == null && result.rating.rating_display && (
                          <span className="text-sm font-semibold text-blue-700 dark:text-blue-200">
                            {result.rating.rating_display}
                          </span>
                        )}
                        {result.rating.medal_value && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-900 dark:text-violet-200">
                            <Medal className="h-3.5 w-3.5" />
                            {result.rating.medal_value}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground-secondary">
                        <span>{result.rating.brand_book}</span>
                        <span>{result.rating.country}</span>
                        {result.rating.edition && <span>{result.rating.edition}</span>}
                      </div>
                    </div>
                  )}

                  {isProduct && result.product && (
                    <div className="rounded-xl border border-emerald-100 bg-white/80 p-3 text-xs dark:border-emerald-900 dark:bg-black/10">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold text-foreground">
                        {typeof result.product.price === "number" && (
                          <span>{result.product.price.toLocaleString("ko-KR")}원</span>
                        )}
                        {typeof result.product.score === "number" && <span>{result.product.score}PV</span>}
                        {result.product.product_number && <span>제품번호 {result.product.product_number}</span>}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-foreground-secondary">
                        {result.product.category && <span>{result.product.category}</span>}
                        {result.product.sub_category && <span>{result.product.sub_category}</span>}
                      </div>
                    </div>
                  )}


                  {result.summary && (
                    <p className="line-clamp-3 text-xs leading-relaxed text-foreground-secondary">
                      {result.summary}
                    </p>
                  )}

                  {result.resourceUrl && (isYoutube || isLink) && (
                    <a
                      href={result.resourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-white dark:border-violet-900 dark:bg-black/10 dark:text-violet-200"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {isYoutube ? "영상 열기" : "링크 열기"}
                    </a>
                  )}


                  {isProduct && result.resourceUrl && (
                    <a
                      href={result.resourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-white dark:border-emerald-900 dark:bg-black/10 dark:text-emerald-200"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      제품 상세 열기
                    </a>
                  )}

                </div>
              </article>
            );
          })}
        </div>

        {payload.results.length === 0 ? null : payload.moreOptions.length > 0 ? (
          <div className="space-y-2 pt-1">
            <p className="text-sm font-medium text-foreground">어떤 자료를 더 볼까요?</p>
            <div className="flex flex-wrap gap-1.5">
              {payload.moreOptions.map((option) => (
                <span
                  key={option.sourceTable}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground-secondary"
                >
                  {option.typeLabel} {option.remaining}건 더
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="pt-1 text-sm text-foreground-secondary">관련 자료를 모두 보여드렸어요.</p>
        )}
      </div>

      {gallery && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/90">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-black/80 px-4 py-3 text-white backdrop-blur">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{gallery.title}</p>
              <p className="text-xs text-white/65">{galleryImages.length}장</p>
            </div>
            <button
              type="button"
              className="rounded-full bg-white/10 p-2 hover:bg-white/20"
              onClick={() => setGallery(null)}
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mx-auto flex max-w-3xl flex-col gap-3 px-2 py-3 sm:px-4">
            {galleryImages.map((url, index) => (
              <figure key={url} className="overflow-hidden rounded-xl bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`${gallery.title} ${index + 1}페이지`} className="h-auto w-full object-contain" />
              </figure>
            ))}
            {gallery.footerNotice && (
              <p className="px-2 pb-8 pt-2 text-center text-[11px] leading-relaxed text-white/60">
                참고: {gallery.footerNotice}
              </p>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
