// C-1 (2026-07-07): admin_blocks 본문에 섞여 있는 "사용상황/검색키워드/태그" 표기를 파싱해
// 신설 컬럼(usage_context / keywords / tags)으로 이관하는 스크립트.
//
// ⚠️ 실행 전 승인 필요 — 나연님 승인 없이 실행 금지 (dry-run 포함해 라이브 DB 조회가 발생함)
// ⚠️ 실행 전 제약
//   - 마이그레이션 20260707000000_admin_blocks_add_search_fields.sql 이 라이브에 적용된 후에만 --apply 가능
//   - 기본은 dry-run: 백업 + 제안 목록만 생성하고 DB는 건드리지 않는다
//   - 적용: node scripts/parse_blocks_usage_keywords_20260707.mjs --apply
//
// 파싱 대상 표기 (라이브 샘플 조사 결과, 2026-07-07):
//   - 대괄호 섹션: [사용상황] / [WPHR/검색키워드] / [검색키워드] / [키워드] / [태그]
//     (값은 다음 [섹션] 또는 빈 줄 전까지, 줄바꿈은 쉼표로 합침)
//   - 한 줄 라벨: "사용 상황: ...", "검색 키워드: ...", "출력주의태그: ...", "핵심태그: ..."
//     (해당 줄만 취함 — [메모] 안 멀티라인 값은 과추출 위험이 있어 보수적으로 한 줄만)
//   - 이미 컬럼에 값이 있는 행은 건너뜀 (덮어쓰지 않음)

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || line.trim().startsWith('#')) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}
loadEnv('.env.local');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) { console.error('환경변수(NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) 누락'); process.exit(1); }
const supabase = createClient(url, key, { auth: { persistSession: false } });

const APPLY = process.argv.includes('--apply');
const OUT_DIR = 'geniea_db_batches/20260707_blocks_search_fields';

// [라벨] 섹션 값 추출: 다음 [섹션] 시작 또는 빈 줄 2개 전까지. 줄바꿈 값은 쉼표로 합침.
function parseBracketSection(content, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    const re = new RegExp(`\\[${escaped}\\]\\s*\\n([\\s\\S]*?)(?=\\n\\s*\\[|\\n\\s*\\n|$)`);
    const m = content.match(re);
    if (m) {
      const value = m[1].split(/\n/).map((s) => s.trim()).filter(Boolean).join(', ');
      if (value) return value;
    }
  }
  return null;
}

// "라벨: 값" 한 줄 추출 (보수적 — 그 줄만)
function parseLineLabel(content, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    const m = content.match(new RegExp(`^\\s*${escaped}\\s*[:：]\\s*(.+)$`, 'm'));
    if (m && m[1].trim()) return m[1].trim();
  }
  return null;
}

function parseBlock(content) {
  const usage = parseBracketSection(content, ['사용상황', '사용 상황'])
    ?? parseLineLabel(content, ['사용 상황', '사용상황']);
  const keywords = parseBracketSection(content, ['WPHR/검색키워드', '검색키워드', '검색 키워드', '키워드'])
    ?? parseLineLabel(content, ['검색 키워드', '검색키워드']);
  const tags = parseBracketSection(content, ['태그'])
    ?? parseLineLabel(content, ['출력주의태그', '핵심태그', '태그']);
  return { usage, keywords, tags };
}

// 전체 행 페이지네이션 조회 (1,000행 한도)
async function fetchAll() {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('admin_blocks')
      .select('id, title, content, usage_context, keywords, tags')
      .order('created_at', { ascending: true })
      .range(offset, offset + 999);
    if (error) { console.error(JSON.stringify(error)); process.exit(1); }
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

const rows = await fetchAll();
console.log('admin_blocks 전체:', rows.length, '행');

fs.mkdirSync(OUT_DIR, { recursive: true });
// 백업 (규칙 6: 라이브 DB 작업 전 백업)
fs.writeFileSync(`${OUT_DIR}/backup_admin_blocks_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(rows, null, 2));

const proposals = [];
for (const r of rows) {
  const { usage, keywords, tags } = parseBlock(r.content ?? '');
  const update = {};
  if (usage && !r.usage_context) update.usage_context = usage.slice(0, 500);
  if (keywords && !r.keywords) update.keywords = keywords.slice(0, 500);
  if (tags && !r.tags) update.tags = tags.slice(0, 300);
  if (Object.keys(update).length > 0) proposals.push({ id: r.id, title: r.title, update });
}

fs.writeFileSync(`${OUT_DIR}/proposed_updates.json`, JSON.stringify(proposals, null, 2));
console.log('이관 제안:', proposals.length, '행 →', `${OUT_DIR}/proposed_updates.json`);

if (!APPLY) {
  console.log('dry-run 완료 (DB 미변경). 적용하려면 --apply 를 붙이세요.');
  process.exit(0);
}

let ok = 0, fail = 0;
for (const p of proposals) {
  const { error } = await supabase.from('admin_blocks').update(p.update).eq('id', p.id);
  if (error) { fail++; console.error('실패:', p.id, p.title, JSON.stringify(error)); }
  else ok++;
}
console.log(`적용 완료: 성공 ${ok} / 실패 ${fail}`);
