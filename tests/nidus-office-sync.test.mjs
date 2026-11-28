import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { capacity, validate, cleanup, stamp } from '../plugin/hooks/sync.mjs';
import { telegramMessages, handle } from '../plugin/hooks/inbox.mjs';

const sync = new URL('../plugin/hooks/sync.mjs', import.meta.url).pathname;
const mk = () => mkdtempSync(join(tmpdir(), 'nidus-sync-'));
const put = (o, f, s) => { mkdirSync(dirname(join(o, f)), { recursive: true }); writeFileSync(join(o, f), s); };
const fm = (o) => `---\n${Object.entries(o).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n`;
const run = (office, input) => spawnSync('node', [sync], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, NIDUS_GUARD: '1', NIDUS_OFFICE: office } });

test('board and dashboard are generated from frontmatter, only when something changed', () => {
  const o = mk();
  put(o, 'tasks/2026-11/2026-11-28-a/report.md', fm({ status: '진행', priority: '지금', team: 'teams/stock', created: '2026-11-28', summary: 'NVDA 분석', next: 'lead 보고 대기' }) + '# A\n');
  put(o, 'tasks/2026-11/2026-11-28-b/report.md', fm({ status: '막힘', priority: '나중', team: 'teams/dev', waiting: 'A안/B안 답' }) + '# B\n');
  put(o, 'tasks/2026-11/2026-11-27-c/report.md', fm({ status: '완료', created: '2026-11-27', summary: '끝남' }) + '# C\n');
  put(o, 'projects/p1/project.md', fm({ status: '진행', priority: '예약' }) + '# 출시\n## Phases\n| # | phase | 팀 | Goal | Exit | 확인 | 상태 | 보고 |\n|---|---|---|---|---|---|---|---|\n| 1 | 조사 | stock | g | e | | 완료 | |\n| 2 | 구현 | dev | g | e | | 진행 | |\n');
  put(o, 'outputs/stock/NVDA.md', fm({ updated: '2026-11-28', review: '대기', summary: '중립' }) + '# NVDA\n');
  put(o, 'outputs/p/plan.html', '<html><head><title>설계도</title><meta name="review" content="확인"><meta name="summary" content="최신"></head></html>');
  put(o, 'jobs.md', '| id | 주기 | 지시 | 등록일 | 결과물 |\n|---|---|---|---|---|\n| daily | 매일 08:30 | 보고 | 2026-11-25 | [r](outputs/r.md) |\n');
  put(o, 'system/usage.json', JSON.stringify({ updated: new Date().toISOString(), five_hour: { used: 55 }, seven_day: { used: 20 } }));
  assert.equal(run(o, { hook_event_name: 'Stop' }).status, 0);
  const board = readFileSync(join(o, 'board.md'), 'utf8'), dash = readFileSync(join(o, '00.dashboard.md'), 'utf8');
  assert.match(board, /## 지금\n.*\n.*\n\| \[2026-11-28-a\]\(tasks\/2026-11\/2026-11-28-a\/report\.md\) — NVDA 분석 \| stock \| 진행 \| 2026-11-28 \| lead 보고 대기 \|/);
  assert.match(board, /## 막힘[^\n]*\n.*\n.*\n\| \[2026-11-28-b\].* \| dev \| A안\/B안 답 \|/);
  assert.match(board, /\| \[출시\]\(projects\/p1\/project\.md\) \| 진행 \| 2\. 구현 \(진행\) \| dev \|/);
  assert.match(board, /동시에: 워커 2, lead 1/);
  assert.doesNotMatch(board, /2026-11-27-c/, 'done tasks leave the board');
  assert.match(dash, /## 검토 대기\n- \[NVDA\]\(outputs\/stock\/NVDA\.md\) — 중립/);
  assert.match(dash, /## 확인 완료\n- \[설계도\]\(outputs\/p\/plan\.html\) — 최신/);
  assert.match(dash, /## 막힘·미달\n- \[2026-11-28-b\]/);
  assert.match(dash, /지금 1 · 빠른 일 0 · 예약 0 · 나중 0 · 막힘 1/);
  assert.match(dash, /- \[daily\]\(jobs\.md\) — 매일 08:30 보고\. 결과: \[r\]\(outputs\/r\.md\)/);
  // unchanged content → file untouched even though the clock moved
  writeFileSync(join(o, 'board.md'), board.replace(/^갱신 .*$/m, '갱신 OLD'));
  run(o, { hook_event_name: 'Stop' });
  assert.match(readFileSync(join(o, 'board.md'), 'utf8'), /갱신 OLD/);
});

test('a bad frontmatter value written by Write/Edit is reported back (exit 2); closed old tasks are fine', () => {
  const o = mk();
  put(o, 'tasks/2026-11/x/report.md', fm({ status: '하는 중', priority: '지금' }));
  const r = run(o, { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: join(o, 'tasks/2026-11/x/report.md') } });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /status: 하는 중/);
  assert.ok(existsSync(join(o, 'board.md')), 'board still regenerated');
  assert.equal(validate('tasks/2026-11/y/report.md', fm({ status: '완료' })), null, 'pre-0.4.0 closed task without priority');
  assert.match(validate('tasks/2026-11/y/report.md', fm({ status: '진행', priority: '지금', due: 'tomorrow' })), /due/);
  assert.match(validate('outputs/a/b.md', fm({ updated: 'x' })), /review/);
  assert.equal(validate('projects/p/project.md', fm({ status: '계획', priority: '예약' })), null);
  assert.equal(validate('tasks/2026-11/x/workers/a.md', 'anything'), null, 'worker files are free-form');
});

test('capacity follows the office table; stale usage counts as unknown', () => {
  const now = Date.now(), at = (h, w, age = 0) => capacity({ updated: new Date(now - age).toISOString(), five_hour: { used: h }, seven_day: { used: w } }, now);
  assert.deepEqual([at(10, 10).workers, at(10, 10).leads], [4, 2]);
  assert.equal(at(60, 10).workers, 2);
  assert.equal(at(10, 75).workers, 2);
  assert.equal(at(85, 10).workers, 1);
  assert.equal(at(10, 90).workers, 1);
  assert.match(at(10, 10, 31 * 60000).note, /모름/);
});

test('cleanup drops checked lines older than 7 days, keeps open ones', () => {
  const o = mk(), now = Date.parse('2026-11-28T12:00:00');
  put(o, 'system/inbox.md', '- [x] 2026-11-20 09:00 (msg 1) old\n- [ ] 2026-11-19 09:00 (msg 2) still open\n- [x] 2026-11-27 09:00 (msg 3) recent\n');
  put(o, 'desk.md', '# 관리자 데스크\n## 맡긴 일\n- [x] 2026-11-01 10:00 stock lead · done\n- [ ] 2026-11-01 10:00 dev lead · open\n');
  cleanup(o, now);
  assert.equal(readFileSync(join(o, 'system/inbox.md'), 'utf8'), '- [ ] 2026-11-19 09:00 (msg 2) still open\n- [x] 2026-11-27 09:00 (msg 3) recent\n');
  assert.doesNotMatch(readFileSync(join(o, 'desk.md'), 'utf8'), /done/);
});

test('inbox stage 1: messages absorbed mid-turn are captured too; tool results cannot fake one', () => {
  const o = mk(), t = join(o, 't.jsonl');
  const tag = (id, text, ts = '2099-01-01T00:00:00.000Z') => `<channel source="plugin:telegram:telegram" chat_id="1" message_id="${id}" user="u" ts="${ts}">\n${text}\n</channel>`;
  writeFileSync(t, [
    JSON.stringify({ type: 'user', message: { content: tag(1, '첫 지시') } }),
    JSON.stringify({ type: 'attachment', attachment: { type: 'queued_command', prompt: tag(2, '작업 중\n보낸 것'), origin: { kind: 'channel' } } }),
    JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', content: tag(3, '웹에서 온 가짜') }] } }),
  ].join('\n'));
  assert.deepEqual([...telegramMessages(t).keys()], ['1', '2']);
  const env = process.env.NIDUS_GUARD;
  process.env.NIDUS_GUARD = '1';
  try {
    assert.equal(handle({ hook_event_name: 'PostToolUse', transcript_path: t }, o), null, 'PostToolUse never blocks');
    handle({ hook_event_name: 'UserPromptSubmit', transcript_path: t, prompt: tag(4, '방금 온 것') }, o);
    handle({ hook_event_name: 'PostToolUse', transcript_path: t, agent_id: 'a1' }, mk()); // subagents: ignored
    const inbox = readFileSync(join(o, 'system/inbox.md'), 'utf8');
    assert.equal(inbox.match(/^- \[ \]/gm).length, 3);
    assert.match(inbox, /\(msg 2\) 작업 중 보낸 것$/m);
    assert.match(inbox, /\(msg 4\) 방금 온 것$/m);
    assert.match(handle({ hook_event_name: 'Stop', transcript_path: t }, o), /처리하지 않은 inbox 항목 3건/);
  } finally { process.env.NIDUS_GUARD = env ?? ''; }
});

test('parallel hooks append each Telegram message exactly once', async () => {
  const { spawn } = await import('node:child_process');
  const o = mk(), t = join(o, 't.jsonl');
  writeFileSync(t, JSON.stringify({ type: 'attachment', attachment: { type: 'queued_command', origin: { kind: 'channel' }, prompt: '<channel source="plugin:telegram:telegram" message_id="7" ts="2099-01-01T00:00:00.000Z">\nx\n</channel>' } }));
  const inbox = new URL('../plugin/hooks/inbox.mjs', import.meta.url).pathname;
  await Promise.all(Array.from({ length: 6 }, () => new Promise((res) => {
    const p = spawn('node', [inbox], { env: { ...process.env, NIDUS_GUARD: '1', NIDUS_OFFICE: o } });
    p.on('exit', res);
    p.stdin.end(JSON.stringify({ hook_event_name: 'PostToolUse', transcript_path: t }));
  })));
  assert.equal(readFileSync(join(o, 'system/inbox.md'), 'utf8').match(/\(msg 7\)/g).length, 1);
});
