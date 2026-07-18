// D-3 (2026-07-07): Script DB(admin_blocks) 카테고리를 16개 지플릿 체계로 일괄 변경하는 스크립트 초안.
//
// ⚠️⚠️ 실행 전 승인 필요 — 나연님 승인 없이 실행 금지 (라이브 DB 쓰기 발생) ⚠️⚠️
// ⚠️ 이 파일은 "작성만" 된 초안이다. 2026-07-07 세션에서는 실행하지 않았다.
//
// 입력: geniea_outputs/GENIEA_ScriptDB_카테고리_추천매핑_20260705.md (7/5 추천 매핑표)
//   - "## #N_카테고리 — X건" 섹션의 표(| 기존 카테고리 | 건수 | 신뢰도 |)를 파싱해
//     {기존 카테고리 → 새 16개 카테고리} 매핑을 만든다.
//   - "## ⚠️ 별도 처리"(타 DB 이관 후보 825건)와 "## ❓ 미분류"(판정 필요 888건)는 대상에서 제외.
//   - 신뢰도 "낮음" 줄은 기본 제외 (클라이언트 확인 대상) — 포함하려면 --include-low.
//
// 동작:
//   1) 매핑 대상 카테고리의 라이브 행 전체를 페이지네이션 조회
//   2) 백업 저장: geniea_db_batches/20260707_scriptdb_16categories/ (레포 규칙 6: 라이브 DB 작업 전 백업)
//   3) 매핑표 건수와 라이브 실측 건수를 대조해 리포트 출력 (불일치는 경고)
//   4) 기본 dry-run: 변경 계획(plan.json)만 생성, DB는 건드리지 않음
//   5) 적용: node scripts/apply_scriptdb_16categories_20260707.mjs --apply
//      (마이그레이션이 아니라 category 컬럼 값 UPDATE만 수행 — 스키마 변경 없음)
//
// 되돌리기: 백업 JSON의 {id, category}로 역UPDATE 가능 (--rollback <백업파일> 은 미구현, 필요 시 추가)

import fs from 'node:fs';
import path from 'node:path';
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
const INCLUDE_LOW = process.argv.includes('--include-low');
const MAPPING_MD = 'geniea_outputs/GENIEA_ScriptDB_카테고리_추천매핑_20260705.md';
const OUT_DIR = 'geniea_db_batches/20260707_scriptdb_16categories';

// 클라이언트 확정 16개 체계 (2026-07-07 작업목록 D-3) — 매핑표 섹션명 검증용
const CONFIRMED_16 = [
  '#1_꿈과목표', '#2_결심&결단', '#3_명단정리', '#4_초대도우미', '#5_실전미팅(STP)',
  '#6_후속가이드', '#7_상담', '#8_복제', '#9_건강상담', '#10_제품추천(견적)',
  '#11_제품정보', '#12_제품·사업스토리', '#13_마이스토리', '#14_FAQ', '#15_공통이해도구', '#16_운영',
];

