#!/usr/bin/env node
// Stop hook: Telegram messages can arrive mid-task and get ignored. Refuse to stop (exit 2, reason on stderr) when
// - system/inbox.md has unchecked items ("- [ ]"), or
// - the transcript has a Telegram message whose id never made it into inbox.md ("(msg <id>)").
// Active only when NIDUS_GUARD=1. One nudge per stop (stop_hook_active), never a loop.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CHANNEL = /<channel source="plugin:telegram:telegram"[^>]*?\bmessage_id="(\d+)"/g;

// shortcut: the transcript JSONL format is internal to Claude Code; if it changes this finds nothing and fails open.
export function telegramIds(transcriptPath) {
  const ids = new Set();
  let raw = '';
  try { raw = readFileSync(transcriptPath, 'utf8'); } catch { return ids; }
  for (const line of raw.split('\n')) {
    if (!line.includes('plugin:telegram:telegram')) continue;
    let d;
    try { d = JSON.parse(line); } catch { continue; }
    if (d.type !== 'user') continue;
    const c = d.message?.content;
    const text = typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text ?? '').join('\n') : '';
    for (const m of text.matchAll(CHANNEL)) ids.add(m[1]);
  }
  return ids;
}

export function problems(input) {
  if (process.env.NIDUS_GUARD !== '1' || input.stop_hook_active) return null;
  const office = process.env.NIDUS_OFFICE || input.cwd || '.';
  let inbox = '';
  try { inbox = readFileSync(join(office, 'system/inbox.md'), 'utf8'); } catch {}
  const open = (inbox.match(/^- \[ \]/gm) ?? []).length;
  const missing = [...telegramIds(input.transcript_path ?? '')].filter((id) => !inbox.includes(`(msg ${id})`));
  if (!open && !missing.length) return null;
  const parts = [];
  if (missing.length) parts.push(`inbox에 기록되지 않은 Telegram 메시지 ${missing.length}건(msg ${missing.join(', ')})`);
  if (open) parts.push(`처리하지 않은 inbox 항목 ${open}건`);
  return `nidus inbox: ${parts.join(', ')}이 있다. office 스킬의 "Telegram 메시지" 절차대로 system/inbox.md에 기록·처리하고 [x]로 표시하라.`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let raw = '';
  for await (const c of process.stdin) raw += c;
  const reason = problems(JSON.parse(raw || '{}'));
  if (reason) { console.error(reason); process.exit(2); }
}
