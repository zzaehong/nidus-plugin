import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, realpathSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const script = new URL('../scripts/office.sh', import.meta.url).pathname;
const repo = dirname(dirname(script));

// Run office.sh (HOME = a temp dir) with a stub tmux that records the session command.
function launch(config) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'nidus-office-')));
  mkdirSync(join(dir, 'vault'));
  writeFileSync(join(dir, 'tmux'), `#!/bin/sh\nfor a; do last=$a; done\nprintf '%s' "$last" > '${join(dir, 'cmd')}'\n`);
  chmodSync(join(dir, 'tmux'), 0o755);
  if (config !== undefined) { mkdirSync(join(dir, '.config/nidus'), { recursive: true }); writeFileSync(join(dir, '.config/nidus/config'), config(dir)); }
  const r = spawnSync('sh', [script, 'vault', 'office'], { cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, HOME: dir, NIDUS_CONFIG: '' } });
  if (r.status !== 0) return { dir, status: r.status, err: r.stderr };
  const cmd = readFileSync(join(dir, 'cmd'), 'utf8');
  const v = (k) => cmd.match(new RegExp(`${k}='([^']*)'`))[1];
  return { dir, status: 0, cmd, ro: v('NIDUS_READONLY').split(':'), wr: v('NIDUS_WRITABLE'), noread: v('NIDUS_NOREAD') };
}

test('no config: ~/Developer writable, fixed read-only set, nothing unreadable', () => {
  const { dir, ro, wr, noread, cmd } = launch();
  assert.deepEqual(ro, [join(dir, 'vault'), repo, join(dir, '.config/nidus'), join(dir, 'Library/LaunchAgents')]);
  assert.equal(wr, join(dir, 'Developer'));
  assert.equal(noread, '');
  assert.ok(cmd.includes(`--add-dir '${join(dir, 'Developer')}'`));
});

test('config: several writable folders (each added), extra read-only, noread, ~ and comments', () => {
  const { dir, ro, wr, noread, cmd } = launch((d) => `# my setup
writable = ~/Developer
writable = ${d}/Projects/my app/   # trailing slash and spaces are fine
readonly = ~/Developer/Asset_Frame/var
noread = ~/Documents/private
tz = Europe/Berlin
`);
  assert.equal(wr, `${join(dir, 'Developer')}:${join(dir, 'Projects/my app')}`);
  assert.ok(cmd.includes(`--add-dir '${join(dir, 'Projects/my app')}'`));
  assert.ok(existsSync(join(dir, 'Projects/my app')));
  assert.equal(ro.at(-1), join(dir, 'Developer/Asset_Frame/var'));
  assert.equal(noread, join(dir, 'Documents/private'));
});

test('bad config values stop the launch', () => {
  for (const bad of ['writable = relative/path', "writable = /tmp/it's", 'readonly = /a:/b', 'noread = /', 'writable = ~', 'writable = ~/'])
    assert.notEqual(launch(() => bad + '\n').status, 0, bad);
});

test('first launch copies the example teams; later launches keep the user edits; running/ is cleared', () => {
  const { dir, cmd } = launch();
  const office = join(dir, 'office');
  assert.ok(existsSync(join(office, 'teams/stock/TEAM.md')));
  assert.ok(existsSync(join(office, 'teams/dev/TEAM.md')));
  assert.match(cmd, /--settings '\{"statusLine":\{"type":"command","command":"node [^"]*scripts\/nidus-usage\.mjs","refreshInterval":60\}\}'/);
  writeFileSync(join(office, 'teams/stock/TEAM.md'), 'mine\n');
  mkdirSync(join(office, 'system/running'), { recursive: true });
  writeFileSync(join(office, 'system/running/old'), '');
  const r = spawnSync('sh', [script, 'vault', 'office'], { cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, HOME: dir, NIDUS_CONFIG: '' } });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(join(office, 'teams/stock/TEAM.md'), 'utf8'), 'mine\n');
  assert.ok(!existsSync(join(office, 'system/running')));
});
