#!/usr/bin/env node
/**
 * apply_hold_anonymized_20260703.mjs
 *
 * D그룹 HOLD 항목 중 "익명화 후 반영" 대상 4건만 멱등하게 반영한다.
 * (클라이언트 승인: 2026-07-03 00:29 슬랙 usanaheejung516 "익명으로 해서 전부 반영해주세요")
 *
 * 대상 4건:
 *   1) Story  — 가족이 걱정하는 파트너를 스폰서가 진심으로 브릿지한 사례
 *   2) Story  — 5년간 지켜보다 관심이 열린 파트너 사례
 *   3) admin_blocks(Reference) — 키리더 줌미팅_보상기트 운영 20260623
 *   4) admin_blocks(Reference) — 키리더 줌미팅_기트 후속 가이드 20260630
 *
 * 반영 제외(HOLD 유지): 링크 1건(URL 미확정), 제품/패키지 1건(가격 미확정)
 *   → 익명화와 무관한 사유라 이 스크립트 대상 아님.
 *
 * 익명화 원칙:
 *   - 실명 → 가명/일반화, 조직·라인 실명 → "소속 라인/팀", 구체 금액·지역·연락처 → 일반화.
 *   - 원본 후보 행(geniea_db_batches/20260630 코칭 CSV)은 이미 필드 단계에서
 *     3인칭 일반화("어떤 파트너/어떤 분/스폰서/가족")로 작성되어 실명·연락처·금액 0건.
 *   - Reference 2건은 전사본 원문을 담지 않고 "익명화된 참고용 요약 + 원문 미포함" 표식을 붙여 반영.
 *
 * 기본 동작: DRY-RUN. 실제 반영은 --apply.
 * 멱등성: stories=name, admin_blocks=title 존재 체크 후 삽입. 재실행해도 중복 없음.
 * --apply 시 삽입 후 document_chunks 임베딩(text-embedding-3-small, 800/100) 생성.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const APPLY = process.argv.includes("--apply");

// --- env ---
function loadEnv() {
  const env = {};
  try {
    const raw = readFileSync(join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch {}
  return env;
}
const ENV = loadEnv();
const SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = ENV.OPENAI_API_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL / SERVICE_ROLE_KEY 누락 (.env.local 확인)");
  process.exit(1);
}
const SB_HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

// --- Supabase REST ---
async function existsBy(table, column, value) {
  const u = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  u.searchParams.set("select", column);
  u.searchParams.set(column, `eq.${value}`);
  const res = await fetch(u, { headers: SB_HEADERS });
  if (!res.ok) throw new Error(`exists ${table} ${res.status}: ${await res.text()}`);
  return (await res.json()).length > 0;
}
async function sbInsert(table, payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...SB_HEADERS, Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`insert ${table} ${res.status}: ${await res.text()}`);
  return (await res.json())[0];
}

// --- 임베딩 (admin 파이프라인 재현) ---
function splitIntoChunks(text, chunkSize = 800, overlap = 100) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
    if (start >= text.length) break;
  }
  return chunks;
}
async function createEmbedding(input) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input }),
  });
  if (!res.ok) throw new Error(`embedding ${res.status}: ${await res.text()}`);
  return (await res.json()).data[0].embedding;
}
async function embedSource(sourceType, sourceId, sourceName, text) {
  let inserted = 0;
  for (const chunk of splitIntoChunks(text)) {
    const embedding = await createEmbedding(chunk);
    await sbInsert("document_chunks", {
      source_type: sourceType,
      source_id: sourceId ?? null,
      source_name: sourceName ?? "",
      chunk_text: chunk,
      embedding: JSON.stringify(embedding),
    });
    inserted++;
  }
  return inserted;
}

// ---------------------------------------------------------------------------
// 익명화 반영 대상 4건 (검토 완료본)
// ---------------------------------------------------------------------------
const REF_PREFIX =
  "[상태] 익명화 처리된 참고용 요약 — 전사본 원문은 미포함(실명·소속 라인·직급·건강/가족 사례·금전·점수 등 민감정보 제외).";

const ITEMS = [
  {
    table: "stories",
    key: { column: "name", value: "가족이 걱정하는 파트너를 스폰서가 진심으로 브릿지한 사례" },
    payload: {
      name: "가족이 걱정하는 파트너를 스폰서가 진심으로 브릿지한 사례",
      summary:
        "어떤 파트너는 가족이 걱정해서 시스템 참여도 눈치가 보였습니다. 그때 스폰서가 가족에게 " +
        "“이 사람이 무리하려는 게 아니라 자기 삶을 더 건강하게 세우려고 하는 과정”이라고 진심을 전했고, " +
        "가족의 걱정이 조금 풀리면서 파트너도 마음이 놓였습니다. (가족 설득을 보장하지 않으며, 안심시키는 대화의 예시로만 사용)",
      category: "business",
      tags: ["가족 반대", "가족 걱정", "스폰서 브릿지", "파트너 위축", "진심 전달"],
      is_active: true,
    },
    embed: { type: "story" },
  },
  {
    table: "stories",
    key: { column: "name", value: "5년간 지켜보다 관심이 열린 파트너 사례" },
    payload: {
      name: "5년간 지켜보다 관심이 열린 파트너 사례",
      summary:
        "어떤 분은 처음엔 부담스럽고 어렵게 느꼈지만, 가까운 사람이 꾸준히 건강하게 쓰고 진심으로 돕는 모습을 " +
        "오래 보면서 관심이 열렸습니다. 결국 제품 경험과 신뢰가 쌓이면서 “나도 해볼 수 있겠다”는 생각으로 이어졌습니다.",
      category: "business",
      tags: ["오래 지켜본 소비자", "신뢰 형성", "파트너 전환", "관심 열림"],
      is_active: true,
    },
    embed: { type: "story" },
  },
  {
    table: "admin_blocks",
    key: { column: "title", value: "키리더 줌미팅_보상기트 운영 20260623" },
    payload: {
      title: "키리더 줌미팅_보상기트 운영 20260623",
      category: "D그룹_Reference",
      content: [
        REF_PREFIX,
        "[사용 상황] 보상기트 운영/후속 코칭 원리 참고용 보관",
        "[질문 예시] 보상기트 운영 줌미팅 내용을 참고자료로 보관할 수 있나요?",
        "[핵심 판단] 원문에는 민감 맥락(실명·소속 라인·직급·건강/가족 사례·운영방 세부)이 포함되어 그대로 노출은 부적합 → 익명화 요약만 보관",
        "[답변 방향] 출력용은 코칭 원리와 말버전만 분리해서 사용, 개인 식별 정보는 노출하지 않음",
        "[말버전] 이 자료는 원문을 그대로 답변에 쓰기보다, 보상기트 운영과 후속 코칭 흐름을 뽑는 참고자료로 봅니다.",
      ].join("\n"),
    },
    embed: { type: "admin_block" },
  },
  {
    table: "admin_blocks",
    key: { column: "title", value: "키리더 줌미팅_기트 후속 가이드 20260630" },
    payload: {
      title: "키리더 줌미팅_기트 후속 가이드 20260630",
      category: "D그룹_Reference",
      content: [
        REF_PREFIX,
        "[사용 상황] 기트/보상기트 후속 가이드 원리 참고용 보관",
        "[질문 예시] 기트 후속 미팅 내용을 참고자료로 보관할 수 있나요?",
        "[핵심 판단] 원문에는 민감 맥락(실명·소속 라인·가족·건강·금전·점수)이 있어 그대로 노출 금지 → 익명화 요약만 보관",
        "[답변 방향] 운영자 내부 참고 및 후속 질문법/코칭 흐름 도출용으로만 사용",
        "[말버전] 원문은 답변에 직접 노출하지 않고, 후속 질문법과 코칭 흐름을 뽑는 참고자료로만 봅니다.",
      ].join("\n"),
    },
    embed: { type: "admin_block" },
  },
];

function embedText(item) {
  if (item.table === "stories") return `${item.payload.name}\n${item.payload.summary}`;
  return `${item.payload.title}\n${item.payload.content}`;
}

async function main() {
  console.log(`\n=== HOLD 익명화 반영 (${APPLY ? "APPLY" : "DRY-RUN"}) ===\n`);

  const plan = [];
  for (const item of ITEMS) {
    const exists = await existsBy(item.table, item.key.column, item.key.value);
    plan.push({ item, exists });
    console.log(`  [${exists ? "SKIP(존재)" : "INSERT 예정"}] ${item.table} | ${item.key.value}`);
  }
  console.log("");

  if (!APPLY) {
    console.log("DRY-RUN 종료. 실제 반영하려면 --apply 를 붙이세요.\n");
    return;
  }
  if (!OPENAI_KEY) {
    console.error("OPENAI_API_KEY 누락 — 임베딩 생성 불가. 반영 중단.");
    process.exit(1);
  }

  console.log("── APPLY 시작 ──");
  let ok = 0, skip = 0, fail = 0;
  for (const { item, exists } of plan) {
    if (exists) { console.log(`  - SKIP(이미 존재): ${item.key.value}`); skip++; continue; }
    try {
      const row = await sbInsert(item.table, item.payload);
      const n = await embedSource(item.embed.type, row.id, item.key.value, embedText(item));
      console.log(`  ✓ ${item.table} 삽입 + 임베딩 ${n} 청크: ${item.key.value}`);
      ok++;
    } catch (e) {
      console.error(`  ✗ 실패 [${item.key.value}]: ${e.message}`);
      fail++;
    }
  }
  console.log(`\nAPPLY 완료: 신규삽입 ${ok} / 스킵 ${skip} / 실패 ${fail}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
