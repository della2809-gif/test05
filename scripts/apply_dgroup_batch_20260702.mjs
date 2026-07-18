#!/usr/bin/env node
/**
 * apply_dgroup_batch_20260702.mjs
 *
 * D그룹(geniea_db_batches/20260630) DB 반영 대기분을 멱등하게 반영한다.
 *
 * 기본 동작: DRY-RUN (아무것도 쓰지 않고, 삽입 예정 목록만 출력).
 * 실제 반영: `--apply` 플래그를 붙였을 때만 INSERT + 임베딩 생성.
 *
 * 멱등성: 각 후보를 고유키(youtube=video_id, admin_blocks=title,
 *          faqs=question, stories=name/summary)로 운영 DB와 대조하여
 *          이미 존재하면 skip. 재실행해도 중복 삽입되지 않는다.
 *
 * 상태 분류:
 *   - insert  : 상태 '업로드가능' & DB유형이 보류/제외 아님 & 미존재
 *   - skip    : 이미 운영 DB에 존재
 *   - hold    : 상태 '확인필요' / '수정필요' (담당자 확인 전 자동반영 안 함)
 *   - exclude : DB유형 '보류/제외' 또는 상태 '제외'/'보류'
 *
 * 사용법:
 *   node scripts/apply_dgroup_batch_20260702.mjs            # dry-run
 *   node scripts/apply_dgroup_batch_20260702.mjs --apply    # 실제 반영
 *   node scripts/apply_dgroup_batch_20260702.mjs --include-review --apply  # hold 항목까지 반영
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BATCH_DIR = join(ROOT, "geniea_db_batches", "20260630");

const APPLY = process.argv.includes("--apply");
const INCLUDE_REVIEW = process.argv.includes("--include-review");

// ---------------------------------------------------------------------------
// env 로드 (.env.local)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// CSV 파서 (RFC4180, BOM/따옴표/개행 처리)
// ---------------------------------------------------------------------------
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\r") { /* skip */ }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  // 헤더 -> 객체 배열
  const header = rows.shift().map((h) => h.trim());
  return rows
    .filter((r) => r.some((v) => v && v.trim()))
    .map((r) => Object.fromEntries(header.map((h, idx) => [h, (r[idx] ?? "").trim()])));
}

function readCsv(name) {
  return parseCsv(readFileSync(join(BATCH_DIR, name), "utf8"));
}

