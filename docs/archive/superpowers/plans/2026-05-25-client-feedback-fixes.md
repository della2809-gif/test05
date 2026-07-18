# 5/25 클라이언트 피드백 수정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 이희정님 5/23~5/25 피드백 10개 항목 수정 (C-05 제외)

**Architecture:** UI 버그 2개 (IME) → 패키지 DB 구조 변경 → 텍스트/표시 개선 → AI 출력 개선 순서로 진행. DB 마이그레이션 1개(신규 컬럼 추가).

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL), TypeScript, React

---

## 변경 파일 목록

| 파일 | 작업 | 관련 항목 |
|------|------|-----------|
| `src/components/ui/input.tsx` | IME composition 처리 추가 | BUG-B02 |
| `src/components/ui/category-combobox.tsx` | IME composition 처리 추가 | BUG-B01, BUG-B02 |
| `src/app/admin/packages/page.tsx` | purpose 제거, tags 추가, components 명시 | BUG-B03, C-01, C-02 |
| `src/app/admin/links/page.tsx` | description 텍스트 수정 | C-03 |
| `src/app/admin/youtube/page.tsx` | 목록에 summary 표시 | C-04 |
| `src/app/admin/products/page.tsx` | usana_iq_url 필드 추가 | D-01 |
| `src/types/database.ts` | AdminProduct에 usana_iq_url 추가 | D-01 |
| `src/lib/commission-calculator.ts` | 시나리오 이름 변경 | D-02 |
| `src/lib/openai.ts` | stories 내용 truncate, packages purpose 제거, products에 usana_iq_url 추가 | BUG-B04, C-01, D-01 |
| `supabase/migrations/20260525000000_add_tags_and_iq_url.sql` | 신규 컬럼 추가 마이그레이션 | C-02, D-01 |

---

## Task 1: DB 마이그레이션 — tags, usana_iq_url 컬럼 추가

**Files:**
- Create: `supabase/migrations/20260525000000_add_tags_and_iq_url.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- C-02: 패키지 DB 태그 추가
ALTER TABLE public.admin_packages
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- D-01: 제품 DB 유사IQ 링크 추가
ALTER TABLE public.admin_products
  ADD COLUMN IF NOT EXISTS usana_iq_url TEXT;
```

- [ ] **Step 2: Supabase CLI로 적용**

```bash
npx supabase db push
```

Expected: "Applying migration 20260525000000_add_tags_and_iq_url.sql" 출력 후 오류 없음

- [ ] **Step 3: 적용 확인**

```bash
npx supabase db diff
```

Expected: diff 없음 (이미 동기화됨)

---

## Task 2: BUG-B02 — input.tsx IME 한글 마지막 글자 미저장 수정

**Files:**
- Modify: `src/components/ui/input.tsx`

**배경:** React controlled input에서 한글 입력 시 IME composition 중에는 `onChange`가 firing되지 않아, composition이 끝나면서 마지막 글자가 저장됨. 하지만 IME 완료 이벤트(onCompositionEnd)가 없으면 마지막 조합 글자가 state에 반영 안 됨.

- [ ] **Step 1: IME composition 처리 추가**

```tsx
import { forwardRef, useRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onChange, ...props }, ref) => {
    const composingRef = useRef(false);

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        onChange={onChange}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={(e) => {
          composingRef.current = false;
          onChange?.(e as unknown as React.ChangeEvent<HTMLInputElement>);
        }}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
```

- [ ] **Step 2: 빌드 오류 없는지 확인**

```bash
npx tsc --noEmit
```

Expected: 오류 없음

---

## Task 3: BUG-B01 — category-combobox.tsx IME 수정

**Files:**
- Modify: `src/components/ui/category-combobox.tsx`

**배경:** CategoryCombobox의 내부 `<input>`도 동일한 IME 문제. `handleInputChange`는 `e.target.value`를 즉시 `onChange`로 전달하는데, 한글 조합 중에는 마지막 글자가 composition 상태라 저장 안 됨.

- [ ] **Step 1: composing ref 추가 및 onCompositionEnd 처리**

`src/components/ui/category-combobox.tsx`의 상단 import에 `useRef` 추가:

```tsx
import { useEffect, useRef, useState } from "react";
```

컴포넌트 내부 state 선언부 바로 아래에 추가:

```tsx
const composingRef = useRef(false);
```

`handleInputChange` 함수 교체:

```tsx
function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
  const v = e.target.value;
  setInputValue(v);
  if (!composingRef.current) {
    onChange(v);
  }
  setOpen(true);
}
```

