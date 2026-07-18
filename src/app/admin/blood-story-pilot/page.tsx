"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Database, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BLOOD_STORY_PILOT_CASES,
  BloodStorySearchResult,
  searchBloodStories,
} from "@/lib/blood-story-pilot";

const EXAMPLE_QUERIES = [
  "림프종 사례 있어?",
  "심장이 안 좋은 사람 사례 보여줘",
  "고지혈증 약 먹고 다이어트가 안 되는 사례",
  "계속 배가 부풀어 오르는 사람 사례",
  "무릎이나 연골 관련 사례",
];

export default function BloodStoryPilotPage() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const results = useMemo<BloodStorySearchResult[]>(
    () => (submittedQuery ? searchBloodStories(submittedQuery) : []), [submittedQuery]
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmittedQuery(query.trim());
    setExpanded({});
  }

  function runExample(value: string) {
    setQuery(value);
    setSubmittedQuery(value);
    setExpanded({});
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <Database className="h-4 w-4" /> 운영 DB 변경 없는 Git 테스트 브랜치
          </div>
          <h1 className="text-2xl font-bold text-foreground">혈통만사 통합 자료찾기 파일럿</h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            평소 말투로 질문하면 주제·키워드·별칭을 비교해 관련 사례를 최대 3건까지 보여줍니다.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="font-semibold text-foreground">테스트 데이터</p>
          <p className="mt-1 text-foreground-secondary">사례 {BLOOD_STORY_PILOT_CASES.length}건 · 이미지 29장</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm md:p-6">
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-tertiary" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder="예: 림프종 사례 있어?" className="h-12 pl-10"
              aria-label="혈통만사 사례 검색 질문" />
          </div>
          <Button type="submit" size="lg" disabled={!query.trim()}>자료 찾기</Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map((example) => (
            <button key={example} type="button" onClick={() => runExample(example)}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground-secondary transition-colors hover:border-primary hover:text-primary">
              {example}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
        <div className="text-sm leading-6">
          <p className="font-semibold">체험사례는 치료 효과를 보장하는 근거가 아닙니다.</p>
          <p>질환·지속 증상·복용약이 관련된 질문은 제품 추천보다 의료진 확인이 우선이며, 이 화면은 자료 검색만 검증합니다.</p>
        </div>
      </div>

      {!submittedQuery ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-foreground-secondary">
          위 예시를 누르거나 팀원이 실제로 하는 질문을 입력해 테스트해보세요.
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center">
          <p className="font-semibold text-foreground">현재 파일럿 DB에서 관련 사례를 찾지 못했습니다.</p>
          <p className="mt-2 text-sm text-foreground-secondary">
            없는 자료를 만들어내지 않았습니다. 질환·증상·주제 중 하나를 더 구체적으로 입력해주세요.
          </p>
        </div>
      ) : (
        <section className="space-y-4" aria-live="polite">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">검색 결과 {results.length}건</h2>
              <p className="text-sm text-foreground-secondary">질문: “{submittedQuery}”</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> 상위 3건 제한
            </div>
          </div>

          {results.map((result, index) => {
            const item = result.item;
            const isExpanded = expanded[item.id] ?? false;
            const visibleImages = isExpanded ? item.images : item.images.slice(0, 1);
            return (
              <article key={item.id} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
                <div className="border-b border-border p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-primary">{index + 1}순위 · 혈통만사 {item.id}</p>
                      <h3 className="mt-1 text-lg font-bold text-foreground">{item.title}</h3>
                    </div>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{item.secondaryCategory}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.keywords.map((keyword) => (
                      <span key={keyword} className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">{keyword}</span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-foreground-secondary">
                    매칭: {result.matchedTerms.join(", ")} · 사례 이미지 {item.images.length}장 · 상태: 테스트 준비 완료
                  </p>
                </div>

                <div className="grid gap-4 bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-3 md:p-5">
                  {visibleImages.map((src, imageIndex) => (
                    <div key={src} className="overflow-hidden rounded-xl border border-border bg-background">
                      <div className="border-b border-border px-3 py-2 text-xs font-medium text-foreground-secondary">
                        {imageIndex + 1} / {item.images.length} 페이지
                      </div>
                      <Image src={src} alt={item.title + " " + (imageIndex + 1) + "페이지"}
                        width={1080} height={2120} className="h-auto w-full"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                    </div>
                  ))}
                </div>

                {item.images.length > 1 && (
                  <div className="border-t border-border p-3 text-center">
                    <Button type="button" variant="ghost" size="sm"
                      onClick={() => setExpanded((current) => ({ ...current, [item.id]: !isExpanded }))}>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {isExpanded ? "첫 페이지만 보기" : "사례 전체 페이지 보기"}
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
