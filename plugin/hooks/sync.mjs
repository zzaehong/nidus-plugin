#!/usr/bin/env node
// Office bookkeeping in code instead of prompt rules:
// - board.md and 00.dashboard.md are generated from report.md / project.md / outputs frontmatter (never hand-written),
// - frontmatter values of the file just written are checked (exit 2 tells the model what to fix),
// - checked [x] lines older than 7 days are dropped from inbox.md and desk.md (`sync.mjs cleanup <office>`, session start),
// - capacity(): how many workers/leads to run at once from system/usage.json (office skill, "사용량").
// Hook events: PostToolUse (Write|Edit|Bash), Stop, SubagentStop. Never blocks except a bad frontmatter value.
import { readFileSync, writeFileSync, renameSync, readdirSync, statSync, existsSync, rmSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');
export const stamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const read = (f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };
const ls = (d) => { try { return readdirSync(d).sort(); } catch { return []; } };
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

export function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const fm = {};
  if (m) for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return fm;
}
// .html outputs can't carry frontmatter: <meta name="review|summary|updated" content="..."> and <title>.
function htmlMeta(text) {
  const fm = {};
  for (const m of text.matchAll(/<meta\s+name="(review|summary|updated|title)"\s+content="([^"]*)"/gi)) fm[m[1]] = m[2];
  fm.title ??= /<title>([^<]*)<\/title>/i.exec(text)?.[1];
  return fm;
}
const heading = (text) => /^# (.+)$/m.exec(text)?.[1]?.trim();

// ---- values -----------------------------------------------------------------------------------------------------
const ENUMS = {
  task: { status: ['접수', '진행', '검토', '완료', '막힘', '취소'], priority: ['지금', '빠른 일', '예약', '나중'] },
  project: { status: ['계획', '진행', '막힘', '완료', '취소'], priority: ['지금', '예약', '나중'] },
  output: { review: ['대기', '확인'] },
};
export function kindOf(rel) {
  if (/^tasks\/[^/]+\/[^/]+\/report\.md$/.test(rel)) return 'task';
  if (/^projects\/[^/]+\/project\.md$/.test(rel)) return 'project';
  if (/^outputs\/.+\.md$/.test(rel)) return 'output';
  return null;
}
export function validate(rel, text) {
  const kind = kindOf(rel);
  if (!kind) return null;
  const fm = frontmatter(text), bad = [];
  const closed = ['완료', '취소'].includes(fm.status); // tasks closed before 0.4.0 have no priority
  for (const [k, allowed] of Object.entries(ENUMS[kind]))
    if (!allowed.includes(fm[k] ?? '') && !(k === 'priority' && closed)) bad.push(`${k}: ${fm[k] || '(없음)'} → ${allowed.join(' | ')} 중 하나`);
  if (kind === 'task' && fm.due && !/^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(fm.due)) bad.push(`due: ${fm.due} → YYYY-MM-DD HH:MM 또는 비움`);
  return bad.length ? `nidus office: ${rel} frontmatter 값이 틀렸다. 고쳐라: ${bad.join('; ')}` : null;
}

// ---- capacity ---------------------------------------------------------------------------------------------------
// The office skill's table. "unknown" when the status line hasn't written for 30 min.
export function capacity(u, now = Date.now()) {
  const fresh = u?.updated && now - Date.parse(u.updated) <= 30 * 60000;
  const h = fresh ? u.five_hour?.used : undefined, w = fresh ? u.seven_day?.used : undefined;
  if (h >= 80 || w >= 85) return { workers: 1, leads: 1, note: '급하지 않은 일은 초기화 뒤에' };
  if (h == null || w == null || h >= 50 || w >= 70) return { workers: 2, leads: 1, note: h == null || w == null ? '사용량 모름' : '' };
  return { workers: 4, leads: 2, note: '' };
}

