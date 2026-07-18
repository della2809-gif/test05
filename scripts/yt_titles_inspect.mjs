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

const { data, error, count } = await supabase
  .from('youtube_transcripts')
  .select('*', { count: 'exact' })
  .limit(3);
if (error) { console.error(JSON.stringify(error)); process.exit(1); }
console.log('COUNT:', count);
console.log('COLUMNS:', Object.keys(data[0] || {}));
for (const row of data) {
  console.log('---');
  console.log('id:', row.id);
  console.log('title:', row.title);
  console.log('summary(200):', (row.summary || '').slice(0, 200));
}
