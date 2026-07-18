import fs from 'node:fs';
const full = JSON.parse(fs.readFileSync('.hermes/yt_titles_full.json', 'utf8'));
const gen = JSON.parse(fs.readFileSync('.hermes/yt_titles_generated.json', 'utf8'));
const byId = new Map(full.map(r => [r.id, r]));

// For each story title, take the token left of " · " (the claimed identity) and any
// notable nouns, check presence in source (title + full summary/transcript).
function norm(s){return (s||'').replace(/\s+/g,'');}
let flags = 0;
gen.forEach((x, i) => {
  if (x.skipped || !x.changed) return;
  const src = byId.get(x.id);
  const source = norm((src.title||'') + ' ' + (src.summary||''));
  const left = (x.new.includes(' · ') ? x.new.split(' · ')[0] : x.new).trim();
  // check the identity token (drop trailing 특성 words)
  const idToken = left.replace(/(엄마|아빠|워킹맘|육아맘|주부|환자|리본맘|경단녀)/g,'').trim();
  const candidates = [left, idToken].filter(t => t && t.length >= 2);
  const found = candidates.some(t => source.includes(norm(t)));
  if (!found) {
    flags++;
    console.log(`#${i+1} [${x.type}] NEW: ${x.new}`);
    console.log(`     left-token "${left}" NOT found verbatim in source`);
    console.log(`     summary head: ${(src.summary||'(none)').slice(0,220).replace(/\n/g,' ')}`);
    console.log('');
  }
});
console.log(`Flagged (identity token not verbatim in source): ${flags}`);
