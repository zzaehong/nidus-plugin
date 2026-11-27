#!/usr/bin/env node
// Status line for the nidus session: show subscription usage and save it to system/usage.json for the manager,
// which decides how many workers to run at once from it (office skill, "사용량"). Input: status line JSON on stdin.
import { writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';

export function usage(input, now = Date.now()) {
  const w = (k) => {
    const r = input.rate_limits?.[k];
    return typeof r?.used_percentage === 'number' ? { used: Math.round(r.used_percentage), resets_at: new Date(r.resets_at * 1000).toISOString() } : null;
  };
  return { updated: new Date(now).toISOString(), five_hour: w('five_hour'), seven_day: w('seven_day') };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let raw = '';
  for await (const c of process.stdin) raw += c;
  let u = usage({});
  try { u = usage(JSON.parse(raw || '{}')); } catch {}
  const office = process.env.NIDUS_OFFICE;
  // rate_limits only appears after the first API response: keep the last known numbers until then.
  if (office && (u.five_hour || u.seven_day)) {
    const f = join(office, 'system/usage.json');
    try { writeFileSync(f + '.tmp', JSON.stringify(u, null, 2) + '\n'); renameSync(f + '.tmp', f); } catch {}
  }
  const pct = (x) => (x ? `${x.used}%` : '?');
  console.log(`nidus · 5h ${pct(u.five_hour)} · 7d ${pct(u.seven_day)}`);
}
