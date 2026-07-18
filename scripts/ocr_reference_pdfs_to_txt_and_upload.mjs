import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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
loadEnv('.env.local'); loadEnv('.env.vercel.prod'); loadEnv('.env.vercel.local');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !process.env.OPENAI_API_KEY) throw new Error('Missing Supabase or OpenAI env');
const supabase = createClient(url, key, { auth: { persistSession: false } });

const args = new Set(process.argv.slice(2));
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const ocrScriptPath = path.join(scriptDir, 'tmp_ocr.swift');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.split('=')[1] : null;
const dryRun = args.has('--dry-run');

const runId = new Date().toISOString().replace(/[:.]/g, '').replace('Z', 'Z');
const outDir = path.resolve('geniea_outputs/reference_ocr_txt', runId);
const tmpDir = path.resolve('.hermes/reference_ocr_tmp', runId);
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });

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
function safeName(name) {
  return name.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]/g, '_');
}
function cleanOcrText(raw) {
  return raw
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/([가-힣])\s+([가-힣])/g, '$1 $2')
    .trim();
}
async function embedding(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 8000) }),
  });
  if (!res.ok) throw new Error(`Embedding failed ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data[0].embedding;
}
async function downloadPdf(file) {
  const target = path.join(tmpDir, `${file.id}.pdf`);
  if (fs.existsSync(target)) return target;
  const { data, error } = await supabase.storage.from('admin-files').download(file.file_path);
  if (error) throw error;
  fs.writeFileSync(target, Buffer.from(await data.arrayBuffer()));
  return target;
}
function pdfPageCount(pdfPath) {
  const r = spawnSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  const m = (r.stdout || '').match(/^Pages:\s+(\d+)/m);
  return m ? Number(m[1]) : null;
}
function renderAndOcr(pdfPath, fileName) {
  const base = path.join(tmpDir, safeName(fileName));
  const render = spawnSync('pdftoppm', ['-r', '180', '-png', pdfPath, base], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 20 });
  if (render.status !== 0) throw new Error(`pdftoppm failed: ${render.stderr || render.stdout}`);
  const images = fs.readdirSync(tmpDir)
    .filter((f) => f.startsWith(path.basename(base) + '-') && f.endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((f) => path.join(tmpDir, f));
  const pageTexts = [];
  for (let i = 0; i < images.length; i++) {
    const ocr = spawnSync('swift', [ocrScriptPath, images[i]], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 20 });
    if (ocr.status !== 0) throw new Error(`Vision OCR failed page ${i + 1}: ${ocr.stderr || ocr.stdout}`);
    pageTexts.push(`\n\n--- page ${i + 1} ---\n${ocr.stdout}`);
    fs.unlinkSync(images[i]);
  }
  return cleanOcrText(pageTexts.join('\n'));
}
async function uploadTxtForPdf(sourceFile, text) {
  const txtName = `${safeName(sourceFile.file_name)}_OCR정리.txt`;
  const txtPath = path.join(outDir, txtName);
  const body = `# ${safeName(sourceFile.file_name)} OCR 정리본\n\n원본 레퍼런스 파일: ${sourceFile.file_name}\n원본 admin_files.id: ${sourceFile.id}\n생성일: ${new Date().toISOString()}\n\n${text}\n`;
  fs.writeFileSync(txtPath, body, 'utf8');

  if (dryRun) return { txtPath, chunks: splitIntoChunks(body).length, newId: null };

  const filePath = `ocr/${Date.now()}_${sourceFile.id}.txt`;
  const { error: storageError } = await supabase.storage.from('admin-files').upload(filePath, Buffer.from(body, 'utf8'), {
    contentType: 'text/plain; charset=utf-8', upsert: false,
  });
  if (storageError) throw storageError;

  const { data: inserted, error: insertError } = await supabase.from('admin_files').insert({
    file_name: txtName,
    file_path: filePath,
    file_type: 'txt',
    file_size: Buffer.byteLength(body, 'utf8'),
    description: body.slice(0, 1000),
    category: sourceFile.category || 'PDF_OCR정리본',
    is_active: true,
  }).select().single();
  if (insertError) throw insertError;

  const chunks = splitIntoChunks(body);
  for (let i = 0; i < chunks.length; i++) {
    const emb = await embedding(chunks[i]);
    const { error } = await supabase.from('document_chunks').insert({
      source_type: 'admin_files',
      source_id: inserted.id,
      source_name: txtName,
      chunk_text: chunks[i],
      embedding: JSON.stringify(emb),
    });
    if (error) throw error;
  }
  return { txtPath, chunks: chunks.length, newId: inserted.id };
}

const { data: files, error } = await supabase.from('admin_files')
  .select('id,file_name,file_path,file_type,file_size,description,category,is_active,created_at')
  .eq('file_type', 'pdf')
  .eq('is_active', false)
  .order('created_at', { ascending: true });
if (error) throw error;
let selected = files ?? [];
if (only) selected = selected.filter((f) => f.file_name.includes(only) || f.id === only);
selected = selected.slice(0, limit);

const summary = [];
for (const file of selected) {
  const targetTxtName = `${safeName(file.file_name)}_OCR정리.txt`;
  const { data: existing, error: existingError } = await supabase
    .from('admin_files')
    .select('id,file_name')
    .eq('file_name', targetTxtName)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    console.log(`[ocr] skip existing ${file.file_name}: ${existing.id}`);
    summary.push({ sourceId: file.id, sourceName: file.file_name, skipped: true, existingId: existing.id });
    continue;
  }

  console.log(`[ocr] start ${file.file_name}`);
  const pdf = await downloadPdf(file);
  const pages = pdfPageCount(pdf);
  const text = renderAndOcr(pdf, file.file_name);
  const uploaded = await uploadTxtForPdf(file, text);
  summary.push({ sourceId: file.id, sourceName: file.file_name, pages, textLength: text.length, ...uploaded });
  console.log(`[ocr] done ${file.file_name}: pages=${pages}, text=${text.length}, chunks=${uploaded.chunks}, newId=${uploaded.newId ?? 'dry-run'}`);
}
fs.writeFileSync(path.join(outDir, 'OCR_UPLOAD_SUMMARY.json'), JSON.stringify({ dryRun, outDir, count: summary.length, summary }, null, 2));
console.log(JSON.stringify({ dryRun, outDir, count: summary.length, summary }, null, 2));
