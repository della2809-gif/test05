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
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const gen = JSON.parse(fs.readFileSync('.hermes/yt_titles_generated.json', 'utf8'));
const toUpdate = gen.filter(x => x.changed && !x.skipped && x.new && x.new !== x.old);
const dryRun = process.argv.includes('--dry-run');
console.log(`${dryRun ? '[DRY RUN] ' : ''}Updating ${toUpdate.length} rows...`);

let ok = 0, fail = 0;
for (const x of toUpdate) {
  if (dryRun) { ok++; continue; }
  const { error } = await supabase.from('youtube_transcripts').update({ title: x.new }).eq('id', x.id);
  if (error) { fail++; console.error(`FAIL ${x.id}: ${error.message}`); }
  else ok++;
}
console.log(`Done. success=${ok} fail=${fail}`);
