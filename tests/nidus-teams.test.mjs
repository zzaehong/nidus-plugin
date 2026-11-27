import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const running = new URL('../plugin/hooks/running.mjs', import.meta.url).pathname;
const usage = new URL('../scripts/nidus-usage.mjs', import.meta.url).pathname;
const teams = new URL('../plugin/teams/', import.meta.url).pathname;

test('SubagentStart/Stop keep one file per running subagent; bad ids are ignored', () => {
  const office = mkdtempSync(join(tmpdir(), 'nidus-run-'));
  const hook = (input) => spawnSync('node', [running], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, NIDUS_OFFICE: office } }).status;
  assert.equal(hook({ hook_event_name: 'SubagentStart', agent_id: 'a1', agent_type: 'nidus:worker' }), 0);
  assert.equal(hook({ hook_event_name: 'SubagentStart', agent_id: 'a2', agent_type: 'nidus:builder' }), 0);
  assert.equal(hook({ hook_event_name: 'SubagentStart', agent_id: '../../x' }), 0);
  assert.deepEqual(readdirSync(join(office, 'system/running')).sort(), ['a1', 'a2']);
  assert.match(readFileSync(join(office, 'system/running/a1'), 'utf8'), /^nidus:worker /);
  hook({ hook_event_name: 'SubagentStop', agent_id: 'a1' });
  hook({ hook_event_name: 'SubagentStop', agent_id: 'never-started' });
  assert.deepEqual(readdirSync(join(office, 'system/running')), ['a2']);
  assert.equal(spawnSync('node', [running], { input: '{broken', encoding: 'utf8' }).status, 0, 'never blocks');
});

test('status line saves usage for the manager and keeps the last numbers before the first response', () => {
  const office = mkdtempSync(join(tmpdir(), 'nidus-usage-'));
  const run = (input) => spawnSync('node', [usage], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, NIDUS_OFFICE: office } });
  const f = join(office, 'system/usage.json');
  assert.equal(run({}).stdout.trim(), 'nidus · 5h ? · 7d ?');
  assert.ok(!existsSync(f));
  spawnSync('mkdir', ['-p', join(office, 'system')]);
  const r = run({ rate_limits: { five_hour: { used_percentage: 23.5, resets_at: 1738425600 }, seven_day: { used_percentage: 41.2, resets_at: 1738857600 } } });
  assert.equal(r.stdout.trim(), 'nidus · 5h 24% · 7d 41%');
  const u = JSON.parse(readFileSync(f, 'utf8'));
  assert.equal(u.five_hour.used, 24);
  assert.equal(u.five_hour.resets_at, '2025-02-01T16:00:00.000Z');
  run({});
  assert.equal(JSON.parse(readFileSync(f, 'utf8')).seven_day.used, 41, 'no rate_limits yet: file kept');
});

test('every example team names its members with a known agent kind', () => {
  for (const t of readdirSync(teams)) {
    const md = readFileSync(join(teams, t, 'TEAM.md'), 'utf8');
    assert.match(md, new RegExp(`^---\\nname: ${t}\\n`), t);
    for (const k of ['description', 'library', 'repos', 'output', 'redteam']) assert.match(md, new RegExp(`^${k}:`, 'm'), `${t} ${k}`);
    const kinds = [...md.matchAll(/^\| [\w-]+ \| (\w+) \|/gm)].map((m) => m[1]).filter((k) => k !== '종류');
    assert.ok(kinds.length > 0, t);
    for (const k of kinds) assert.ok(['worker', 'builder'].includes(k), `${t}: ${k}`);
    assert.ok(existsSync(join(teams, t, 'desk.md')), t);
  }
});

test('group manager can spawn the workers it manages; workers cannot spawn further', () => {
  const fm = (n) => readFileSync(new URL(`../plugin/agents/${n}.md`, import.meta.url), 'utf8').match(/^tools: (.*)$/m)[1].split(/,\s*/);
  assert.ok(fm('lead').includes('Agent'));
  for (const n of ['worker', 'builder', 'redteam']) assert.ok(!fm(n).includes('Agent'), n);
  const lead = readFileSync(new URL('../plugin/agents/lead.md', import.meta.url), 'utf8');
  for (const a of ['nidus:worker', 'nidus:builder', 'nidus:redteam']) assert.ok(lead.includes(a), a);
});
