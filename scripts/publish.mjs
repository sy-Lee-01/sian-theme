// 볼트의 me/ 에서 publish: true 인 것만 골라 src/content 와 public/media 로 동기화한다.
// 원칙: 허용 목록 방식. 검사를 모두 통과해야만 쓴다. git은 건드리지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml, stringify as toYaml } from 'yaml';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = {
  writing: path.join(ROOT, 'src/content/writing'),
  records: path.join(ROOT, 'src/content/records'),
  about: path.join(ROOT, 'src/content/about.md'),
  media: path.join(ROOT, 'src/content/media'),
};
const sections = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/sections.json'), 'utf8'));
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

// ---------- 볼트 위치 ----------
const envFile = path.join(ROOT, '.env.local');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const VAULT = process.env.VAULT_PATH;
if (!VAULT) exit('.env.local에 VAULT_PATH가 없습니다. .env.example을 참고하세요.');
const ME = path.join(VAULT, 'me');
if (!fs.existsSync(ME)) exit(`볼트에서 me/ 폴더를 찾을 수 없습니다: ${ME}`);
const ASSETS = path.join(ME, 'assets');
const RECORDS = path.join(ME, 'records');

// ---------- 공통 도구 ----------
function exit(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

function readNote(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw, offset: 0 };
  let data = {};
  try {
    data = parseYaml(m[1]) ?? {};
  } catch (e) {
    fail(rel(file), `frontmatter를 읽을 수 없습니다 (${e.message.split('\n')[0]})`);
  }
  // 본문이 파일의 몇 번째 줄부터인지 (오류 메시지용)
  const offset = raw.slice(0, raw.length - m[2].length).split('\n').length - 1;
  return { data, body: m[2], offset };
}

// Obsidian 주석 %% ... %% 은 비공개. 여러 줄이어도 통째로 제거한다 (줄 번호는 유지).
const stripComments = (text) => text.replace(/%%[\s\S]*?%%/g, (m) => m.replace(/[^\n]/g, ''));
const rel = (file) => path.relative(VAULT, file);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    if (d.name.startsWith('.')) return [];
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
}

// ---------- 1. 글 노트 ----------
const docFiles = walk(ME).filter(
  (f) =>
    f.endsWith('.md') &&
    !f.startsWith(RECORDS + path.sep) &&
    !f.startsWith(ASSETS + path.sep) &&
    f !== path.join(ME, 'about.md'),
);

const docs = [];
for (const file of docFiles) {
  const { data, body } = readNote(file);
  if (data.publish !== true) continue; // 허용 목록: 명시적으로 true인 것만
  const name = rel(file);
  const { kind, slug, title, date } = data;
  if (!sections[kind]) fail(name, `kind "${kind}"는 없는 섹션입니다 (가능: ${Object.keys(sections).join(', ')})`);
  if (typeof slug !== 'string' || !SLUG.test(slug)) fail(name, `slug "${slug ?? ''}"는 소문자·숫자·하이픈만 쓸 수 있습니다`);
  if (typeof title !== 'string' || !title.trim()) fail(name, 'title이 비어 있습니다');
  if (!date || isNaN(new Date(date))) fail(name, `date "${date ?? ''}"를 날짜로 읽을 수 없습니다`);
  docs.push({ file, name, kind, slug, title, date: String(date instanceof Date ? date.toISOString().slice(0, 10) : date), body });
}

const seen = new Map();
for (const d of docs) {
  if (seen.has(d.slug)) fail(d.name, `slug "${d.slug}"가 ${seen.get(d.slug)}와 겹칩니다`);
  else seen.set(d.slug, d.name);
}

// 노트 이름 → 공개 주소 (Obsidian처럼 대소문자 무시)
const published = new Map(
  docs.map((d) => [path.basename(d.file, '.md').toLowerCase(), `${sections[d.kind]?.path}/${d.slug}/`]),
);
const assetFiles = walk(ASSETS);
const media = new Map(); // 원본 경로 → 사이트 경로

function useImage(target, from, imgDir) {
  const base = path.basename(decodeURIComponent(target.split('|')[0].trim()));
  const found = assetFiles.find((f) => path.basename(f) === base);
  if (!found) {
    fail(from, `이미지 "${base}"가 me/assets/에 없습니다 (assets 밖의 파일은 공개하지 않습니다)`);
    return '';
  }
  const url = `${imgDir}${encodeURIComponent(base)}`;
  media.set(found, base);
  return url;
}

// 본문 속 링크와 이미지는 상대 경로로 쓴다. 그래야 github.io 하위 경로에서도,
// 도메인을 연결한 뒤에도 그대로 동작한다.
//   up: 이 페이지 주소에서 사이트 루트까지 (글 '../../', 홈 '')
//   imgDir: 이 파일에서 src/content/media 까지 (Astro가 이미지를 최적화해 준다)
function transform(body, from, up, imgDir) {
  let text = stripComments(body);
  // ![[image.png]] 임베드
  text = text.replace(/!\[\[([^\]]+)\]\]/g, (_, target) => {
    if (IMAGE.test(target.split('|')[0].trim())) return `![](${useImage(target, from, imgDir)})`;
    return ''; // 노트 임베드는 공개하지 않음
  });
  // ![alt](assets/x.png) 형태의 마크다운 이미지
  text = text.replace(/!\[([^\]]*)\]\((?!https?:)([^)]+)\)/g, (_, alt, target) => `![${alt}](${useImage(target, from, imgDir)})`);
  // [[노트]], [[노트|별칭]], [[노트#제목]]
  text = text.replace(/\[\[([^\]]+)\]\]/g, (_, inner) => {
    const [target, alias] = inner.split('|');
    const note = target.split('#')[0].trim();
    const label = (alias ?? note).trim();
    const url = published.get(path.basename(note).toLowerCase());
    return url ? `[${label}](${up}${url})` : label; // 비공개 노트는 평문으로
  });
  return text.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