// ---- collect ----------------------------------------------------------------------------------------------------
function tasks(office) {
  const out = [];
  for (const month of ls(join(office, 'tasks'))) for (const id of ls(join(office, 'tasks', month))) {
    const path = `tasks/${month}/${id}/report.md`, text = read(join(office, path));
    if (!text) continue;
    out.push({ id, path, fm: frontmatter(text), title: heading(text) ?? id, mtime: statSync(join(office, path)).mtimeMs });
  }
  return out;
}
function projects(office) {
  const out = [];
  for (const id of ls(join(office, 'projects'))) {
    const path = `projects/${id}/project.md`, text = read(join(office, path));
    if (!text) continue;
    // Phases table: | # | phase | 팀 | Goal | Exit Condition | 사용자 확인 | 상태 | 보고 |
    const rows = text.split('\n').filter((l) => /^\|\s*\d+\s*\|/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
    const now = rows.find((r) => /진행|검토/.test(r[6] ?? '')) ?? rows.find((r) => /대기/.test(r[6] ?? ''));
    out.push({ id, path, fm: frontmatter(text), title: heading(text) ?? id, phase: now ? `${now[0]}. ${now[1]} (${now[6]})` : '', team: now?.[2] ?? '' });
  }
  return out;
}
function outputs(office) {
  const out = [];
  const walk = (dir) => {
    for (const name of ls(join(office, dir))) {
      const rel = `${dir}/${name}`, abs = join(office, rel), st = statSync(abs);
      if (st.isDirectory()) { walk(rel); continue; }
      if (!/\.(md|html)$/.test(name)) continue;
      const text = read(abs), fm = name.endsWith('.html') ? htmlMeta(text) : frontmatter(text);
      if (!fm.review) continue;
      out.push({ path: rel, fm, title: fm.title || heading(text) || name.replace(/\.\w+$/, ''), mtime: st.mtimeMs });
    }
  };
  walk('outputs');
  for (const name of ls(join(office, 'wiki'))) if (name.endsWith('.md')) {
    const text = read(join(office, 'wiki', name)), fm = frontmatter(text);
    if (fm.review) out.push({ path: `wiki/${name}`, fm, title: fm.title || heading(text) || name, mtime: statSync(join(office, 'wiki', name)).mtimeMs });
  }
  return out.sort((a, b) => (b.fm.updated ?? '').localeCompare(a.fm.updated ?? '') || b.mtime - a.mtime);
}
function jobs(office) {
  return read(join(office, 'jobs.md')).split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*-/.test(l)).slice(1)
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim())).filter((r) => r[0]);
}
const usageOf = (office) => { try { return JSON.parse(read(join(office, 'system/usage.json'))); } catch { return null; } };
const runningCount = (office) => ls(join(office, 'system/running')).length;

