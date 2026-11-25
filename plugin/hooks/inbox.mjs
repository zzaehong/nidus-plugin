#!/usr/bin/env node
// Stop hook: Telegram messages can arrive mid-task. If system/inbox.md still has unchecked items ("- [ ]"),
// refuse to stop (exit 2, reason on stderr) so the manager handles them. Active only when NIDUS_GUARD=1.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function pending(input) {
  if (process.env.NIDUS_GUARD !== '1' || input.stop_hook_active) return 0; // one nudge per stop, never a loop
  let text = '';
  try { text = readFileSync(join(input.cwd ?? '.', 'system/inbox.md'), 'utf8'); } catch { return 0; }
  return (text.match(/^- \[ \]/gm) ?? []).length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let raw = '';
  for await (const c of process.stdin) raw += c;
  const n = pending(JSON.parse(raw || '{}'));
  if (n) {
    console.error(`nidus inbox: system/inbox.md에 처리하지 않은 Telegram 메시지 ${n}건이 있다. office 스킬의 "Telegram 메시지" 절차대로 처리하고 [x]로 표시하라.`);
    process.exit(2);
  }
}
