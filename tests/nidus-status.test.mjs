import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = new URL('../scripts/nidus-status.10s.sh', import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), 'nidus-status-'));
writeFileSync(join(dir, 'bot.pid'), '4242');
const iconFor = (hasSession, pane, tg = true, office = '') => {
  writeFileSync(join(dir, 'pane'), pane);
  writeFileSync(join(dir, 'tmux'), `#!/bin/sh\ncase $1 in has-session) exit ${hasSession ? 0 : 1};; capture-pane) cat '${join(dir, 'pane')}';; esac\n`);
  writeFileSync(join(dir, 'ps'), `#!/bin/sh\n${tg ? 'echo "bun server.ts"' : 'exit 1'}\n`);
  chmodSync(join(dir, 'tmux'), 0o755);
  chmodSync(join(dir, 'ps'), 0o755);
  return spawnSync('sh', [script], { encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, NIDUS_TG_DIR: dir, NIDUS_OFFICE: office } }).stdout.split('\n')[0];
};
const png = (s) => ` | image=${readFileSync(new URL(`../assets/menubar/${s}.png`, import.meta.url)).toString('base64')}`;

test('menu bar icon reflects session state', () => {
  assert.equal(iconFor(false, ''), png('off'));
  assert.equal(iconFor(true, ' Yes, add it\n Enter to confirm · Esc to cancel'), png('waiting'));
  assert.equal(iconFor(true, '✻ Thinking… (12s · esc to interrupt)'), png('working'));
  assert.equal(iconFor(true, '> \n  ? for shortcuts'), png('idle'));
  assert.equal(iconFor(true, '> \n  ? for shortcuts', false), png('tgdown'));
  assert.equal(iconFor(false, '', false), png('off'), 'session off wins');
  mkdirSync(join(dir, 'office/system/running'), { recursive: true });
  writeFileSync(join(dir, 'office/system/running/a1'), 'nidus:lead x\n');
  assert.equal(iconFor(true, '> \n  ? for shortcuts', true, join(dir, 'office')), png('working'), 'background subagents show as working');
});