// ---------------------------------------------------------------------------
// Supabase REST 헬퍼
// ---------------------------------------------------------------------------
async function sbSelect(table, column, op, value, selectCols = column) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set("select", selectCols);
  url.searchParams.set(column, `${op}.${value}`);
  const res = await fetch(url, { headers: SB_HEADERS });
  if (!res.ok) throw new Error(`select ${table} ${res.status}: ${await res.text()}`);
  return res.json();
}
async function existsBy(table, column, value) {
  // eq 매칭 (특수문자 안전하게 encode)
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set("select", column);
  url.searchParams.set(column, `eq.${value}`);
  const res = await fetch(url, { headers: SB_HEADERS });
  if (!res.ok) throw new Error(`exists ${table} ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  return rows.length > 0;
}
async function sbInsert(table, payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...SB_HEADERS, Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`insert ${table} ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  return rows[0];
}

// ---------------------------------------------------------------------------
// 임베딩 (admin 파이프라인 재현: 800/100 청크, text-embedding-3-small)
// ---------------------------------------------------------------------------
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
  const data = await res.json();
  return data.data[0].embedding;
}
async function embedSource(sourceType, sourceId, sourceName, text) {
  const chunks = splitIntoChunks(text);
  let inserted = 0;
  for (const chunk of chunks) {
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
// URL -> youtube video_id / playlist id
// ---------------------------------------------------------------------------
function extractYoutubeId(url) {
  if (!url) return null;
  const pl = url.match(/[?&]list=([A-Za-z0-9_-]+)/);
  if (/playlist\?/.test(url) && pl) return `/playlist?list=${pl[1]}`;
  const m =
    url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/) ||
    url.match(/[?&]v=([A-Za-z0-9_-]{6,})/) ||
    url.match(/embed\/([A-Za-z0-9_-]{6,})/);
  if (m) return m[1];
  if (pl) return `/playlist?list=${pl[1]}`;
  return null;
}
function splitTags(s) {
  if (!s) return [];
  return s.split(/[,\n]/).map((t) => t.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// 후보 빌드
// ---------------------------------------------------------------------------
const STATUS_EXCLUDE = new Set(["제외", "보류", "보류제외"]);
const STATUS_REVIEW = new Set(["확인필요", "수정필요", "표현순화"]);

// DB유형 -> 대상 테이블
function mapType(dbType) {
  const t = dbType.trim();
  if (t === "FAQ") return "faqs";
  if (t === "Story") return "stories";
  if (t === "유튜브/링크") return "links";
  if (t === "보류/제외") return null; // exclude
  // Script, 파트너 교육 규칙, GenieA 답변 기준, 비유/공통 이해도구, 제품/패키지, Reference
  return "admin_blocks";
}

function buildAdminBlockContent(r) {
  const q = r["사용자질문예시"] || r["질문예시"] || "";
  const say = r["실제말버전"] || r["말버전"] || "";
  const lines = [];
  if (r["사용상황"]) lines.push(`[사용 상황] ${r["사용상황"]}`);
  if (q) lines.push(`[질문 예시] ${q}`);
  if (r["핵심판단"]) lines.push(`[핵심 판단] ${r["핵심판단"]}`);
  if (r["답변방향"]) lines.push(`[답변 방향] ${r["답변방향"]}`);
  if (say) lines.push(`[말버전] ${say}`);
  if (r["주의표현"]) lines.push(`[주의] ${r["주의표현"]}`);
  return lines.join("\n");
}

async function buildCandidates() {
  const cands = [];

  // 1) YouTube CSV
  const yt = readCsv("초기사업자_업무처리방법_유튜브_링크DB_후보_20260630.csv");
  for (const r of yt) {
    const vid = extractYoutubeId(r["URL"]);
    const status = (r["요청상태"] || "").trim();
    cands.push({
      src: "youtube_csv",
      table: "youtube_transcripts",
      dbType: r["자료유형"] || "유튜브",
      title: r["자료명"],
      status,
      key: { column: "video_id", value: vid },
      payload: {
        title: r["자료명"],
        youtube_url: r["URL"],
        video_id: vid,
        summary: r["사용상황"] || null,
        tags: splitTags(r["검색키워드"]),
        category: "초기사업자_업무처리방법",
        is_active: true,
      },
      embed: { type: "youtube", text: `${r["자료명"]}\n${r["사용상황"] || ""}` },
    });
  }

  // 2) 코칭 CSV 2종 (동일 스키마 계열)
  const coaching = [
    "키리더_줌미팅_보상기트_운영_20260623_DB후보.csv",
    "키리더_줌미팅_기트_후속_가이드_20260630_DB후보.csv",
  ];
  for (const file of coaching) {
    const rows = readCsv(file);
    for (const r of rows) {
      const dbType = (r["DB유형"] || "").trim();
      const table = mapType(dbType);
      const status = (r["추천상태"] || "").trim();
      const title = r["자료명"];
      const say = r["실제말버전"] || r["말버전"] || "";
      if (!table) {
        cands.push({ src: file, table: null, dbType, title, status, exclude: true });
        continue;
      }
      let payload, key, embed;
      if (table === "faqs") {
        payload = {
          question: title,
          answer: say,
          category: "기트/후속관리",
          tags: splitTags(r["검색키워드"]),
          is_active: true,
        };
        key = { column: "question", value: title };
        embed = { type: "faq", text: `${title}\n${say}` };
      } else if (table === "stories") {
        payload = {
          name: title,
          summary: say || title,
          category: "business",
          tags: splitTags(r["검색키워드"]),
          is_active: true,
        };
        key = { column: "name", value: title };
        embed = { type: "story", text: `${title}\n${say}` };
      } else if (table === "links") {
        payload = {
          title,
          url: r["URL"] || "",
          description: r["사용상황"] || null,
          category: "초대멘트/프로모션",
          tags: splitTags(r["검색키워드"]),
          is_active: true,
        };
        key = { column: "title", value: title };
        embed = { type: "link", text: `${title}\n${r["사용상황"] || ""}` };
      } else {
        // admin_blocks
        const content = buildAdminBlockContent(r);
        payload = {
          title,
          category: `D그룹_${dbType}`,
          content,
        };
        key = { column: "title", value: title };
        embed = { type: "admin_block", text: `${title}\n${content}` };
      }
      cands.push({ src: file, table, dbType, title, status, key, payload, embed });
    }
  }
  return cands;
}

// ---------------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------------
function classify(c) {
  if (c.exclude || c.table === null) return "exclude";
  if (STATUS_EXCLUDE.has(c.status)) return "exclude";
  if (STATUS_REVIEW.has(c.status) && !INCLUDE_REVIEW) return "hold";
  return "insert"; // 업로드가능 등
}

async function main() {
  console.log(`\n=== D그룹 배치 반영 (${APPLY ? "APPLY" : "DRY-RUN"}${INCLUDE_REVIEW ? " +review" : ""}) ===`);
  console.log(`배치 폴더: ${BATCH_DIR}\n`);

  const cands = await buildCandidates();

  const buckets = { insert: [], skip: [], hold: [], exclude: [] };

  for (const c of cands) {
    let bucket = classify(c);
    if (bucket === "insert" || (bucket === "hold" && INCLUDE_REVIEW)) {
      // 존재 여부 대조
      let exists = false;
      try {
        exists = await existsBy(c.table, c.key.column, c.key.value);
      } catch (e) {
        console.error(`  존재확인 실패 [${c.title}]: ${e.message}`);
      }
      if (exists) { c.exists = true; bucket = "skip"; }
    }
    buckets[bucket].push(c);
  }

  // 요약 출력
  const byTable = {};
  for (const c of buckets.insert) {
    byTable[c.table] = (byTable[c.table] || 0) + 1;
  }
  console.log("── 카테고리별 삽입 예정(insert) ──");
  if (buckets.insert.length === 0) console.log("  (없음 — 모두 기존 존재 또는 hold/exclude)");
  for (const [t, n] of Object.entries(byTable)) console.log(`  ${t}: ${n}건`);
  console.log("");
  console.log(`총계: insert ${buckets.insert.length} / skip(기존존재) ${buckets.skip.length} / hold ${buckets.hold.length} / exclude ${buckets.exclude.length}\n`);

  const line = (c, tag) =>
    `  [${tag}] ${c.table ?? "-"} | ${c.dbType} | ${c.status || "-"} | ${c.title}`;

  if (buckets.insert.length) {
    console.log("── INSERT 예정 상세 ──");
    for (const c of buckets.insert) console.log(line(c, "INSERT"));
    console.log("");
  }
  if (buckets.skip.length) {
    console.log("── SKIP (이미 운영 DB 존재) ──");
    for (const c of buckets.skip) console.log(line(c, "SKIP"));
    console.log("");
  }
  if (buckets.hold.length) {
    console.log("── HOLD (확인필요/수정필요 — 담당자 승인 후 --include-review) ──");
    for (const c of buckets.hold) console.log(line(c, "HOLD"));
    console.log("");
  }
  if (buckets.exclude.length) {
    console.log("── EXCLUDE (보류/제외) ──");
    for (const c of buckets.exclude) console.log(line(c, "EXCL"));
    console.log("");
  }

  if (!APPLY) {
    console.log("DRY-RUN 종료. 실제 반영하려면 --apply 를 붙이세요.\n");
    return;
  }

  // --------------------- APPLY ---------------------
  if (!OPENAI_KEY) {
    console.error("OPENAI_API_KEY 누락 — 임베딩 생성 불가. 반영 중단.");
    process.exit(1);
  }
  console.log("── APPLY 시작 ──");
  let ok = 0, fail = 0;
  for (const c of buckets.insert) {
    try {
      const row = await sbInsert(c.table, c.payload);
      const chunks = await embedSource(c.embed.type, row.id, c.title, c.embed.text);
      console.log(`  ✓ ${c.table} 삽입 + 임베딩 ${chunks} 청크: ${c.title}`);
      ok++;
    } catch (e) {
      console.error(`  ✗ 실패 [${c.title}]: ${e.message}`);
      fail++;
    }
  }
  console.log(`\nAPPLY 완료: 성공 ${ok} / 실패 ${fail}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
