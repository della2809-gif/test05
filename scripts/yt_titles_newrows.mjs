import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
function loadEnv(fp){ if(!fs.existsSync(fp))return; for(const line of fs.readFileSync(fp,'utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);if(!m||line.trim().startsWith('#'))continue;let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!(m[1] in process.env))process.env[m[1]]=v;}}
loadEnv('.env.local');
const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const oldIds=new Set(JSON.parse(fs.readFileSync('.hermes/yt_titles_full.json','utf8')).map(r=>r.id));
const { data } = await sb.from('youtube_transcripts').select('id,title,created_at,updated_at').order('created_at',{ascending:true});
console.log('total now:', data.length);
for(const r of data){ if(!oldIds.has(r.id)){ console.log('NEW ROW:', r.id, '| created:', r.created_at, '| title:', r.title); } }
