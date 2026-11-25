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
  ...process.env, NIDUS_GUARD: '1', NIDUS_WRITABLE: dev,
  NIDUS_READONLY: [join(root, 'vault'), plugin, join(dev, 'Asset_Frame/var')].join(':'),
};
const as = (agent_type) => (tool_name, tool_input) =>
  spawnSync('node', [guard], { input: JSON.stringify({ tool_name, tool_input, cwd: office, ...(agent_type && { agent_type }) }), encoding: 'utf8', env }).status;
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
