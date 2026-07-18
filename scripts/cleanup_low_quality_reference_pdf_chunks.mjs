import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || line.trim().startsWith('#')) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}

loadEnv('.env.local');
loadEnv('.env.vercel.prod');
loadEnv('.env.vercel.local');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(url, key, { auth: { persistSession: false } });
const dryRun = process.argv.includes('--dry-run');
const now = new Date().toISOString().replace(/[:.]/g, '').replace('T', 'T').replace('Z', 'Z');
const backupDir = path.resolve('geniea_outputs/db_backups', `reference_pdf_noise_cleanup_${now}`);

const SUSPICIOUS_RE = /[簇純瞬嘗昌虧圍翩隘媚唇樺澍嗽嘲琮]|[☜■□▣◇▷▶●○⊃㈜㉵ⓒ]|[ÃÂ�]/g;
const OCR_RE = /\b히고\b|히셨|깁자기|갑직|기cl|돌o|괴시|건깅|질봔|딩뇨/g;

function count(text, re) {
  return String(text ?? '').match(re)?.length ?? 0;
}

function quality(text) {
  const s = String(text ?? '');
  const suspicious = count(s, SUSPICIOUS_RE);
  const ocr = count(s, OCR_RE);
  const ratio = s.length ? suspicious / s.length : 0;
  return { length: s.length, suspicious, ocr, suspiciousRatio: ratio, bad: ratio > 0.005 || ocr >= 1 };
}

async function allRows(queryFactory, pageSize = 1000) {
  const out = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryFactory().range(from, from + pageSize - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

const files = await allRows(() => supabase
  .from('admin_files')
  .select('id,file_name,file_path,file_type,file_size,description,category,is_active,created_at')
  .eq('file_type', 'pdf')
  .order('created_at', { ascending: false })
);

const chunks = await allRows(() => supabase
  .from('document_chunks')
  .select('id,source_type,source_id,source_name,chunk_text,metadata,created_at')
  .eq('source_type', 'admin_files')
);

const chunksBySource = new Map();
for (const chunk of chunks) {
  if (!chunksBySource.has(chunk.source_id)) chunksBySource.set(chunk.source_id, []);
  chunksBySource.get(chunk.source_id).push(chunk);
}

const affected = [];
for (const file of files) {
  const fileChunks = chunksBySource.get(file.id) ?? [];
  const descQ = quality(file.description);
  const badChunkCount = fileChunks.filter((c) => quality(c.chunk_text).bad).length;
  if (descQ.bad || badChunkCount > 0) {
    affected.push({ file, chunks: fileChunks, descQ, badChunkCount });
  }
}

const affectedIds = affected.map((a) => a.file.id);
const affectedChunks = affected.flatMap((a) => a.chunks);

fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(path.join(backupDir, 'affected_admin_files.json'), JSON.stringify(affected.map((a) => a.file), null, 2));
fs.writeFileSync(path.join(backupDir, 'affected_document_chunks.json'), JSON.stringify(affectedChunks, null, 2));
fs.writeFileSync(path.join(backupDir, 'summary.json'), JSON.stringify({
  dryRun,
  pdfFiles: files.length,
  affectedFiles: affected.length,
  affectedChunkRows: affectedChunks.length,
  affected: affected.map((a) => ({
    id: a.file.id,
    file_name: a.file.file_name,
    active: a.file.is_active,
    chunks: a.chunks.length,
    badChunkCount: a.badChunkCount,
    descQ: a.descQ,
  })),
}, null, 2));

if (!dryRun && affectedIds.length > 0) {
  const newDescription = '[자동 추출 보류] 기존 PDF 자동 추출 텍스트의 OCR/폰트 매핑 품질이 낮아 RAG 검색에서 제외했습니다. 원본 PDF는 보관 중이며, 정제 TXT/OCR본으로 재업로드 후 재활성화가 필요합니다.';

  for (const id of affectedIds) {
    const { error } = await supabase
      .from('admin_files')
      .update({ is_active: false, description: newDescription })
      .eq('id', id);
    if (error) throw error;
  }

  for (let i = 0; i < affectedIds.length; i += 50) {
    const batch = affectedIds.slice(i, i + 50);
    const { error } = await supabase
      .from('document_chunks')
      .delete()
      .eq('source_type', 'admin_files')
      .in('source_id', batch);
    if (error) throw error;
  }
}

console.log(JSON.stringify({
  dryRun,
  backupDir,
  pdfFiles: files.length,
  affectedFiles: affected.length,
  affectedChunkRows: affectedChunks.length,
  changed: !dryRun,
}, null, 2));