// ---- render -----------------------------------------------------------------------------------------------------
const link = (t) => `[${t.id}](${t.path})${t.fm.summary || t.title !== t.id ? ` — ${cell(t.fm.summary || t.title)}` : ''}`;
const team = (t) => cell((t.fm.team ?? '').replace(/^teams\//, ''));
const open = (t) => !['완료', '취소'].includes(t.fm.status) && !t.fm.project;
const PRI = ['지금', '빠른 일', '예약', '나중'];
function usageLine(u, now) {
  const at = (r) => { const d = new Date(r); return Number.isNaN(d.getTime()) ? '' : `(${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())} 초기화)`; };
  const p = (x) => (x ? `${x.used}%${at(x.resets_at)}` : '모름');
  const c = capacity(u, now);
  return `5시간 ${p(u?.five_hour)} · 7일 ${p(u?.seven_day)} · 동시에: 워커 ${c.workers}, lead ${c.leads}${c.note ? ` (${c.note})` : ''}`;
}

export function renderBoard(office, now = Date.now()) {
  const ts = tasks(office).filter(open), u = usageOf(office);
  const L = ['# Task Board', `갱신 ${stamp(new Date(now))} · 돌고 있는 lead·워커 ${runningCount(office)} · ${usageLine(u, now)}`,
    '', '> 자동 생성된다(plugin/hooks/sync.mjs). 고치려면 각 report.md·project.md의 frontmatter를 고친다.', ''];
  for (const p of PRI) {
    const due = p === '예약';
    L.push(`## ${p}`, `| task | 팀 | 상태 | ${due ? '시작 예정(due)' : '접수'} | 다음 할 일 |`, '|---|---|---|---|---|');
    for (const t of ts.filter((t) => t.fm.priority === p && t.fm.status !== '막힘').sort((a, b) => (due ? (a.fm.due ?? '').localeCompare(b.fm.due ?? '') : 0) || a.id.localeCompare(b.id)))
      L.push(`| ${link(t)} | ${team(t)} | ${t.fm.status} | ${cell(due ? t.fm.due : t.fm.created)} | ${cell(t.fm.next)} |`);
    L.push('');
  }
  L.push('## 막힘 (사용자 답 대기)', '| task | 팀 | 기다리는 것 | 물어본 시각 |', '|---|---|---|---|');
  for (const t of ts.filter((t) => t.fm.status === '막힘'))
    L.push(`| ${link(t)} | ${team(t)} | ${cell(t.fm.waiting || t.fm.next)} | ${cell(t.fm.asked || stamp(new Date(t.mtime)))} |`);
  L.push('', '## 프로젝트', '| 프로젝트 | 상태 | 지금 phase | 팀 | 다음 할 일 |', '|---|---|---|---|---|');
  for (const p of projects(office).filter((p) => !['완료', '취소'].includes(p.fm.status)))
    L.push(`| [${cell(p.title)}](${p.path}) | ${p.fm.status} | ${cell(p.phase)} | ${cell(p.team)} | ${cell(p.fm.next)} |`);
  return L.join('\n') + '\n';
}

export function renderDashboard(office, now = Date.now()) {
  const all = tasks(office), prs = projects(office), outs = outputs(office), u = usageOf(office);
  const item = (o) => `- [${cell(o.title)}](${o.path})${o.fm.summary ? ` — ${cell(o.fm.summary)}` : ''}`;
  const L = ['# Nidus 대시보드', '', '> 자동 생성된다(plugin/hooks/sync.mjs). 요약 줄은 각 파일 frontmatter의 `summary`에서 온다.', ''];
  const list = (title, rows) => L.push(`## ${title}`, ...(rows.length ? rows : ['- 없음']), '');
  list('검토 대기', outs.filter((o) => o.fm.review === '대기').map(item));
  list('확인 완료', outs.filter((o) => o.fm.review === '확인').map(item));
  list('막힘·미달', [...all.filter((t) => t.fm.status === '막힘').map((t) => `- ${link(t)}${t.fm.waiting ? ` (기다리는 것: ${cell(t.fm.waiting)})` : ''}`),
    ...prs.filter((p) => p.fm.status === '막힘').map((p) => `- [${cell(p.title)}](${p.path}) — 프로젝트 막힘`)]);
  const ts = all.filter(open), n = (p) => ts.filter((t) => t.fm.priority === p && t.fm.status !== '막힘').length;
  const running = prs.filter((p) => p.fm.status === '진행');
  L.push('## Task Board', `- [board.md](board.md) — ${PRI.map((p) => `${p} ${n(p)}`).join(' · ')} · 막힘 ${ts.filter((t) => t.fm.status === '막힘').length}`);
  for (const t of ts.filter((t) => t.fm.priority === '지금' && t.fm.status !== '막힘')) L.push(`  - 지금: ${link(t)}`);
  L.push(`- 진행 중인 프로젝트: ${running.length ? running.map((p) => `[${cell(p.title)}](${p.path}) ${cell(p.phase)}`).join(', ') : '없음'}`, '');
  const since = stamp(new Date(now - 7 * DAY)).slice(0, 10);
  list('최근 완료 (7일)', all.filter((t) => t.fm.status === '완료' && (t.fm.created || t.id.slice(0, 10)) >= since)
    .sort((a, b) => b.id.localeCompare(a.id)).map((t) => `- ${link(t)}`));
  // 주기 up to its first comma (drops cron syntax and msg refs), then the instruction's first clause.
  const brief = (s, n) => { const t = cell(s).split(/[.,](?:\s|$)/)[0].trim(); return t.length > n ? t.slice(0, n) + '…' : t; };
  list('반복 작업', jobs(office).map((r) => `- [${cell(r[0])}](jobs.md) — ${brief(r[1], 30)} ${brief(r[2], 40)}${r[4] ? `. 결과: ${r[4]}` : ''}`));
  L.push('## 사용량', `- ${usageLine(u, now)} · 돌고 있는 lead·워커 ${runningCount(office)}`, '');
  L.push('---', `갱신: ${stamp(new Date(now))} · [watchdog 기록](system/events.md)`);
  return L.join('\n') + '\n';
}

// Write only when something besides the time stamp changed, so Obsidian and git don't churn every tool call.
const body = (s) => s.replace(/^갱신[: ].*$/gm, '');
function put(file, text) {
  if (body(read(file)) === body(text)) return;
  writeFileSync(`${file}.${process.pid}.tmp`, text); // parallel hooks: one temp file each
  renameSync(`${file}.${process.pid}.tmp`, file);
}
export function sync(office, now = Date.now()) {
  put(join(office, 'board.md'), renderBoard(office, now));
  put(join(office, '00.dashboard.md'), renderDashboard(office, now));
}

export function cleanup(office, now = Date.now()) {
  const cut = stamp(new Date(now - 7 * DAY)).slice(0, 10);
  for (const id of ls(join(office, 'system/inbox-seen')))
    try { if (statSync(join(office, 'system/inbox-seen', id)).mtimeMs < now - 8 * DAY) rmSync(join(office, 'system/inbox-seen', id)); } catch {}
  for (const f of ['system/inbox.md', 'desk.md']) {
    const file = join(office, f), text = read(file);
    if (!text) continue;
    const kept = text.split('\n').filter((l) => !(/^- \[x\] (\d{4}-\d\d-\d\d)/.exec(l)?.[1] < cut));
    if (kept.length !== text.split('\n').length) put(file, kept.join('\n'));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[2] === 'cleanup') { try { cleanup(process.argv[3]); } catch {} process.exit(0); }
  let raw = '', input = {};
  for await (const c of process.stdin) raw += c;
  try { input = JSON.parse(raw || '{}'); } catch {}
  const office = process.env.NIDUS_OFFICE;
  if (process.env.NIDUS_GUARD !== '1' || !office || !existsSync(office)) process.exit(0);
  let problem = null;
  try {
    const f = input.tool_input?.file_path;
    if (f && ['Write', 'Edit'].includes(input.tool_name)) {
      const rel = relative(office, f).split(sep).join('/');
      if (!rel.startsWith('..')) problem = validate(rel, read(f));
    }
  } catch {}
  try { sync(office); } catch {} // a broken generator must never stop the session
  if (problem) { console.error(problem); process.exit(2); }
}
