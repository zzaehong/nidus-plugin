import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const guard = new URL('../plugin/hooks/guard.mjs', import.meta.url).pathname;
const inbox = new URL('../plugin/hooks/inbox.mjs', import.meta.url).pathname;
const root = realpathSync(mkdtempSync(join(tmpdir(), 'nidus-roles-')));
const office = join(root, 'vault/nidus_office');
const dev = join(root, 'Developer');
const repo = join(dev, 'app');
const plugin = join(dev, 'nidus-plugin');
for (const d of [office, repo, plugin, join(dev, 'Asset_Frame/var')]) mkdirSync(d, { recursive: true });
spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: repo });
const env = {
  ...process.env, NIDUS_GUARD: '1', NIDUS_WRITABLE: dev, NIDUS_OFFICE: office,
  NIDUS_READONLY: [join(root, 'vault'), plugin, join(dev, 'Asset_Frame/var')].join(':'),
};
const as = (agent_type, cwd = office) => (tool_name, tool_input) =>
  spawnSync('node', [guard], { input: JSON.stringify({ tool_name, tool_input, cwd, ...(agent_type && { agent_type }) }), encoding: 'utf8', env }).status;
const manager = as(undefined), worker = as('nidus:worker'), builder = as('nidus:builder');
const OK = 0, NO = 2;

test('only builder writes into ~/Developer; everyone writes the office', () => {
  for (const who of [manager, worker]) {
    assert.equal(who('Write', { file_path: join(repo, 'a.js') }), NO);
    assert.equal(who('Edit', { file_path: join(repo, 'a.js') }), NO);
    assert.equal(who('Bash', { command: `echo x > ${repo}/a.js` }), NO);
    assert.equal(who('Bash', { command: `cd ${repo} && echo x > a.js` }), NO);
    assert.equal(who('Write', { file_path: join(office, 'tasks/r.md') }), OK);
    assert.equal(who('Bash', { command: `git -C ${repo} diff 2>&1 | head` }), OK, 'reading with 2>&1 is not a write');
  }
  assert.equal(builder('Write', { file_path: join(repo, 'a.js') }), OK);
  assert.equal(builder('Bash', { command: `cd ${repo} && echo x > a.js` }), OK);
  assert.equal(builder('Write', { file_path: join(office, 'tasks/x/workers/builder.md') }), OK);
});

test('nidus-plugin, Asset_Frame DB and the vault stay read-only even for builder', () => {
  assert.equal(builder('Edit', { file_path: join(plugin, 'plugin/hooks/guard.mjs') }), NO);
  assert.equal(builder('Bash', { command: `cd ${plugin} && sed -i '' s/a/b/ plugin/hooks/guard.mjs` }), NO);
  assert.equal(builder('Write', { file_path: join(dev, 'Asset_Frame/var/db.sqlite3') }), NO);
  assert.equal(builder('Write', { file_path: join(root, 'vault/note.md') }), NO);
});

test('builder has no web: tools and fetch commands blocked; worker keeps the web', () => {
  assert.equal(builder('WebFetch', { url: 'https://example.com' }), NO);
  assert.equal(builder('WebSearch', { query: 'x' }), NO);
  assert.equal(builder('Bash', { command: 'curl -s https://example.com' }), NO);
  assert.equal(builder('Bash', { command: `cd ${repo} && wget https://x` }), NO);
  assert.equal(worker('WebFetch', { url: 'https://example.com' }), OK);
  assert.equal(builder('Bash', { command: `cd ${repo} && npm test` }), OK);
});

test('push from a repo on main is blocked after cd or git -C', () => {
  assert.equal(builder('Bash', { command: `cd ${repo} && git push` }), NO);
  assert.equal(builder('Bash', { command: `git -C ${repo} push` }), NO);
  spawnSync('git', ['switch', '-q', '-c', 'nidus/t1'], { cwd: repo });
  assert.equal(builder('Bash', { command: `cd ${repo} && git push origin nidus/t1` }), OK);
});

test('office root is fixed by NIDUS_OFFICE, not by where the shell cd-ed to', () => {
  const inPlugin = as(undefined, plugin);
  assert.equal(inPlugin('Edit', { file_path: join(plugin, 'plugin/hooks/guard.mjs') }), NO);
  assert.equal(inPlugin('Write', { file_path: 'plugin/hooks/guard.mjs' }), NO);
  assert.equal(as(undefined, repo)('Write', { file_path: 'a.js' }), NO, 'manager cd-ed into a repo still cannot write it');
  assert.equal(as('nidus:builder', repo)('Write', { file_path: 'a.js' }), OK);
});

