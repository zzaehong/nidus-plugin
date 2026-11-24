import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = new URL('../scripts/nidus-status.10s.sh', import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), 'nidus-status-'));
const iconFor = (hasSession, pane) => {
  writeFileSync(join(dir, 'pane'), pane);
  writeFileSync(join(dir, 'tmux'), `#!/bin/sh\ncase $1 in has-session) exit ${hasSession ? 0 : 1};; capture-pane) cat '${join(dir, 'pane')}';; esac\n`);
  chmodSync(join(dir, 'tmux'), 0o755);
  return spawnSync('sh', [script], { encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}` } }).stdout.split('\n')[0];
};

test('menu bar icon reflects session state', () => {
  assert.equal(iconFor(false, ''), '🔴');
  assert.equal(iconFor(true, ' Yes, add it\n Enter to confirm · Esc to cancel'), '🟡');
  assert.equal(iconFor(true, '✻ Thinking… (12s · esc to interrupt)'), '🔵');
  assert.equal(iconFor(true, '> \n  ? for shortcuts'), '🟢');
});
