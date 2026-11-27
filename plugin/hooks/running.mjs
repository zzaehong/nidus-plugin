#!/usr/bin/env node
// SubagentStart/SubagentStop: keep one file per running subagent in system/running/ so the watchdog and the menu bar
// see background work even while the manager's pane looks idle. Never blocks (always exit 0).
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export function track(input, office = process.env.NIDUS_OFFICE) {
  const id = String(input.agent_id ?? '');
  if (!office || !/^[A-Za-z0-9_-]+$/.test(id)) return; // id becomes a file name
  const dir = join(office, 'system/running');
  if (input.hook_event_name === 'SubagentStart') {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, id), `${input.agent_type ?? ''} ${new Date().toISOString()}\n`);
  } else if (input.hook_event_name === 'SubagentStop') rmSync(join(dir, id), { force: true });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let raw = '';
  for await (const c of process.stdin) raw += c;
  try { track(JSON.parse(raw || '{}')); } catch {}
}
