import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const script = new URL('../scripts/office.sh', import.meta.url).pathname;
const repo = dirname(dirname(script));

// Run office.sh with a stub tmux that records the session command, return the env it would launch with.
function launch(extra = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'nidus-office-')));
  mkdirSync(join(dir, 'vault'));
  writeFileSync(join(dir, 'tmux'), `#!/bin/sh\nfor a; do last=$a; done\nprintf '%s' "$last" > '${join(dir, 'cmd')}'\n`);
  chmodSync(join(dir, 'tmux'), 0o755);
  const r = spawnSync('sh', [script, 'vault', 'office'], { cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, HOME: dir, ...extra } });
  assert.equal(r.status, 0, r.stderr);
  const cmd = readFileSync(join(dir, 'cmd'), 'utf8');
  const v = (k) => cmd.match(new RegExp(`${k}='([^']*)'`))[1];
  return { dir, ro: v('NIDUS_READONLY').split(':'), dev: v('NIDUS_WRITABLE'), cmd };
}

test('read-only list: absolute vault, this repo, launchd plist folder; no empty entry', () => {
  const { dir, ro, dev } = launch();
  assert.deepEqual(ro, [join(dir, 'vault'), repo, join(dir, 'Library/LaunchAgents')]);
  assert.equal(dev, join(dir, 'Developer'));
});

test('NIDUS_EXTRA_READONLY and NIDUS_DEV are carried into the session', () => {
  const code = join(realpathSync(mkdtempSync(join(tmpdir(), 'nidus-dev-'))), 'code'); // office.sh creates it
  const { ro, dev, cmd } = launch({ NIDUS_EXTRA_READONLY: '/data/a:/data/b', NIDUS_DEV: code });
  assert.deepEqual(ro.slice(-2), ['/data/a', '/data/b']);
  assert.equal(dev, code);
  assert.ok(cmd.includes(`--add-dir '${code}'`));
});