test('config files that get loaded and run later are not writable by anyone', () => {
  for (const who of [manager, worker, builder]) {
    assert.equal(who('Write', { file_path: join(office, '.claude/settings.json') }), NO);
    assert.equal(who('Write', { file_path: join(office, 'CLAUDE.md') }), NO);
    assert.equal(who('Write', { file_path: join(repo, '.claude/agents/x.md') }), NO);
    assert.equal(who('Write', { file_path: join(repo, '.git/hooks/pre-commit') }), NO);
    assert.equal(who('Bash', { command: `echo x > ${repo}/.mcp.json` }), NO);
    assert.equal(who('Bash', { command: `cd ${repo} && git config core.hooksPath /tmp/h` }), NO);
  }
});

test('builder identity is the exact plugin agent id', () => {
  for (const fake of ['builder', 'evil-builder', 'x:builder', 'nidus:builder2'])
    assert.equal(as(fake)('Write', { file_path: join(repo, 'a.js') }), NO, fake);
});

test('Stop hook refuses to stop while inbox has unchecked messages, once per stop', () => {
  const stop = (extra = {}) => spawnSync('node', [inbox], { input: JSON.stringify({ cwd: office, ...extra }), encoding: 'utf8', env }).status;
  assert.equal(stop(), OK, 'no inbox file');
  mkdirSync(join(office, 'system'), { recursive: true });
  writeFileSync(join(office, 'system/inbox.md'), '- [x] 2026-11-26 09:00 (msg 1) 끝난 것 → 답장함\n- [ ] 2026-11-26 09:05 (msg 2) 새 지시\n');
  assert.equal(stop(), NO);
  assert.equal(stop({ stop_hook_active: true }), OK, 'no infinite loop');
  writeFileSync(join(office, 'system/inbox.md'), '- [x] 2026-11-26 09:05 (msg 2) 새 지시 → 답장함\n');
  assert.equal(stop(), OK);
});

test('Stop hook catches Telegram messages that never reached the inbox', () => {
  const t = join(root, 'transcript.jsonl');
  const msg = (id) => JSON.stringify({ type: 'user', message: { role: 'user', content: `<channel source="plugin:telegram:telegram" chat_id="1" message_id="${id}" user="u" ts="t">hi</channel>` } });
  const blob = JSON.stringify({ type: 'api-request-blob', message: { role: 'user', content: [{ type: 'text', text: '<channel source="plugin:telegram:telegram" message_id="999">' }] } });
  writeFileSync(t, [msg(2), msg(3), blob, '{broken'].join('\n'));
  const stop = (extra = {}) => spawnSync('node', [inbox], { input: JSON.stringify({ cwd: office, transcript_path: t, ...extra }), encoding: 'utf8', env });
  const r = stop();
  assert.equal(r.status, NO);
  assert.match(r.stderr, /msg 3\)/);
  assert.doesNotMatch(r.stderr, /999/, 'only real user entries count');
  writeFileSync(join(office, 'system/inbox.md'), '- [x] (msg 2) a → 답장함\n- [x] (msg 3) b → 답장함\n');
  assert.equal(stop().status, OK);
  assert.equal(spawnSync('node', [inbox], { input: JSON.stringify({ cwd: office, transcript_path: join(root, 'none') }), encoding: 'utf8', env }).status, OK, 'missing transcript fails open');
});

test('group manager (nidus:lead) writes tasks, projects, outputs and team desks, not definitions or the board', () => {
  const lead = as('nidus:lead');
  for (const f of ['tasks/2026-11/x/report.md', 'projects/p1/project.md', 'projects/p1/phase-1.md', 'outputs/stock/NVDA.md', 'teams/stock/desk.md'])
    assert.equal(lead('Write', { file_path: join(office, f) }), OK, f);
  for (const f of ['teams/stock/TEAM.md', 'board.md', 'desk.md', '00.dashboard.md', 'jobs.md', 'system/inbox.md', 'teams/stock/sub/desk.md'])
    assert.equal(lead('Write', { file_path: join(office, f) }), NO, f);
  assert.equal(lead('Write', { file_path: join(repo, 'a.js') }), NO, 'code is the builder\'s');
  assert.equal(worker('Write', { file_path: join(office, 'projects/p1/project.md') }), NO, 'workers stay in tasks/');
});

test('subagents write only under office/tasks; the manager owns dashboard, outputs, teams, system', () => {
  const redteam = as('nidus:redteam');
  for (const who of [worker, builder, redteam]) {
    assert.equal(who('Write', { file_path: join(office, 'tasks/2026-11/x/workers/a.md') }), OK);
    for (const f of ['teams/stock/TEAM.md', 'teams/stock/desk.md', '00.dashboard.md', 'outputs/stock/NVDA.md', 'jobs.md', 'system/inbox.md'])
      assert.equal(who('Write', { file_path: join(office, f) }), NO, f);
  }
  for (const f of ['teams/stock/TEAM.md', '00.dashboard.md', 'system/inbox.md'])
    assert.equal(manager('Write', { file_path: join(office, f) }), OK, f);
  assert.equal(redteam('WebFetch', { url: 'https://example.com' }), OK, 'red team keeps the web');
  assert.equal(redteam('Write', { file_path: join(repo, 'a.js') }), NO, 'red team cannot write code');
});