`<input>` 요소에 IME 이벤트 추가 (기존 `onChange={handleInputChange}` 아래에):

```tsx
onCompositionStart={() => { composingRef.current = true; }}
onCompositionEnd={(e) => {
  composingRef.current = false;
  const v = (e.target as HTMLInputElement).value;
  setInputValue(v);
  onChange(v);
}}
```

- [ ] **Step 2: 빌드 확인**

```bash
npx tsc --noEmit
```

Expected: 오류 없음

---

## Task 4: BUG-B03 + C-01 + C-02 — 패키지 DB 페이지 수정

**Files:**
- Modify: `src/app/admin/packages/page.tsx`

**배경:**
- BUG-B03: `components JSONB NOT NULL DEFAULT '[]'`인데 INSERT payload에 없어서 RLS 또는 constraint 오류 가능. `components: []` 명시적 포함으로 해결.
- C-01: `purpose` 필드 UI에서 완전 제거 (DB 컬럼은 nullable이므로 스키마 변경 불필요)
- C-02: `tags` 필드 추가 (Task 1 마이그레이션으로 컬럼 추가됨)

- [ ] **Step 1: `AdminPackage` 인터페이스 수정**

기존:
```typescript
interface AdminPackage {
  id: string;
  name: string;
  components: Record<string, unknown> | null;
  price: number;
  score: number;
  benefit: string | null;
  discount_rate: number | null;
  purpose: string;
  is_active: boolean;
  category: string | null;
  created_at: string;
}
```

교체:
```typescript
interface AdminPackage {
  id: string;
  name: string;
  components: Record<string, unknown>[] | null;
  price: number;
  score: number;
  benefit: string | null;
  discount_rate: number | null;
  is_active: boolean;
  category: string | null;
  tags: string[] | null;
  created_at: string;
}
```

- [ ] **Step 2: `PURPOSE_OPTIONS`, `PurposeValue`, `PURPOSE_LABEL` 상수 삭제**

파일 상단의 아래 코드 전부 삭제:
```typescript
const PURPOSE_OPTIONS = [
  { value: "reset_1w", label: "리셋해독 1주" },
  { value: "reset_2w", label: "리셋해독 2주" },
  { value: "challenge_active", label: "액티브챌린지팩" },
  { value: "challenge_basic", label: "베이직챌린지팩" },
] as const;

type PurposeValue = (typeof PURPOSE_OPTIONS)[number]["value"];

const PURPOSE_LABEL: Record<string, string> = Object.fromEntries(
  PURPOSE_OPTIONS.map((o) => [o.value, o.label])
);
```

- [ ] **Step 3: `EMPTY_FORM` 수정**

기존:
```typescript
const EMPTY_FORM = {
  name: "",
  purpose: "reset_1w" as PurposeValue,
  price: "",
  score: "",
  benefit: "",
  discount_rate: "",
  is_active: true,
  category: "",
};
```

교체:
```typescript
const EMPTY_FORM = {
  name: "",
  price: "",
  score: "",
  benefit: "",
  discount_rate: "",
  is_active: true,
  category: "",
  tags: "",
};
```

- [ ] **Step 4: `openEdit` 함수 수정**

기존:
```typescript
setForm({
  name: item.name,
  purpose: item.purpose as PurposeValue,
  price: String(item.price),
  score: String(item.score),
  benefit: item.benefit ?? "",
  discount_rate: item.discount_rate != null ? String(item.discount_rate) : "",
  is_active: item.is_active,
  category: item.category ?? "",
});
```

교체:
```typescript
setForm({
  name: item.name,
  price: String(item.price),
  score: String(item.score),
  benefit: item.benefit ?? "",
  discount_rate: item.discount_rate != null ? String(item.discount_rate) : "",
  is_active: item.is_active,
  category: item.category ?? "",
  tags: (item.tags ?? []).join(", "),
});
```

- [ ] **Step 5: `handleSave`의 payload 수정**

기존:
```typescript
const payload = {
  name: form.name.trim(),
  purpose: form.purpose,
  price: parseInt(form.price, 10),
  score: parseInt(form.score, 10),
  benefit: form.benefit.trim() || null,
  discount_rate: form.discount_rate ? parseFloat(form.discount_rate) : null,
  is_active: form.is_active,
  category: form.category.trim() || null,
};
```

교체:
```typescript
const tagsArray = form.tags
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

const payload = {
  name: form.name.trim(),
  components: [],
  price: parseInt(form.price, 10),
  score: parseInt(form.score, 10),
  benefit: form.benefit.trim() || null,
  discount_rate: form.discount_rate ? parseFloat(form.discount_rate) : null,
  is_active: form.is_active,
  category: form.category.trim() || null,
  tags: tagsArray.length > 0 ? tagsArray : null,
};
```

