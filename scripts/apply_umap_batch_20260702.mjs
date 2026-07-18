/**
 * apply_umap_batch_20260702.mjs
 *
 * 유맵(U-MAP) 강의 스크립트 .txt 47개를 레퍼런스 DB(admin_files + document_chunks)에 반영한다.
 * 운영 앱의 관리자 파일 업로드 경로(src/app/api/admin/files/route.ts POST)를 그대로 재현한다.
 *   1) admin-files 스토리지 버킷에 ASCII-safe 경로로 업로드
 *   2) admin_files 행 삽입 (is_active 기본 true → 레퍼런스 RAG 검색 포함)
 *   3) 800자/100자 overlap 청크 분할
 *   4) text-embedding-3-small 임베딩(입력 8000자 컷) 생성
 *   5) document_chunks 삽입 (source_type="admin_files", source_name=원본 파일명)
 *
 * 기본은 DRY-RUN(삽입 예정만 출력). 실제 삽입은 --apply 플래그가 있을 때만.
 * 멱등: admin_files.file_name(원본 .txt 파일명)이 이미 있으면 건너뛴다.
 *
 * 사용:
 *   node scripts/apply_umap_batch_20260702.mjs             # dry-run
 *   node scripts/apply_umap_batch_20260702.mjs --apply     # 실제 반영
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// ── env 로드 (.env.local → .env.vercel.prod → .env.vercel.local) ──
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
loadEnv('.env.vercel.prod');
loadEnv('.env.vercel.local');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !process.env.OPENAI_API_KEY) throw new Error('Missing Supabase or OpenAI env');
const supabase = createClient(url, key, { auth: { persistSession: false } });

const APPLY = process.argv.includes('--apply');
const INPUT_DIR = path.resolve('geniea_db_batches/20260702_umap');
const BUCKET = 'admin-files';

// ── 운영 route.ts와 동일한 청크 파라미터 ──
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;
function splitIntoChunks(text) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, Math.min(start + CHUNK_SIZE, text.length)));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
    if (start >= text.length) break;
  }
  return chunks;
}

// ── 운영 lib/rag.ts createEmbedding과 동일 ──
async function createEmbedding(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 8000) }),
  });
  if (!res.ok) throw new Error(`Embedding API 실패 ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

// ── 파일명 → 커리큘럼 카테고리 (클라이언트 그룹 구성 반영) ──
function categoryFor(fileName) {
  const n = fileName.replace(/\.txt$/i, '');
  if (n.startsWith('복제프로그램')) return '유맵강의_복제프로그램';
  if (n.startsWith('보상플랜')) return '유맵강의_보상플랜';
  if (n.startsWith('툴_')) return '유맵강의_툴';
  if (n.startsWith('회사_')) return '유맵강의_회사';
  if (n.startsWith('성공의8단계')) return '유맵강의_성공의8단계';
  if (n.startsWith('step1')) return '유맵강의_기초영양STEP1';
  if (n.startsWith('비지니스가이드')) return '유맵강의_비지니스가이드';
  if (n.startsWith('쉽게푸는')) return '유맵강의_쉽게푸는';
  if (n.startsWith('에브리데이')) return '유맵강의_에브리데이';
  return '유맵강의_기타';
}

async function main() {
  const files = fs.readdirSync(INPUT_DIR).filter((f) => f.toLowerCase().endsWith('.txt')).sort();
  console.log(`[umap] mode=${APPLY ? 'APPLY' : 'DRY-RUN'} | input=${INPUT_DIR} | files=${files.length}`);

  const plan = [];
  for (const fileName of files) {
    const content = fs.readFileSync(path.join(INPUT_DIR, fileName), 'utf8');
    const fileSize = Buffer.byteLength(content, 'utf8');
    const category = categoryFor(fileName);
    const chunks = splitIntoChunks(content);

    // 멱등: 동일 file_name 존재 시 skip
    const { data: existing, error: existErr } = await supabase
      .from('admin_files')
      .select('id,file_name')
      .eq('file_name', fileName)
      .maybeSingle();
    if (existErr) throw existErr;

    plan.push({ fileName, category, fileSize, chunkCount: chunks.length, skip: !!existing, existingId: existing?.id ?? null });
  }

  // ── DRY-RUN 출력 ──
  console.log('\n=== 삽입 계획 (파일명 → 카테고리 / 크기 / 청크수 / 상태) ===');
  const byCat = {};
  let totalChunks = 0;
  let toInsert = 0;
  for (const p of plan) {
    (byCat[p.category] = byCat[p.category] || []).push(p);
    if (!p.skip) { totalChunks += p.chunkCount; toInsert++; }
    console.log(`${p.skip ? '[SKIP]' : '[NEW ]'} ${p.fileName}  →  ${p.category}  | ${p.fileSize}B | ${p.chunkCount} chunks`);
  }
  console.log('\n=== 카테고리별 집계 ===');
  for (const [cat, items] of Object.entries(byCat).sort()) {
    console.log(`${cat}: ${items.length}개 파일, ${items.reduce((s, x) => s + x.chunkCount, 0)} chunks`);
  }
  console.log(`\n합계: 파일 ${plan.length}개 | 신규 ${toInsert} | 스킵 ${plan.length - toInsert} | 신규 청크 ${totalChunks} (임베딩 호출 예상 ${totalChunks}회)`);

  if (!APPLY) {
    console.log('\nDRY-RUN 완료. 실제 반영하려면 --apply 를 붙여 실행하세요.');
    return;
  }

  // ── 실제 반영 (route.ts POST 재현) ──
  console.log('\n=== APPLY 시작 ===');
  const results = [];
  for (const p of plan) {
    if (p.skip) { console.log(`[skip] ${p.fileName} (existing ${p.existingId})`); continue; }
    const content = fs.readFileSync(path.join(INPUT_DIR, p.fileName), 'utf8');

    // 1) 스토리지 업로드 (ASCII-safe 유니크 경로)
    const filePath = `${Date.now()}_${results.length}.txt`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, Buffer.from(content, 'utf8'), { contentType: 'text/plain', upsert: false });
    if (upErr) throw new Error(`upload 실패 ${p.fileName}: ${upErr.message}`);

    // 2) admin_files 삽입 (is_active 기본 true)
    const { data: rec, error: insErr } = await supabase
      .from('admin_files')
      .insert({
        file_name: p.fileName,
        file_path: filePath,
        file_type: 'txt',
        file_size: p.fileSize,
        description: content,
        category: p.category,
      })
      .select()
      .single();
    if (insErr) {
      await supabase.storage.from(BUCKET).remove([filePath]);
      throw new Error(`admin_files insert 실패 ${p.fileName}: ${insErr.message}`);
    }

    // 3~5) 청크 분할 + 임베딩 + document_chunks 삽입
    const chunks = splitIntoChunks(content);
    const embeddings = await Promise.all(chunks.map((c) => createEmbedding(c)));
    await Promise.all(chunks.map((chunk, i) =>
      supabase.from('document_chunks').insert({
        source_type: 'admin_files',
        source_id: rec.id,
        source_name: p.fileName,
        chunk_text: chunk,
        embedding: JSON.stringify(embeddings[i]),
      })
    ));
    console.log(`[ok] ${p.fileName} → admin_files=${rec.id}, chunks=${chunks.length}`);
    results.push({ fileName: p.fileName, id: rec.id, chunks: chunks.length });
  }
  console.log(`\n=== APPLY 완료: ${results.length}개 파일 삽입 ===`);
}

main().catch((e) => { console.error(e); process.exit(1); });