const writingOut = new Map();
for (const d of docs) {
  const fm = toYaml({ kind: d.kind, title: d.title, date: d.date }).trim();
  writingOut.set(`${d.slug}.md`, `---\n${fm}\n---\n${transform(d.body, d.name, '../../', '../media/')}`);
}

// ---------- 2. about ----------
let aboutOut = '';
const aboutFile = path.join(ME, 'about.md');
if (fs.existsSync(aboutFile)) {
  const { data, body } = readNote(aboutFile);
  if (data.publish === true) aboutOut = transform(body, 'me/about.md', '', './media/');
}

// ---------- 3. 레코드 ----------
function readRecord(name, expected) {
  const file = path.join(RECORDS, `${name}.md`);
  if (!fs.existsSync(file)) return [];
  const { data, body, offset } = readNote(file);
  if (data.publish !== true) return [];
  if (data.record !== expected) fail(rel(file), `record는 "${expected}"여야 합니다`);
  return stripComments(body)
    .split('\n')
    .map((line, i) => ({ line: line.trim(), at: `${rel(file)} ${offset + i + 1}번째 줄` }))
    .filter((l) => l.line);
}

const LINK_AT_END = /\s*\[[^\]]*\]\((\S+)\)$/;

const publications = [];
for (const { line, at } of readRecord('publications', 'publications')) {
  const m = line.match(/^- \[(.+?)\]\((\S+?)\) — (.+) · (.+)$/);
  if (!m) {
    fail(at, `형식이 맞지 않습니다. 예: - [Title](https://...) — One-line description. · CHI 2026`);
    continue;
  }
  publications.push({ id: `pub-${publications.length + 1}`, title: m[1], link: m[2], description: m[3], venue: m[4] });
}

const activities = [];
let section = null;
for (const { line, at } of readRecord('activities', 'activities')) {
  const h = line.match(/^##\s+(.+)$/);
  if (h) {
    section = h[1].trim();
    continue;
  }
  const m = line.match(/^- (.+?) · (.+)$/);
  if (!m || !section) {
    fail(at, section ? '형식이 맞지 않습니다. 예: - 2025 · Role, Org — One-line description. [link](https://...)' : '항목 위에 ## 섹션 제목이 필요합니다');
    continue;
  }
  let rest = m[2];
  let link;
  const lm = rest.match(LINK_AT_END);
  if (lm) {
    link = lm[1];
    rest = rest.slice(0, lm.index).trim();
  }
  const [text, ...desc] = rest.split(' — ');
  activities.push({
    id: `act-${activities.length + 1}`,
    section,
    period: m[1],
    text: text.trim(),
    ...(desc.length ? { description: desc.join(' — ').trim() } : {}),
    ...(link ? { link } : {}),
  });
}

// ---------- 검사 결과 ----------
if (errors.length) {
  console.error(`\n✗ 공개하지 않았습니다. 고칠 곳 ${errors.length}개:\n`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error('');
  process.exit(1);
}

// ---------- 쓰기 (동기화) ----------
const before = snapshot();

fs.rmSync(OUT.writing, { recursive: true, force: true });
fs.rmSync(OUT.media, { recursive: true, force: true });
fs.mkdirSync(OUT.writing, { recursive: true });
fs.mkdirSync(OUT.records, { recursive: true });
for (const [name, content] of writingOut) fs.writeFileSync(path.join(OUT.writing, name), content);
fs.writeFileSync(path.join(OUT.records, 'publications.yml'), publications.length ? toYaml(publications) : '[]\n');
fs.writeFileSync(path.join(OUT.records, 'activities.yml'), activities.length ? toYaml(activities) : '[]\n');
fs.writeFileSync(OUT.about, aboutOut);
if (media.size) {
  fs.mkdirSync(OUT.media, { recursive: true });
  for (const [src, name] of media) fs.copyFileSync(src, path.join(OUT.media, name));
}

const after = snapshot();
report(before, after);

function snapshot() {
  const files = [
    ...walk(OUT.writing),
    ...walk(OUT.records),
    ...walk(OUT.media),
    ...(fs.existsSync(OUT.about) ? [OUT.about] : []),
  ];
  return new Map(files.map((f) => [path.relative(ROOT, f), fs.readFileSync(f).toString('base64')]));
}

function report(a, b) {
  const added = [...b.keys()].filter((k) => !a.has(k));
  const removed = [...a.keys()].filter((k) => !b.has(k));
  const changed = [...b.keys()].filter((k) => a.has(k) && a.get(k) !== b.get(k));
  console.log(`\n✓ 글 ${docs.length}개, 논문 ${publications.length}개, 활동 ${activities.length}개, 이미지 ${media.size}개\n`);
  if (!added.length && !removed.length && !changed.length) return console.log('  바뀐 것 없음\n');
  for (const f of added) console.log(`  + ${f}`);
  for (const f of changed) console.log(`  ~ ${f}`);
  for (const f of removed) console.log(`  - ${f}`);
  console.log('\n  git diff로 확인한 뒤 직접 커밋하세요.\n');
}