- [ ] **Step 6: 목록 항목 렌더링에서 purpose Badge 제거, tags 추가**

목록 렌더링에서 purpose Badge 줄 삭제:
```tsx
<Badge variant="outline">{PURPOSE_LABEL[item.purpose] ?? item.purpose}</Badge>
```

그 자리에 tags 표시 추가 (benefit `<p>` 태그 아래에 추가):
```tsx
{item.tags && item.tags.length > 0 && (
  <div className="flex gap-1 flex-wrap mt-1.5">
    {item.tags.map((tag) => (
      <span key={tag} className="text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">
        {tag}
      </span>
    ))}
  </div>
)}
```

- [ ] **Step 7: 검색 필터에서 purpose 참조 제거**

기존:
```typescript
const matchSearch =
  !search ||
  item.name.toLowerCase().includes(search.toLowerCase()) ||
  (PURPOSE_LABEL[item.purpose] ?? "").includes(search);
```

교체:
```typescript
const matchSearch =
  !search ||
  item.name.toLowerCase().includes(search.toLowerCase()) ||
  (item.category ?? "").toLowerCase().includes(search.toLowerCase());
```

- [ ] **Step 8: 검색 placeholder 수정**

기존: `placeholder="이름 또는 purpose로 검색..."`
교체: `placeholder="이름 또는 카테고리로 검색..."`

- [ ] **Step 9: Dialog 폼에서 Purpose 필드 제거, 태그 필드 추가**

Purpose select 블록 전체 삭제:
```tsx
<div>
  <label className="text-sm font-medium text-foreground mb-1.5 block">Purpose *</label>
  <select ...>...</select>
</div>
```

할인율 필드 아래에 태그 필드 추가:
```tsx
<div>
  <label className="text-sm font-medium text-foreground mb-1.5 block">태그 (쉼표로 구분)</label>
  <Input
    value={form.tags}
    onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
    placeholder="예: 다이어트, 해독 (쉼표로 구분)"
  />
</div>
```

- [ ] **Step 10: 빌드 확인**

```bash
npx tsc --noEmit
```

Expected: 오류 없음

---

## Task 5: C-03 — 링크 DB 설명 텍스트 수정

**Files:**
- Modify: `src/app/admin/links/page.tsx`

- [ ] **Step 1: 페이지 설명 텍스트 수정**

기존 (line ~189):
```tsx
<p className="text-sm text-foreground-secondary mt-1">유튜브·외부 링크 자료를 저장합니다. → 링크 자료 지플릿에서 참조합니다.</p>
```

교체:
```tsx
<p className="text-sm text-foreground-secondary mt-1">인스타그램·카카오채널·기사·웹사이트 등 인터넷 링크를 저장합니다. → 링크 자료 지플릿에서 참조합니다.</p>
```

---

## Task 6: C-04 — 유튜브 DB 목록에 요약 표시

**Files:**
- Modify: `src/app/admin/youtube/page.tsx`

- [ ] **Step 1: 목록 아이템에 summary 표시 추가**

목록 렌더링에서 `{item.video_id && ...}` 블록 아래, tags 블록 위에 추가:
```tsx
{item.summary && (
  <p className="text-xs text-foreground-secondary mt-1 line-clamp-2">{item.summary}</p>
)}
```

---

## Task 7: D-01 — 제품 DB usana_iq_url 필드 추가

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/app/admin/products/page.tsx`
- Modify: `src/lib/openai.ts`

### 7-A: types/database.ts

- [ ] **Step 1: AdminProduct 인터페이스에 usana_iq_url 추가**

`AdminProduct` 인터페이스에서 `aliases: string | null;` 뒤에 추가:
```typescript
usana_iq_url: string | null;
```

### 7-B: products/page.tsx

- [ ] **Step 2: ProductForm에 usana_iq_url 추가**

`ProductForm` 인터페이스 `aliases: string;` 뒤에 추가:
```typescript
usana_iq_url: string;
```

`EMPTY_FORM`에 추가:
```typescript
usana_iq_url: "",
```

`productToForm` 함수에 추가:
```typescript
usana_iq_url: item.usana_iq_url ?? "",
```

- [ ] **Step 3: INSERT/UPDATE payload에 usana_iq_url 추가**

`handleSave`의 payload에 추가:
```typescript
usana_iq_url: form.usana_iq_url.trim() || null,
```

- [ ] **Step 4: Dialog 폼에 유사IQ 링크 입력 필드 추가**

aliases 필드 아래에 추가:
```tsx
<div>
  <label className="text-sm font-medium text-foreground mb-1.5 block">유사IQ 링크</label>
  <Input
    value={form.usana_iq_url}
    onChange={(e) => setForm((f) => ({ ...f, usana_iq_url: e.target.value }))}
    placeholder="https://usanaq.com/... (선택)"
    type="url"
  />
