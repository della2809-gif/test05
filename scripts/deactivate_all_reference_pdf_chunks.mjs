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
loadEnv('.env.local'); loadEnv('.env.vercel.prod'); loadEnv('.env.vercel.local');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const now = new Date().toISOString().replace(/[:.]/g, '').replace('Z', 'Z');
const backupDir = path.resolve('geniea_outputs/db_backups', `reference_pdf_full_deactivation_${now}`);
fs.mkdirSync(backupDir, { recursive: true });

async function allRows(queryFactory, pageSize=1000){ const out=[]; for(let from=0;;from+=pageSize){ const {data,error}=await queryFactory().range(from, from+pageSize-1); if(error) throw error; out.push(...(data??[])); if(!data || data.length<pageSize) break;} return out; }
const pdfFiles = await allRows(() => supabase.from('admin_files').select('*').eq('file_type','pdf').order('created_at', {ascending:false}));
const ids = pdfFiles.map(f=>f.id);
const pdfChunks = ids.length ? await allRows(() => supabase.from('document_chunks').select('*').eq('source_type','admin_files').in('source_id', ids)) : [];
fs.writeFileSync(path.join(backupDir, 'pdf_admin_files_before.json'), JSON.stringify(pdfFiles, null, 2));
fs.writeFileSync(path.join(backupDir, 'pdf_document_chunks_before.json'), JSON.stringify(pdfChunks, null, 2));
fs.writeFileSync(path.join(backupDir, 'summary.json'), JSON.stringify({ pdfFiles: pdfFiles.length, activePdfFiles: pdfFiles.filter(f=>f.is_active).length, pdfChunks: pdfChunks.length }, null, 2));

const newDescription = '[자동 추출 보류] PDF 자동 추출 텍스트는 한글 OCR/폰트 매핑 오류 가능성이 있어 RAG 검색에서 제외했습니다. 원본 PDF는 보관 중이며, 정제 TXT/OCR본 업로드 후 재활성화가 필요합니다.';
for (const id of ids) {
  const { error } = await supabase.from('admin_files').update({ is_active: false, description: newDescription }).eq('id', id);
  if (error) throw error;
}
for (let i=0;i<ids.length;i+=50) {
  const batch=ids.slice(i,i+50);
  const { error } = await supabase.from('document_chunks').delete().eq('source_type','admin_files').in('source_id', batch);
  if (error) throw error;
}
console.log(JSON.stringify({ backupDir, pdfFiles: pdfFiles.length, previouslyActivePdfFiles: pdfFiles.filter(f=>f.is_active).length, deletedPdfChunks: pdfChunks.length }, null, 2));
