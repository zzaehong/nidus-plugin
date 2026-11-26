#!/usr/bin/env node
// PreToolUse guard: stdin JSON -> exit 2 + stderr to block. Active only when NIDUS_GUARD=1 (set by scripts/office.sh).
import { realpathSync, existsSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

const PROTECTED = /^\+?(main|master)$/;
const SECRETS = /(\.ssh|\.aws|\.gnupg|Library\/Keychains|\.env\b|id_rsa|id_ed25519)/;
// Files Claude Code or git load and run later: a planted one could switch hooks off or fake an agent.
const CONFIG = /(^|\/)(\.claude(\/|$)|CLAUDE\.md$|\.mcp\.json$|\.git\/(hooks|config)(\/|$))/;
const CONFIG_CMD = /(\.claude\/|CLAUDE\.md|\.mcp\.json|\.git\/hooks|\.git\/config)/;
const GIT_CONFIG_RUN = /\bgit\s+config\b.*\b(core\.(hooksPath|fsmonitor|sshCommand|pager|editor)|alias\.)/;
const BUILDER = 'nidus:builder'; // exact plugin agent id (meta.json shows "nidus:worker" for the worker)

function branchOf(cwd) {
  try { return execFileSync('git', ['-C', cwd, 'branch', '--show-current'], { encoding: 'utf8' }).trim(); } catch { return ''; }
}

// shortcut: tokenizes by whitespace and splits on ; && || |, so quoted/eval'd/obfuscated pushes slip through; upgrade to a real shell parser if workers get adversarial.
export function checkBash(cmd, cwd, builder = false, office = cwd) {
  let dir = cwd;
  for (const seg of cmd.split(/&&|\|\||;|\||\n/)) {
    const t = seg.trim().split(/\s+/);
    if (t[0] === 'cd' && t[1]) dir = resolve(dir ?? '/', t[1].replace(/^~(?=\/|$)/, process.env.HOME ?? '~'));
    const c = t.indexOf('-C');
    const repo = c >= 0 && t[c - 1] === 'git' ? resolve(dir ?? '/', t[c + 1] ?? '') : dir;
    const i = t.indexOf('push');
    if (t[0] !== 'git' && !t.includes('git')) continue;
    if (i < 0) continue;
    const args = t.slice(i + 1).filter((a, k, all) => a !== '-C' && all[k - 1] !== '-C');
    const flags = args.filter((a) => a.startsWith('-'));
    const refs = args.filter((a) => !a.startsWith('-'));
    if (flags.some((f) => /^(--force|--force-with-lease(=.*)?|--mirror|--all|-[a-z]*f[a-z]*)$/.test(f)))
      return 'force/mirror/all push 금지';
    const targets = refs.slice(1).flatMap((r) => r.split(':').slice(-1));
    if (targets.some((r) => PROTECTED.test(r.replace(/^refs\/heads\//, '')))) return 'main/master push 금지';
    if (refs.length < 2 && PROTECTED.test(branchOf(repo))) return 'main/master 브랜치에서 push 금지';
  }
  if (SECRETS.test(cmd)) return '자격 증명 경로 접근 금지';
  // shortcut: only catches commands that name the path; `grep -r` on a parent folder still reads it. Upgrade with a sandbox.
  for (const n of noreadPaths()) if (mentions(cmd, n)) return `읽기 금지 경로: ${n}`;
  if (GIT_CONFIG_RUN.test(cmd)) return '실행되는 git 설정(hooksPath·fsmonitor·alias 등) 변경 금지';
  // shortcut: keyword lists, same limits as below; scripts or other languages can still reach the network or write.
  if (builder && /(^|[\s;&|(])(curl|wget|nc|ncat|telnet|lynx|w3m|aria2c|http|https)\s/.test(cmd))
    return 'builder는 웹에 접근할 수 없다 (리서치는 worker가 한다)';
  const writes = WRITES.test(cmd.replace(/\d*>&\d|&?\d*>+\s*\/dev\/null/g, '')); // 2>&1, >/dev/null are not writes
  if (!writes) return null;
  if (CONFIG_CMD.test(cmd)) return '.claude/·CLAUDE.md·.mcp.json·.git/hooks 쓰기 금지';
  // The office folder may live inside the read-only vault; paths under it don't count as vault paths.
  const outside = office ? cmd.replace(new RegExp(office.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + `(?=[/\\s'"]|$)`, 'g'), '') : cmd;
  // shortcut: keyword match only (paths named in the command, or the dir it cd's into); misses writes via scripts/aliases.
  const hits = (p) => mentions(outside, p) || (dir && !inside(dir, office ?? '') && inside(dir, p));
  for (const ro of readonlyPaths()) if (hits(ro)) return `읽기 전용 경로 쓰기 금지: ${ro}`;
  if (!builder) for (const w of writablePaths()) if (hits(w)) return `${w} 쓰기는 builder만 할 수 있다`;
  return null;
}

const HOME = process.env.HOME ?? '';
const mentions = (cmd, p) => cmd.includes(p) || (HOME && inside(p, HOME) && cmd.includes('~' + p.slice(HOME.length)));
const WRITES =/(>|\brm\b|\bmv\b|\bcp\b|\btee\b|\bsed\s+-i|\btouch\b|\bmkdir\b|(^|[\s;&|(])sqlite3\s+(?!.*(-readonly|mode=ro)))/;
const writablePaths = () => (process.env.NIDUS_WRITABLE ?? '').split(':').filter(Boolean);
const readonlyPaths = () => (process.env.NIDUS_READONLY ?? '').split(':').filter(Boolean);
const noreadPaths = () => (process.env.NIDUS_NOREAD ?? '').split(':').filter(Boolean);
function inside(p, root) { return p === root || p.startsWith(root + sep); }
function realOf(path, cwd) {
  const abs = resolve(cwd, path);
  let p = abs;
  while (!existsSync(p) && dirname(p) !== p) p = dirname(p); // resolve symlinks of nearest existing parent
  return resolve(realpathSync(p), abs.slice(p.length + 1));
}
const noreadHit = (real, search) =>
  noreadPaths().find((n) => { const r = realOf(n, '/'); return inside(real, r) || (search && inside(r, real)); });

// search=true (Grep/Glob): a search rooted above a noread path would still return its contents, so that counts too.
export function checkRead(path, cwd, search = false) {
  const real = realOf(path, cwd);
  if (SECRETS.test(real)) return '자격 증명 경로 읽기 금지';
  const n = noreadHit(real, search);
  return n ? `읽기 금지 경로: ${n}${search ? ' (이 경로를 포함하지 않는 하위 폴더를 지정해 검색하라)' : ''}` : null;
}

export function checkWrite(path, cwd, builder = false, office = cwd) {
  const real = realOf(path, cwd);
  const root = realpathSync(office);
  if (SECRETS.test(real)) return '자격 증명 경로 쓰기 금지';
  const n = noreadHit(real, false);
  if (n) return `읽기 금지 경로: ${n}`;
  if (CONFIG.test(real)) return `.claude/·CLAUDE.md·.mcp.json·.git/hooks 쓰기 금지: ${real}`;
  if (inside(real, root)) return null; // office folder, even when it sits inside the read-only vault
  const ro = readonlyPaths().find((r) => inside(real, r));
  if (ro) return `읽기 전용 경로 쓰기 금지: ${ro}`;
  if (writablePaths().some((w) => inside(real, w)))
    return builder ? null : `${real}: ~/Developer 쓰기는 builder만 할 수 있다 (관리자·worker는 office에만 쓴다)`;
  return `작업 폴더(${root}) 밖 쓰기 금지: ${real}`;
}

export function decide(input) {
  if (process.env.NIDUS_GUARD !== '1') return null;
  const ti = input.tool_input ?? {};
  const builder = input.agent_type === BUILDER; // agent_type is only set inside subagents
  // The office root is fixed by office.sh; input.cwd follows the shell, which may have cd'd into ~/Developer.
  const office = process.env.NIDUS_OFFICE || input.cwd;
  if (builder && ['WebFetch', 'WebSearch'].includes(input.tool_name)) return 'builder는 웹에 접근할 수 없다';
  if (input.tool_name === 'Bash') return checkBash(ti.command ?? '', input.cwd, builder, office);
  if (['Write', 'Edit', 'NotebookEdit'].includes(input.tool_name))
    return checkWrite(ti.file_path ?? ti.notebook_path ?? '', input.cwd, builder, office);
  const cwd = input.cwd || office;
  if (input.tool_name === 'Read') return checkRead(ti.file_path ?? '', cwd);
  if (['Grep', 'Glob'].includes(input.tool_name)) return checkRead(ti.path || cwd, cwd, true);
  return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let raw = '';
  for await (const c of process.stdin) raw += c;
  const reason = decide(JSON.parse(raw));
  if (reason) { console.error(`nidus guard: ${reason}`); process.exit(2); }
}