</div>
```

- [ ] **Step 5: 목록 카드에 링크 표시 추가**

목록 렌더링에서 카테고리/태그 표시 아래에 추가:
```tsx
{item.usana_iq_url && (
  <a
    href={item.usana_iq_url}
    target="_blank"
    rel="noopener noreferrer"
    className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1"
  >
    <ExternalLink className="h-3 w-3 flex-shrink-0" />
    유사IQ 바로가기
  </a>
)}
```

ExternalLink가 import에 없으면 lucide-react import에 추가.

### 7-C: openai.ts

- [ ] **Step 6: products 쿼리에 usana_iq_url 포함 및 출력 형식 업데이트**

기존 (line ~82):
```typescript
loaders.push(wrap(supabase.from("admin_products").select("name, price, description, keywords, symptoms, category").limit(50).then(({ data }) => {
  if (data && data.length > 0)
    adminDataParts.push(`[제품 정보]\n${data.map((p) => `- ${p.name} (${p.price}원): ${p.description ?? ""} / 키워드: ${p.keywords ?? ""}`).join("\n")}`);
})));
```

교체:
```typescript
loaders.push(wrap(supabase.from("admin_products").select("name, price, description, keywords, symptoms, category, usana_iq_url").limit(50).then(({ data }) => {
  if (data && data.length > 0)
    adminDataParts.push(`[제품 정보]\n제품 추천 시 유사IQ 링크가 있으면 반드시 링크도 함께 제공하세요.\n${data.map((p) => `- ${p.name} (${p.price}원): ${p.description ?? ""} / 키워드: ${p.keywords ?? ""}${p.usana_iq_url ? ` / 유사IQ: ${p.usana_iq_url}` : ""}`).join("\n")}`);
})));
```

- [ ] **Step 7: 빌드 확인**

```bash
npx tsc --noEmit
```

Expected: 오류 없음

---

## Task 8: D-02 — 수당 시나리오 이름 변경

**Files:**
- Modify: `src/lib/commission-calculator.ts`

- [ ] **Step 1: Scenario 타입 및 시나리오 이름 변경**

`commission-calculator.ts` line 32:
```typescript
name: "보수형" | "표준형" | "공격형";
```
→
```typescript
name: "안정형" | "승급형" | "집중형";
```

line 120:
```typescript
name: "보수형",
```
→
```typescript
name: "안정형",
```

line 135 (표준형):
```typescript
name: "표준형",
```
→
```typescript
name: "승급형",
```

line 152 (공격형):
```typescript
name: "공격형",
```
→
```typescript
name: "집중형",
```

- [ ] **Step 2: 주석도 업데이트**

line 118: `// 보수형: 현 구조 유지` → `// 안정형: 현 구조 유지`
line 131: `// 표준형: 신규 1~2명 추가` → `// 승급형: 신규 1~2명 추가`
line 146: `// 공격형: 4주 집중` → `// 집중형: 4주 집중`

- [ ] **Step 3: travel-result.tsx 코멘트 확인**

`src/components/chat/travel-result.tsx`의 `// 표준형 기본` 코멘트는 `travel-calculator.ts` 참조용이므로 수정 불필요 (travel-calculator는 이번 수정 범위 외). 확인만 함.

- [ ] **Step 4: 빌드 확인**

```bash
npx tsc --noEmit
```

Expected: 오류 없음

---

## Task 9: BUG-B04 — AI 응답 실패 수정 (스토리 컨텍스트 overflow)

**Files:**
- Modify: `src/lib/openai.ts`

**배경:** "프로그래머 출신", "공학박사 출신" 등 특정 키워드로 검색 시 AI 응답 실패. RAG 결과 + 스토리 DB 콘텐츠가 과도하게 커서 GPT-4o 토큰 한계 초과 가능. 각 항목의 콘텐츠를 제한.

- [ ] **Step 1: stories 쿼리 — summary 길이 제한 적용**

기존 (line ~88):
```typescript
loaders.push(wrap(supabase.from("stories").select("name, summary, tags, category").eq("is_active", true).limit(10).then(({ data }) => {
  if (data && data.length > 0)
    adminDataParts.push(`[성공 스토리 DB]\n${data.map((s) => `- ${s.name ?? "익명"} (${s.category ?? ""}): ${s.summary ?? ""}\n  태그: ${(s.tags ?? []).join(", ")}`).join("\n")}`);
})));
```

