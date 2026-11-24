import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const guard = new URL('../plugin/hooks/guard.mjs', import.meta.url).pathname;
const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'nidus-guard-')));
spawnSync('git', ['init', '-q', '-b', 'nidus/spec-001'], { cwd });
const vault = realpathSync(mkdtempSync(join(tmpdir(), 'nidus-vault-')));
const env = { ...process.env, NIDUS_GUARD: '1', NIDUS_READONLY: vault };
const run = (tool_name, tool_input, extra = {}, e = env) =>
  spawnSync('node', [guard], { input: JSON.stringify({ tool_name, tool_input, cwd, ...extra }), encoding: 'utf8', env: e });
const blocked = (r) => assert.equal(r.status, 2, r.stderr);
const allowed = (r) => assert.equal(r.status, 0, r.stderr);

test('push to main/master is blocked', () => {
  for (const c of ['git push origin main', 'git push origin HEAD:main', 'git push origin HEAD:refs/heads/master', 'git push origin +main', 'cd x && git push origin main'])
    blocked(run('Bash', { command: c }));
});
test('force push is blocked even on a feature branch', () => {
  for (const c of ['git push --force origin nidus/spec-001', 'git push -f', 'git push --force-with-lease origin x'])
    blocked(run('Bash', { command: c }));
});
test('bare push on main branch is blocked, on feature branch allowed', () => {
  const main = realpathSync(mkdtempSync(join(tmpdir(), 'nidus-main-')));
  spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: main });
  blocked(run('Bash', { command: 'git push' }, { cwd: main }));
  allowed(run('Bash', { command: 'git push origin nidus/spec-001' }));
});
test('writes outside the worktree are blocked, inside allowed', () => {
  blocked(run('Write', { file_path: '/etc/hosts' }));
  blocked(run('Edit', { file_path: '../escape.txt' }));
  allowed(run('Write', { file_path: join(cwd, 'new/dir/file.txt') }));
});
test('symlink escape is blocked', () => {
  symlinkSync(tmpdir(), join(cwd, 'link'));
  blocked(run('Write', { file_path: join(cwd, 'link', 'x.txt') }));
});
test('credential paths are blocked', () => {
  blocked(run('Read', { file_path: '/Users/a/.ssh/id_ed25519' }));
  blocked(run('Bash', { command: 'cat ~/.aws/credentials' }));
});
test('vault is read-only', () => {
  blocked(run('Write', { file_path: join(vault, 'note.md') }));
  blocked(run('Edit', { file_path: join(vault, 'note.md') }));
  blocked(run('Bash', { command: `echo x > ${vault}/note.md` }));
  blocked(run('Bash', { command: `rm ${vault}/note.md` }));
  blocked(run('Bash', { command: `sqlite3 ${vault}/db.sqlite3 'delete from t'` }));
  allowed(run('Bash', { command: `sqlite3 -readonly ${vault}/db.sqlite3 'select 1'` }));
  allowed(run('Bash', { command: `grep -r AAPL ${vault}` }));
  allowed(run('Read', { file_path: join(vault, 'note.md') }));
});
test('guard is inactive without NIDUS_GUARD', () => {
  allowed(run('Bash', { command: 'git push origin main' }, {}, { ...process.env, NIDUS_GUARD: '' }));
});
