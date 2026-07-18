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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await supabase
  .from('youtube_transcripts')
  .select('id, title, summary, youtube_url, category, is_active')
  .order('created_at', { ascending: true });
if (error) { console.error(JSON.stringify(error)); process.exit(1); }

// CSV backup: id, title, summary(first 200)
function csvCell(v) {
  const s = (v ?? '').toString();
  return '"' + s.replace(/"/g, '""') + '"';
}
const lines = ['id,title,summary_200'];
for (const r of data) {
  lines.push([csvCell(r.id), csvCell(r.title), csvCell((r.summary || '').slice(0, 200))].join(','));
}
fs.mkdirSync('geniea_db_batches', { recursive: true });
fs.writeFileSync('geniea_db_batches/20260702_yt_titles_backup.csv', lines.join('\n') + '\n');

// Full JSON for processing
fs.writeFileSync('.hermes/yt_titles_full.json', JSON.stringify(data, null, 2));
console.log('Backup rows:', data.length);
console.log('Wrote geniea_db_batches/20260702_yt_titles_backup.csv and .hermes/yt_titles_full.json');
