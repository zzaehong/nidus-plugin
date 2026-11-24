import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const watchdog = new URL('../scripts/watchdog.sh', import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), 'nidus-watchdog-'));
const office = join(dir, 'office');
const calls = join(dir, 'calls');
const stub = (name, body) => { writeFileSync(join(dir, name), `#!/bin/sh\n${body}\n`); chmodSync(join(dir, name), 0o755); };
stub('office.sh', `echo "$NIDUS_RESTARTED $1" >> ${calls}`);
const run = (tmuxExit) => {
  stub('tmux', `exit ${tmuxExit}`);
  return spawnSync('sh', [watchdog, 'check', '/vault', office], {
    encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, OFFICE_SH: join(dir, 'office.sh') },
  });
};

test('live session: no restart', () => {
  assert.equal(run(0).status, 0);
  assert.ok(!existsSync(calls));
});
test('dead session: restarts with NIDUS_RESTARTED, capped at 3 per window', () => {
  for (let i = 0; i < 5; i++) assert.equal(run(1).status, 0);
  assert.deepEqual(readFileSync(calls, 'utf8').trim().split('\n'), ['1 /vault', '1 /vault', '1 /vault']);
});
