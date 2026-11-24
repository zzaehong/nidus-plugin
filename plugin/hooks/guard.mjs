#!/usr/bin/env node
// PreToolUse guard: stdin JSON -> exit 2 + stderr to block. Active only when NIDUS_GUARD=1 (set by scripts/office.sh).
import { realpathSync, existsSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

const PROTECTED = /^\+?(main|master)$/;
const SECRETS = /(\.ssh|\.aws|\.gnupg|Library\/Keychains|\.env\b|id_rsa|id_ed25519)/;

function branchOf(cwd) {
  try { return execFileSync('git', ['-C', cwd, 'branch', '--show-current'], { encoding: 'utf8' }).trim(); } catch { return ''; }
}

// shortcut: tokenizes by whitespace and splits on ; && || |, so quoted/eval'd/obfuscated pushes slip through; upgrade to a real shell parser if workers get adversarial.
export function checkBash(cmd, cwd) {
  for (const seg of cmd.split(/&&|\|\||;|\||\n/)) {
    const t = seg.trim().split(/\s+/);
    const i = t.indexOf('push');
    if (t[0] !== 'git' && !t.includes('git')) continue;
    if (i < 0) continue;
    const args = t.slice(i + 1);
    const flags = args.filter((a) => a.startsWith('-'));
    const refs = args.filter((a) => !a.startsWith('-'));
    if (flags.some((f) => /^(--force|--force-with-lease(=.*)?|--mirror|--all|-[a-z]*f[a-z]*)$/.test(f)))
      return 'force/mirror/all push 금지';
    const targets = refs.slice(1).flatMap((r) => r.split(':').slice(-1));
    if (targets.some((r) => PROTECTED.test(r.replace(/^refs\/heads\//, '')))) return 'main/master push 금지';
    if (refs.length < 2 && PROTECTED.test(branchOf(cwd))) return 'main/master 브랜치에서 push 금지';
  }
  if (SECRETS.test(cmd)) return '자격 증명 경로 접근 금지';
  // The office folder may live inside the read-only vault; paths under it don't count as vault paths.
  const outside = cwd ? cmd.replace(new RegExp(cwd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + `(?=[/\\s'"]|$)`, 'g'), '') : cmd;
  // shortcut: keyword match only; misses writes via scripts/aliases. Upgrade to sandboxing if a worker tries.
  for (const ro of readonlyPaths())
    if (outside.includes(ro) && /(>|\brm\b|\bmv\b|\bcp\b|\btee\b|\bsed\s+-i|\btouch\b|\bmkdir\b|(^|[\s;&|(])sqlite3\s+(?!.*(-readonly|mode=ro)))/.test(cmd))
      return `읽기 전용 경로 쓰기 금지: ${ro}`;
  return null;
}

const readonlyPaths = () => (process.env.NIDUS_READONLY ?? '').split(':').filter(Boolean);

export function checkWrite(path, cwd) {
  const abs = resolve(cwd, path);
  let p = abs;
  while (!existsSync(p) && dirname(p) !== p) p = dirname(p); // resolve symlinks of nearest existing parent
  const real = resolve(realpathSync(p), abs.slice(p.length + 1));
  const root = realpathSync(cwd);
  if (real !== root && !real.startsWith(root + sep)) return `작업 폴더(${root}) 밖 쓰기 금지: ${real}`;
  if (SECRETS.test(real)) return '자격 증명 경로 쓰기 금지';
  return null;
}

export function decide(input) {
  if (process.env.NIDUS_GUARD !== '1') return null;
  const ti = input.tool_input ?? {};
  if (input.tool_name === 'Bash') return checkBash(ti.command ?? '', input.cwd);
  if (['Write', 'Edit', 'NotebookEdit'].includes(input.tool_name))
    return checkWrite(ti.file_path ?? ti.notebook_path ?? '', input.cwd);
  if (input.tool_name === 'Read' && SECRETS.test(ti.file_path ?? '')) return '자격 증명 경로 읽기 금지';
  return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let raw = '';
  for await (const c of process.stdin) raw += c;
  const reason = decide(JSON.parse(raw));
  if (reason) { console.error(`nidus guard: ${reason}`); process.exit(2); }
}
