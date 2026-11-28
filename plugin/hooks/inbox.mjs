#!/usr/bin/env node
// Inbox stage 1 in code: every Telegram message in the transcript is appended to system/inbox.md as
//   - [ ] YYYY-MM-DD HH:MM (msg <id>) <text>
// on UserPromptSubmit (from the prompt itself), PostToolUse (messages absorbed mid-turn) and Stop.
// On Stop it also refuses to stop (exit 2, reason on stderr) while inbox.md has unchecked items, so stage 2 happens.
// Active only when NIDUS_GUARD=1, main session only. One nudge per stop (stop_hook_active), never a loop.
import { readFileSync, appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stamp } from './sync.mjs';

const TAG = /<channel source="plugin:telegram:telegram"([^>]*)>([\s\S]*?)<\/channel>/g;

export function parse(text, out = new Map()) {
  for (const m of String(text ?? '').matchAll(TAG)) {
    const a = Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
    if (!/^\d+$/.test(a.message_id ?? '')) continue;
    const body = m[2].replace(/\s+/g, ' ').trim() || (a.image_path ? '[사진]' : a.attachment_file_id ? '[첨부]' : '');
    out.set(a.message_id, { ts: a.ts, text: body });
  }
  return out;
}

// Only entries the harness itself wrote count: a user turn, or a channel message queued/absorbed mid-turn.
// Tool results and API blobs are skipped, so a channel tag inside fetched web content can't fake a message.
// shortcut: the transcript JSONL format is internal to Claude Code; if it changes this finds nothing and fails open.
export function telegramMessages(transcriptPath) {
  const out = new Map();
  let raw = '';
  try { raw = readFileSync(transcriptPath, 'utf8'); } catch { return out; }
  for (const line of raw.split('\n')) {
    if (!line.includes('plugin:telegram:telegram') || line.startsWith('{"type":"api-request-blob"')) continue; // blobs are huge
    let d;
    try { d = JSON.parse(line); } catch { continue; }
    if (d.type === 'user' && typeof d.message?.content === 'string') parse(d.message.content, out);
    else if (d.type === 'attachment' && d.attachment?.type === 'queued_command' && d.attachment.origin?.kind === 'channel') parse(d.attachment.prompt, out);
    else if (d.type === 'queue-operation' && typeof d.content === 'string') parse(d.content, out);
  }
  return out;
}
export const telegramIds = (p) => new Set(telegramMessages(p).keys());

// Appends messages not yet in inbox.md (by "(msg <id>)"); returns the ids added. Parallel tool calls run this hook at
// the same moment, so each id is claimed once with an exclusive create in system/inbox-seen/ before it is appended.
export function capture(office, msgs, now = Date.now()) {
  const file = join(office, 'system/inbox.md');
  let inbox = '';
  try { inbox = readFileSync(file, 'utf8'); } catch {}
  const added = [], lines = [];
  for (const [id, m] of msgs) {
    if (inbox.includes(`(msg ${id})`)) continue;
    const t = Date.parse(m.ts);
    if (t < now - 7 * 86400000) continue; // already cleaned out of the inbox, don't bring it back
    try { mkdirSync(join(office, 'system/inbox-seen'), { recursive: true }); writeFileSync(join(office, 'system/inbox-seen', id), '', { flag: 'wx' }); } catch { continue; }
    lines.push(`- [ ] ${stamp(new Date(Number.isNaN(t) ? now : t))} (msg ${id}) ${m.text}`);
    added.push(id);
  }
  if (lines.length) {
    mkdirSync(join(office, 'system'), { recursive: true });
    appendFileSync(file, (inbox && !inbox.endsWith('\n') ? '\n' : '') + lines.join('\n') + '\n');
  }
  return added;
}

export function handle(input, office = process.env.NIDUS_OFFICE || input.cwd || '.') {
  if (process.env.NIDUS_GUARD !== '1' || input.agent_id) return null;
  const msgs = telegramMessages(input.transcript_path ?? '');
  if (input.hook_event_name === 'UserPromptSubmit') parse(input.prompt, msgs);
  const added = capture(office, msgs);
  const isStop = !input.hook_event_name || input.hook_event_name === 'Stop';
  if (!isStop || input.stop_hook_active) return null;
  let inbox = '';
  try { inbox = readFileSync(join(office, 'system/inbox.md'), 'utf8'); } catch {}
  const open = (inbox.match(/^- \[ \]/gm) ?? []).length;
  if (!open) return null;
  const note = added.length ? `새 Telegram 메시지 ${added.length}건(msg ${added.join(', ')})을 inbox에 적었다. ` : '';
  return `nidus inbox: ${note}처리하지 않은 inbox 항목 ${open}건이 있다. office 스킬의 "Inbox" 2단계대로 종류·우선순위를 나눠 board에 올린 뒤 [x]로 표시하라.`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let raw = '', reason = null;
  for await (const c of process.stdin) raw += c;
  try { reason = handle(JSON.parse(raw || '{}')); } catch {} // stage 1 must never break the session
  if (reason) { console.error(reason); process.exit(2); }
}
