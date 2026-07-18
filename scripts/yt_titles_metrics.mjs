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
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const len = (s) => [...(s || '')].length;
const MARK = /#|구독자|좋아요|[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

// old titles come from the pre-update JSON snapshot (authoritative)
const oldRows = JSON.parse(fs.readFileSync('.hermes/yt_titles_full.json', 'utf8'));
const oldMap = new Map(oldRows.map(r => [r.id, r.title]));

const { data } = await sb.from('youtube_transcripts').select('id,title');

let obOver30 = 0, obOver40 = 0, obMark = 0, nbOver30 = 0, nbOver40 = 0, nbMark = 0, maxNew = 0, mismatch = 0;
const gen = JSON.parse(fs.readFileSync('.hermes/yt_titles_generated.json', 'utf8'));
const genMap = new Map(gen.map(x => [x.id, x.new]));
for (const r of data) {
  const o = oldMap.get(r.id) || '';
  if (len(o) > 30) obOver30++;
  if (len(o) >= 40) obOver40++;
  if (MARK.test(o)) obMark++;
  if (len(r.title) > 30) nbOver30++;
  if (len(r.title) >= 40) nbOver40++;
  if (MARK.test(r.title)) nbMark++;
  if (len(r.title) > maxNew) maxNew = len(r.title);
  if (genMap.get(r.id) !== r.title) mismatch++;
}
console.log('rows in DB:', data.length);
console.log('BEFORE  >30chars:', obOver30, ' >=40chars:', obOver40, ' markers:', obMark);
console.log('AFTER   >30chars:', nbOver30, ' >=40chars:', nbOver40, ' markers:', nbMark);
console.log('AFTER max title length:', maxNew);
console.log('DB vs intended mismatch:', mismatch);
