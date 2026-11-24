import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, chmodSync, mkdirSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const watchdog = new URL('../scripts/watchdog.sh', import.meta.url).pathname;
const T0 = Math.floor(new Date('2026-11-25T03:00:00+09:00').getTime() / 1000); // 03:00 KST, before the daily window

// Fresh sandbox: stub tmux (session up/down, pane text from files) and curl; office.sh stub records restarts.
function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'nidus-watchdog-'));
  const office = join(dir, 'office');
  mkdirSync(join(office, 'tasks/2026-11/2026-11-26-x'), { recursive: true });
  mkdirSync(join(office, 'system'), { recursive: true });
  writeFileSync(join(office, 'system/chat.md'), 'Telegram chat_id: 123456789\n');
  writeFileSync(join(dir, 'tg.env'), 'TELEGRAM_BOT_TOKEN=111:abc_DEF\n');
  const p = (n) => join(dir, n);
  const stub = (name, body) => { writeFileSync(p(name), `#!/bin/sh\n${body}\n`); chmodSync(p(name), 0o755); };
  stub('tmux', `case $1 in
has-session) [ -f ${p('up')} ] ;;
capture-pane) cat ${p('pane')} ;;
send-keys) echo "send $*" >> ${p('tmux.log')} ;;
kill-session) echo kill >> ${p('tmux.log')}; rm -f ${p('up')} ;;
esac`);
  stub('curl', `cat >/dev/null; echo "$*" >> ${p('curl.log')}`);
  stub('office.sh', `echo "$NIDUS_RESTARTED" >> ${p('starts')}; touch ${p('up')}`);
  const set = (up, pane = '') => { up ? writeFileSync(p('up'), '') : rmSync(p('up'), { force: true }); writeFileSync(p('pane'), pane); };
  const tick = (now) => {
    const r = spawnSync('sh', [watchdog, 'check', '/vault', office], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, OFFICE_SH: p('office.sh'), NIDUS_NOW: String(now), NIDUS_TG_ENV: p('tg.env'), NIDUS_KEY_DELAY: '0' },
    });
    assert.equal(r.status, 0, r.stderr + r.stdout);
  };
  const lines = (n) => (existsSync(p(n)) ? readFileSync(p(n), 'utf8').trim().split('\n') : []);
  return { office, set, tick, lines };
}
const IDLE = '❯ \n  ⏵⏵ auto mode on (shift+tab to cycle)';
const WORKING = '  ⏵⏵ auto mode on (shift+tab to cycle) · esc to interrupt';
const WAITING = ' Yes, add it\n Enter to confirm · Esc to cancel';

test('live idle session: nothing happens', () => {
  const s = sandbox();
  s.set(true, IDLE);
  s.tick(T0);
  assert.deepEqual(s.lines('starts'), []);
  assert.deepEqual(s.lines('curl.log'), []);
});

test('dead session: crash restarts capped at 3 per window, then one alert', () => {
  const s = sandbox();
  for (let i = 0; i < 5; i++) { s.set(false); s.tick(T0 + i * 60); }
  assert.deepEqual(s.lines('starts'), ['1', '1', '1']);
  assert.equal(s.lines('curl.log').length, 1);
  assert.match(s.lines('curl.log')[0], /chat_id=123456789/);
  assert.ok(!s.lines('curl.log')[0].includes('111:abc'), 'token must not be on the command line');
});

test('approval prompt and long work alert once per episode', () => {
  const s = sandbox();
  s.set(true, WAITING);
  for (const m of [0, 1, 2, 3, 4, 5]) s.tick(T0 + m * 60);
  assert.equal(s.lines('curl.log').length, 1);
  s.set(true, WORKING);
  for (const m of [6, 30, 66, 67, 90]) s.tick(T0 + m * 60);
  assert.equal(s.lines('curl.log').length, 2);
});

test('daily restart: waits for idle x2, asks for handoff, restarts once handoff.md is written', () => {
  const s = sandbox();
  s.set(true, WORKING);
  s.tick(T0); // first run: records today, no restart
  const day2 = T0 + 27 * 3600; // next day 06:00 KST
  s.set(true, IDLE);
  s.tick(day2);
  assert.deepEqual(s.lines('tmux.log'), [], 'one idle tick is not enough');
  s.tick(day2 + 60);
  assert.match(s.lines('tmux.log')[0], /send-keys -t nidus -l .*handoff\.md/);
  s.set(true, WORKING);
  s.tick(day2 + 120);
  assert.deepEqual(s.lines('starts'), []);
  writeFileSync(join(s.office, 'system/handoff.md'), '없음\n');
  utimesSync(join(s.office, 'system/handoff.md'), day2 + 150, day2 + 150);
  s.set(true, IDLE);
  s.tick(day2 + 180);
  assert.ok(s.lines('tmux.log').includes('kill'));
  assert.deepEqual(s.lines('starts'), ['daily']);
  s.tick(day2 + 240);
  s.tick(day2 + 300);
  assert.deepEqual(s.lines('starts'), ['daily'], 'only once a day');
  assert.ok(readFileSync(join(s.office, 'system/events.md'), 'utf8').includes('일일 재시작'));
});

test('daily restart is skipped while a task is open', () => {
  const s = sandbox();
  s.set(true, IDLE);
  s.tick(T0);
  writeFileSync(join(s.office, 'tasks/2026-11/2026-11-26-x/report.md'), '---\nstatus: 진행\n---\n');
  const day2 = T0 + 27 * 3600;
  for (let i = 0; i < 5; i++) s.tick(day2 + i * 60);
  assert.deepEqual(s.lines('tmux.log'), []);
});

test('daily window is 06:00-08:00 KST: nothing before, skip + one alert after', () => {
  const s = sandbox();
  s.set(true, IDLE);
  s.tick(T0);
  const day2 = T0 + 27 * 3600; // 06:00 KST
  s.tick(day2 - 120);
  s.tick(day2 - 60); // 05:58, 05:59 idle
  assert.deepEqual(s.lines('tmux.log'), []);
  s.set(true, WORKING);
  for (const m of [0, 60, 119]) s.tick(day2 + m * 60);
  s.set(true, IDLE);
  s.tick(day2 + 120 * 60); // 08:00
  s.tick(day2 + 121 * 60);
  s.tick(day2 + 122 * 60);
  assert.deepEqual(s.lines('tmux.log'), [], 'no restart after 08:00');
  assert.equal(readFileSync(join(s.office, 'system/events.md'), 'utf8').match(/일일 재시작 건너뜀/g).length, 1);
  assert.equal(s.lines('curl.log').length, 2, 'the 60-min work alert + one skip alert');
});

test('tampered state file is ignored, not executed', () => {
  const s = sandbox();
  s.set(true, IDLE);
  s.tick(T0);
  writeFileSync(join(s.office, 'system/watchdog.state'), 'idle a[$(touch /tmp/nidus-pwned)] 0 x 0 0\n');
  s.tick(T0 + 60);
  assert.ok(!existsSync('/tmp/nidus-pwned'));
});
