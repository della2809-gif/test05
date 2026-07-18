import fs from 'node:fs';

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
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');

const rows = JSON.parse(fs.readFileSync('.hermes/yt_titles_full.json', 'utf8'));

// --- helpers ---
const len = (s) => [...(s || '')].join('').length; // code-point length
const MARKER_RE = /#|구독자|구독\s|좋아요|[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;
function hasMarker(s) { return MARKER_RE.test(s || ''); }
// narrow skip per task: no marker AND <40 chars AND contains " · "
function isAlreadyCompliant(title) {
  return !hasMarker(title) && len(title) < 40 && (title || '').includes(' · ');
}

const SYSTEM = `너는 유튜브 영상 제목을 검색 친화적으로 정규화하는 한국어 편집자다.
입력의 [기존제목]과 [요약]만 근거로 '새 제목' 하나를 만든다.

반드시 JSON만 출력: {"title":"새 제목","type":"story|guide"}

[공통 규칙]
1. 한국어. 공백 포함 40자 미만, 가능하면 30자 이하로 짧게.
2. 유튜브 마커 완전 제거: 해시태그(#...), 채널명 나열, 구독자수("구독자 1.27만명" 등), 느낌표/물음표 남발, 이모지, 그리고 같은 문장이 두 번 반복된 중복 문구는 한 번만 남긴다.
3. [기존제목]과 [요약]에 실제로 나오는 사실만 사용한다. 없는 직업·병명·숫자·지역·회사명을 새로 지어내지 않는다.
4. 핵심 검색어(직업, 상황, 주제 키워드)는 유지한다.

[유형 판별]
- [요약]의 "세부"가 체험스토리/사업·성공스토리/책리뷰 이거나 특정 인물의 경험담이면 type="story".
- [요약]이 비어 있거나, 제품교육/가이드/사용법/영상모음/재생목록/계산기 등 자료성이면 type="guide".

[story 규칙]
- 형식: "직업 또는 화자특성 · 상황+검색표현".
- 예시: "간호사 · 육아맘이 부업으로 권리소득을 만든 이야기", "약사 · 제약회사 직장인 부업 이야기", "당뇨 환자 · 10kg 감량 성공기".
- 왼쪽은 화자의 직업/정체성, 오른쪽은 핵심 상황·변화·주제. 직업/상황은 [요약]의 영상주제·주요키워드에서 취한다.
- 직업이 불명확하면 왼쪽을 상황(예: "암 환자", "워킹맘")으로 대체 가능. 억지로 직업을 지어내지 않는다.

[guide 규칙]
- 인물/스토리로 각색하지 않는다. 자료의 주제만 간결히.
- 이미 짧고 마커가 없으면 [기존제목]을 거의 그대로 두고 군더더기만 정리한다.`;

async function generate(row) {
  const summary = (row.summary || '').slice(0, 1000);
  const user = `[기존제목]\n${row.title}\n\n[요약]\n${summary || '(없음)'}`;
  const body = {
    model: 'gpt-4o-mini',
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: user },
    ],
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        if (res.status === 429 || res.status >= 500) { await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); continue; }
        throw new Error(`OpenAI ${res.status}: ${txt}`);
      }
      const json = await res.json();
      const content = json.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      let title = (parsed.title || '').trim();
      // safety trims
      title = title.replace(/\s+/g, ' ').replace(/^["'“”]+|["'“”]+$/g, '').trim();
      return { title, type: parsed.type || '' };
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
    }
  }
}

// concurrency pool
async function run() {
  const results = [];
  const queue = rows.map((r, i) => ({ r, i }));
  const CONC = 6;
  let done = 0;
  async function worker() {
    while (queue.length) {
      const { r } = queue.shift();
      if (isAlreadyCompliant(r.title)) {
        results.push({ id: r.id, old: r.title, new: r.title, type: 'skip', skipped: true, changed: false });
      } else {
        const g = await generate(r);
        const changed = g.title && g.title !== r.title;
        results.push({ id: r.id, old: r.title, new: g.title, type: g.type, skipped: false, changed });
      }
      done++;
      if (done % 10 === 0) process.stderr.write(`  ...${done}/${rows.length}\n`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  // preserve original order
  const byId = new Map(results.map(x => [x.id, x]));
  const ordered = rows.map(r => byId.get(r.id));
  fs.writeFileSync('.hermes/yt_titles_generated.json', JSON.stringify(ordered, null, 2));

  const changed = ordered.filter(x => x.changed).length;
  const skipped = ordered.filter(x => x.skipped).length;
  const noop = ordered.filter(x => !x.skipped && !x.changed).length;
  const over40 = ordered.filter(x => len(x.new) >= 40).length;
  const markerLeft = ordered.filter(x => hasMarker(x.new)).length;
  console.log(`total=${ordered.length} changed=${changed} skipped=${skipped} noChange=${noop}`);
  console.log(`new titles >=40 chars: ${over40}, new titles with marker: ${markerLeft}`);
}
run();