// ── 1) 매핑표 파싱 ──────────────────────────────────────────────
function parseMappingTable(mdPath) {
  const text = fs.readFileSync(mdPath, 'utf8');
  const lines = text.split(/\r?\n/);
  const mapping = []; // { oldCategory, newCategory, expectedCount, confidence }
  let currentTarget = null;

  for (const line of lines) {
    const section = line.match(/^## (#\d+_[^—]+?)\s+—\s+/);
    if (section) {
      currentTarget = section[1].trim();
      if (!CONFIRMED_16.includes(currentTarget)) {
        console.error(`매핑표 섹션 "${currentTarget}" 이(가) 확정 16개 체계에 없음 — 파일/체계 버전 확인 필요`);
        process.exit(1);
      }
      continue;
    }
    // 별도 처리 / 미분류 섹션 진입 시 매핑 수집 종료
    if (/^## (⚠️|❓)/.test(line)) { currentTarget = null; continue; }
    if (!currentTarget) continue;

    const cells = line.split('|').map((s) => s.trim());
    // 표 행: | 기존 카테고리 | 건수 | 신뢰도 |  → split 결과 ['', old, count, conf, '']
    if (cells.length < 5 || cells[1] === '기존 카테고리' || /^-+$/.test(cells[1].replace(/\s/g, ''))) continue;
    const expectedCount = parseInt(cells[2], 10);
    if (!Number.isFinite(expectedCount)) continue;
    mapping.push({ oldCategory: cells[1], newCategory: currentTarget, expectedCount, confidence: cells[3] });
  }
  return mapping;
}

// ── 2) 라이브 조회 (1,000행 한도 페이지네이션) ──────────────────
async function fetchRowsByCategory(category) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('admin_blocks')
      .select('id, title, category')
      .eq('category', category)
      .order('created_at', { ascending: true })
      .range(offset, offset + 999);
    if (error) { console.error('조회 실패:', category, JSON.stringify(error)); process.exit(1); }
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

const allMapping = parseMappingTable(MAPPING_MD);
const mapping = allMapping.filter((m) => {
  if (m.oldCategory === m.newCategory) return false; // 이미 목표 카테고리인 행은 변경 불필요
  if (!INCLUDE_LOW && m.confidence === '낮음') return false;
  return true;
});
const skippedLow = allMapping.filter((m) => m.confidence === '낮음').length;
console.log(`매핑표 파싱: 전체 ${allMapping.length}개 카테고리 / 적용 대상 ${mapping.length}개` +
  (INCLUDE_LOW ? ' (신뢰도 낮음 포함)' : ` (신뢰도 낮음 ${skippedLow}개 제외 — 포함하려면 --include-low)`));

// 중복 매핑(같은 기존 카테고리가 두 섹션에 등장) 방어
const seen = new Map();
for (const m of mapping) {
  if (seen.has(m.oldCategory) && seen.get(m.oldCategory) !== m.newCategory) {
    console.error(`기존 카테고리 "${m.oldCategory}" 가 두 목적지(${seen.get(m.oldCategory)} / ${m.newCategory})에 중복 매핑됨 — 매핑표 수정 필요`);
    process.exit(1);
  }
  seen.set(m.oldCategory, m.newCategory);
}

// ── 3) 라이브 실측 + 백업 + 계획 ────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const backup = [];
const plan = [];
let mismatch = 0;

for (const m of mapping) {
  const rows = await fetchRowsByCategory(m.oldCategory);
  if (rows.length !== m.expectedCount) {
    mismatch++;
    console.warn(`건수 불일치: "${m.oldCategory}" 매핑표 ${m.expectedCount}건 vs 라이브 ${rows.length}건 (7/5 이후 증감 가능 — 라이브 기준으로 진행)`);
  }
  backup.push(...rows);
  if (rows.length > 0) plan.push({ oldCategory: m.oldCategory, newCategory: m.newCategory, liveCount: rows.length, ids: rows.map((r) => r.id) });
}

fs.writeFileSync(path.join(OUT_DIR, `backup_admin_blocks_categories_${stamp}.json`), JSON.stringify(backup, null, 2));
fs.writeFileSync(path.join(OUT_DIR, `plan_${stamp}.json`), JSON.stringify(plan, null, 2));

const totalRows = plan.reduce((s, p) => s + p.liveCount, 0);
console.log(`백업 ${backup.length}행 저장 → ${OUT_DIR}/`);
console.log(`변경 계획: ${plan.length}개 카테고리, 총 ${totalRows}행 (건수 불일치 ${mismatch}건)`);

if (!APPLY) {
  console.log('dry-run 완료 (DB 미변경). plan_*.json 검토 + 나연님 승인 후 --apply 로 실행하세요.');
  process.exit(0);
}

// ── 4) 적용 (카테고리 단위 UPDATE) ──────────────────────────────
console.log('⚠️ --apply 모드: 라이브 admin_blocks.category UPDATE 시작');
let ok = 0, fail = 0;
for (const p of plan) {
  const { error, count } = await supabase
    .from('admin_blocks')
    .update({ category: p.newCategory }, { count: 'exact' })
    .eq('category', p.oldCategory);
  if (error) { fail++; console.error('실패:', p.oldCategory, '→', p.newCategory, JSON.stringify(error)); }
  else { ok++; console.log(`OK: "${p.oldCategory}" → "${p.newCategory}" (${count ?? p.liveCount}행)`); }
}
console.log(`적용 완료: 카테고리 성공 ${ok} / 실패 ${fail}. 검증: 관리자 화면에서 16개 카테고리 분포 확인 + 백업 JSON 보관.`);