교체:
```typescript
loaders.push(wrap(supabase.from("stories").select("name, summary, tags, category").eq("is_active", true).limit(10).then(({ data }) => {
  if (data && data.length > 0)
    adminDataParts.push(`[성공 스토리 DB]\n${data.map((s) => {
      const summary = (s.summary ?? "").slice(0, 300);
      return `- ${s.name ?? "익명"} (${s.category ?? ""}): ${summary}\n  태그: ${(s.tags ?? []).join(", ")}`;
    }).join("\n")}`);
})));
```

- [ ] **Step 2: packages 쿼리에서 purpose 제거 (C-01 연동)**

기존 (line ~76):
```typescript
loaders.push(wrap((supabase as any).from("admin_packages").select("name, purpose, price, score, benefit, discount_rate").eq("is_active", true).then(({ data }: { data: Array<{ name: string; purpose: string; price: number; score: number; benefit: string | null; discount_rate: number | null }> | null }) => {
  if (data && data.length > 0)
    adminDataParts.push(`[패키지 DB — 리셋·챌린지 패키지 구성]\n${data.map((p) => `- ${p.name} (${p.purpose}): ${p.price.toLocaleString()}원 / ${p.score}점${p.discount_rate ? ` / 할인 ${p.discount_rate}%` : ""}${p.benefit ? ` / 혜택: ${p.benefit}` : ""}`).join("\n")}`);
})));
```

교체:
```typescript
loaders.push(wrap((supabase as any).from("admin_packages").select("name, category, price, score, benefit, discount_rate").eq("is_active", true).then(({ data }: { data: Array<{ name: string; category: string | null; price: number; score: number; benefit: string | null; discount_rate: number | null }> | null }) => {
  if (data && data.length > 0)
    adminDataParts.push(`[패키지 DB — 리셋·챌린지 패키지 구성]\n${data.map((p) => `- ${p.name}${p.category ? ` (${p.category})` : ""}: ${p.price.toLocaleString()}원 / ${p.score}점${p.discount_rate ? ` / 할인 ${p.discount_rate}%` : ""}${p.benefit ? ` / 혜택: ${p.benefit}` : ""}`).join("\n")}`);
})));
```

- [ ] **Step 3: 빌드 확인**

```bash
npx tsc --noEmit
```

Expected: 오류 없음

---

## Task 10: 최종 빌드 및 동작 확인

- [ ] **Step 1: 전체 TypeScript 빌드**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 2: Next.js 빌드**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` 또는 `Route ... compiled`

- [ ] **Step 3: 개발 서버 실행 후 주요 페이지 동작 확인**

```bash
npm run dev -- --port 3001
```

확인 항목:
- `/admin/packages` — 패키지 추가 모달 열림, purpose 필드 없음, tags 필드 있음, 저장 성공
- `/admin/links` — 설명 텍스트 "인스타그램·카카오채널·기사·웹사이트..." 확인
- `/admin/youtube` — 목록에 summary 줄 표시
- `/admin/products` — 유사IQ 링크 필드 표시 및 저장
- 한글 입력 후 마지막 글자 저장 여부 (가능하면 브라우저 직접 테스트)

---

## 변경 요약 (이희정님 확인용)

| 항목 | 내용 | 상태 |
|------|------|------|
| BUG-B01 | 스토리 DB 카테고리 입력 시 마지막 글자 미저장 → 한글 입력 처리 수정 | Task 2, 3 |
| BUG-B02 | 전체 DB 제목 마지막 글자 미저장 → 동일한 한글 입력 처리 수정 | Task 2, 3 |
| BUG-B03 | 패키지 추가 저장 오류 → `components` 필드 명시 포함 | Task 4 |
| BUG-B04 | 채팅 AI 응답 실패 → 스토리 내용 길이 제한으로 context overflow 방지 | Task 9 |
| C-01 | 패키지 DB Purpose 필드 제거 | Task 4, 9 |
| C-02 | 패키지 DB 태그 필드 추가 | Task 1, 4 |
| C-03 | 링크 DB 설명 "인터넷 링크 전용" 명확화 | Task 5 |
| C-04 | 유튜브 DB 목록에 요약 표시 | Task 6 |
| D-01 | 제품 DB 유사IQ 링크 필드 추가 + AI 응답에도 포함 | Task 1, 7 |
| D-02 | 수당 시나리오 이름 변경 (보수형→안정형, 표준형→승급형, 공격형→집중형) | Task 8 |
