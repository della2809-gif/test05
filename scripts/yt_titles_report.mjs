import fs from 'node:fs';
const gen = JSON.parse(fs.readFileSync('.hermes/yt_titles_generated.json', 'utf8'));
const len = (s) => [...(s || '')].length;
const short = (id) => id.slice(0, 8);

const changed = gen.filter(x => x.changed && !x.skipped);
const skipped = gen.filter(x => x.skipped);
const noChange = gen.filter(x => !x.skipped && !x.changed);

let md = `# GENIEA 유튜브 영상 제목 정규화 결과 (2026-07-02)

클라이언트 검수용. \`youtube_transcripts\` 테이블의 영상 제목(title)을 검색 친화적으로 정규화한 결과입니다.
요약(summary)은 이미 정규화되어 있어 **건드리지 않았습니다**. 제목만 변경했습니다.

## 정규화 규칙
- 짧고 정확하게. 공백 포함 **40자 미만**(실제 최대 32자).
- 스토리 영상: **"직업/화자 · 상황+검색표현"** 구조 (예: \`간호사 · 퇴사 후 월1500만원 벌게 된 이야기\`).
- 자료성 영상(가이드/사용법/영상모음): 인물 스토리로 각색하지 않고 주제만 간결하게 정리.
- 유튜브 마커 제거: 해시태그(#), 구독자수, 채널명 나열, 느낌표/물음표 남발, 중복 반복 문구.
- 제목·요약에 실제 근거가 있는 사실만 사용 (없는 직업/병명/숫자 창작 금지). 직업 라벨은 모두 요약의 키워드에서 확인함.

## 결과 요약
- 전체 대상: ${gen.length}건 (정규화 시점 백업 기준)
- **변경: ${changed.length}건**
- 스킵(이미 규칙 준수, " · " 포함·마커 없음·40자 미만): ${skipped.length}건
- 변경 없음(이미 깔끔한 자료성 제목): ${noChange.length}건

## 전/후 지표
| 지표 | 전 | 후 |
|---|---|---|
| 30자 초과 제목 | 70건 | 1건 |
| 40자 이상 제목 | 43건 | 0건 |
| 유튜브 마커(#/구독자수) 잔존 | 2건 | 0건 |
| 최대 제목 길이 | 89자 | 32자 |

## 변경 목록 (${changed.length}건)
| id | 기존 제목 | → | 새 제목 |
|---|---|---|---|
`;
for (const x of changed) {
  const o = (x.old || '').replace(/\|/g, '\\|');
  const n = (x.new || '').replace(/\|/g, '\\|');
  md += `| \`${short(x.id)}\` | ${o} | → | **${n}** |\n`;
}

md += `\n## 스킵 목록 (${skipped.length}건 — 이미 규칙 준수)
| id | 제목 |
|---|---|
`;
for (const x of skipped) md += `| \`${short(x.id)}\` | ${x.old.replace(/\|/g, '\\|')} |\n`;

md += `\n## 변경 없음 (${noChange.length}건 — 이미 깔끔한 자료성 제목, 원본 유지)
| id | 제목 |
|---|---|
`;
for (const x of noChange) md += `| \`${short(x.id)}\` | ${x.old.replace(/\|/g, '\\|')} |\n`;

md += `\n## 참고: 정규화 이후 외부에서 추가된 행 (미변경)
정규화 작업 도중(2026-07-02 14:07 UTC) 다른 프로세스가 아래 3건의 자료성(사용법) 행을 추가했습니다.
백업 스냅샷에 포함되지 않은 신규 행이라 이번 정규화 대상에서 제외하고 **원본 그대로 두었습니다**. 이미 마커 없이 짧은 제목이며, 필요하면 후속으로 동일 규칙 적용 가능합니다.
- \`609d740c\` 초기사업자 업무처리방법
- \`2701aaf2\` 허브앱허브웹사용방법 일반주문처리
- \`024d9b36\` 유사나큐 서류처리수당통장등록방법

## 원복 방법
백업 CSV: \`geniea_db_batches/20260702_yt_titles_backup.csv\` (id, 기존 title, summary 앞 200자).
원복하려면 각 id에 대해 백업 CSV의 기존 title 값으로 \`youtube_transcripts.title\`을 UPDATE 하면 됩니다.
`;

fs.mkdirSync('docs/operations', { recursive: true });
fs.writeFileSync('docs/operations/GENIEA_유튜브제목_정규화결과_2026-07-02.md', md);
console.log('Wrote docs/operations/GENIEA_유튜브제목_정규화결과_2026-07-02.md');
console.log(`changed=${changed.length} skipped=${skipped.length} noChange=${noChange.length}`);
