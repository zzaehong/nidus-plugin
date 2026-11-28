# Nidus Plugin v0 — 공식 문서 검증 기록

검증일: 2026-11-24. 방법: 공식 문서 페이지를 읽은 하위 에이전트의 보고를 정리했다. 표기: **확인** = 공식 페이지에서 읽음, **미확인** = 읽지 못했거나 문서에 없음. 인용 문구는 원문 재확인이 필요하면 각 URL에서 다시 본다.

## 1. 플러그인 형식 — 확인
출처: https://code.claude.com/docs/en/plugins-reference.md
- 매니페스트는 `.claude-plugin/plugin.json`. 필수는 `name`(kebab-case)뿐. 선택: version, description, author, skills, commands, agents, hooks, mcpServers, userConfig, dependencies 등.
- 매니페스트만 `.claude-plugin/` 안에 두고 나머지는 플러그인 루트: `skills/<name>/SKILL.md`, `commands/*.md`, `agents/*.md`, `hooks/hooks.json`(최상위 `"hooks"` 키 필요), `.mcp.json`, `bin/`(Bash PATH에 추가).
- 플러그인 루트의 `CLAUDE.md`는 로드되지 않는다(validate가 경고).
- 검증: `claude plugin validate ./plugin` (`--strict`는 경고도 실패 처리). 로컬 시험: `--plugin-dir <경로>`(headless 문서에서 확인).
- 설치·배포(marketplace) 상세: `plugins/install.md`, `plugins/publish.md`로 링크만 확인, **미확인**.

## 2. 훅 — 확인
출처: https://code.claude.com/docs/en/hooks.md
- 이벤트 33종. 이 프로젝트에 쓸 것: `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`, `SessionEnd`, `WorktreeCreate`, `WorktreeRemove`.
- stdin JSON 공통 필드: `session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`. PreToolUse는 `tool_name`, `tool_input`, `tool_use_id` 추가. 서브에이전트 안에서는 `agent_id`, `agent_type`도 온다.
- **차단 방법**: exit code 2 + stderr(사유), 또는 exit 0 + `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"..."}}`. exit 2가 우선하며 `continue:false`만으로는 차단되지 않는다. 다른 0 아닌 코드는 비차단 오류.
- 훅은 서브에이전트의 도구 호출에도 발동한다.
- 플러그인 훅에서 `${CLAUDE_PLUGIN_ROOT}` 사용 가능(환경변수로도 노출).
- 훅 입력에 토큰·비용 필드는 **없다**.

## 3. 토큰 사용량 읽기 — 일부 확인, 핵심은 불안정
- 대화 기록(`~/.claude/projects/<project>/<session-id>.jsonl`) 형식은 공식적으로 "내부 형식이며 버전마다 바뀌어 직접 파싱하는 스크립트는 깨질 수 있다"고 명시(sessions.md). `message.usage` 필드 사용은 **문서로 보증되지 않는다**.
- 서브에이전트 기록은 `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl`(+ `.meta.json`) — sub-agents.md. 보존 기간 `cleanupPeriodDays` 기본 30일.
- 공식 경로: `claude -p --output-format json`(`total_cost_usd`, `usage`, 모델별), statusline stdin(`cost.*`, `context_window.*`), OpenTelemetry(`claude_code.token.usage`, 속성 `query_source: main|subagent`), 대화형 `/usage`(구독 한도 막대, 스킬·서브에이전트·플러그인별 기여). 출처: headless.md, statusline.md, monitoring-usage.md, costs.md.
- `/cost`는 별도 항목으로 확인 못 함(**미확인**). `/usage`의 세션 금액은 Pro/Max에서 과금 지표가 아니다.

## 4. 서브에이전트·모델 — 확인(한도 영향은 미확인)
출처: https://code.claude.com/docs/en/sub-agents.md, model-config.md
- 필수: `name`, `description`. 선택: `tools`, `disallowedTools`, `model`, `maxTurns`, `skills`, `effort`, `isolation: worktree` 등. `model` 값: `sonnet|opus|haiku|fable`, 전체 ID, `inherit`.
- **플러그인 서브에이전트는 `hooks`, `mcpServers`, `permissionMode` frontmatter가 무시된다.** 즉 안전 규칙은 에이전트 frontmatter가 아니라 플러그인의 `hooks/hooks.json`에 둬야 한다.
- Pro에서 Opus: model-config 문서가 "Pro … 기본 Opus 5.5"라고 적음 → 사용 가능. 1M 컨텍스트 변형은 Pro에서 usage credits 필요.
- Opus가 5시간·주간 한도를 얼마나 더 쓰는지는 공식 문서에 **없음**(제3자 글만 있음, 미확인). 장부로 직접 측정해야 한다.

## 5. 예약 실행 — 확인(일부 미확인)
출처: https://code.claude.com/docs/en/scheduled-tasks.md, routines.md, desktop-scheduled-tasks.md, headless.md
| 방식 | 실행 위치 | 로컬 파일 | 비고 |
|---|---|---|---|
| `/loop` | 내 기기, 세션 열려 있어야 함 | 접근 | 7일 후 만료 |
| Desktop 예약 작업 | 내 기기(켜져 있어야 함), 세션 불필요 | 접근 | 구독 한도 차감 여부 **미확인** |
| Cloud 예약 작업(routines) | Anthropic 클라우드, 신규 clone | **없음** | 최소 1시간, Pro 포함, 구독 한도 차감("대화형 세션과 같은 방식"), 계정당 시간당 100회 상한 |
| GitHub Actions | — | — | 문서 **미확인** |
- `claude -p`/Agent SDK: 지원 문서(articles/15036540)의 2026-10-07 갱신본은 "플랜으로 로그인하면 `claude -p`와 Agent SDK는 여전히 구독 한도에서 차감"되고, 6월의 별도 크레딧 분리는 **일시 중단** 상태라고 한다. 월간 API 크레딧은 Max·Ultra·Team 대상이며 Pro는 목록에 없다. 이 내용은 요약기를 거친 인용이므로 과금 판단 전에 원문 재확인 필요.

## 6. 구독 한도 프로그램 조회 — 확인
출처: https://code.claude.com/docs/en/statusline.md
- statusline stdin의 `rate_limits.five_hour.{used_percentage,resets_at}`, `rate_limits.seven_day.{…}`. Pro/Max/Ultra 구독자만, 첫 API 응답 이후에만, 창별로 없을 수 있음.
- 공개 API는 **없음**. OTel에도 한도 지표는 읽은 범위에서 없음.

## 명세 가정과의 차이 (구현 전 결정 필요)
1. **장부(ledger)의 사용량 출처**: 명세 후보였던 transcript의 `usage` 읽기는 비공식·불안정. 대안은 statusline 스크립트가 받는 JSON(세션 누적 비용·토큰·한도%), 또는 OTel. 야간 무인 실행에서 statusline이 도는지는 **미검증**.
2. **서브에이전트 frontmatter 훅 불가**: 안전 훅은 플러그인 `hooks/hooks.json`에서 전역으로 걸어야 하며, worker만 골라 적용하려면 `agent_type`으로 분기해야 한다.
3. **`claude -p`**: 명세는 "의존 금지"였으나 현재 공식 문서상 구독 한도로 도는 것으로 보인다. 다만 요약 인용이라 재확인 전까지 v0는 기존 방침(회피)을 유지하는 편이 안전하다.
4. **야간 예약**: Cloud 예약은 로컬 파일이 없어 Vault/worktree 구조와 맞지 않는다. Desktop 예약 작업(맥미니)이 맞지만 한도 차감 여부는 미확인이므로 첫 실행에서 `/usage`로 직접 측정해야 한다.
5. **레포 구조**: 명세의 `nidus-v0/`는 새 레포를 전제하나, 이 레포에는 이미 `plugin/` 초안(manager/worker, Obsidian library)이 있다.

---

# 추가 검증 (2026-11-24, 방향 전환: 상시 관리자 세션 + Telegram)

## Channels — 확인
출처: https://code.claude.com/docs/en/channels, https://code.claude.com/docs/en/channels-reference
- 실행 중인 세션으로 외부 이벤트를 밀어 넣는 MCP 서버. **research preview**(문법·프로토콜 변경 가능). Pro/Max/Ultra 개인은 `--channels`로 세션마다 opt-in. 각 채널 플러그인은 **Bun** 필요.
- 공식 채널: Telegram, Discord, iMessage(+ fakechat 데모). **Slack은 채널 없음**(Claude in Slack은 클라우드 세션을 따로 띄움).
- Telegram: BotFather `/newbot` → `/plugin install telegram@claude-plugins-official` → `/telegram:configure <token>` → `claude --channels plugin:telegram@claude-plugins-official` → 봇에 메시지 → `/telegram:access pair <code>` → `/telegram:access policy allowlist`.
- 세션이 열려 있을 때만 수신. Claude는 플러그인의 `reply` 도구로 답장. 
- **실측 확인(2026-11-24)**: 수신 메시지 없이 선제로 보내기 됨(`chat.md`에 기록한 chat_id로 `reply`), chat_id 기록 됨.
- **미확인**: 권한 요청 중계(`claude/channel/permission`)를 Telegram 플러그인이 지원하는지.
- 보안: 발신자 allowlist(from.id 기준). 문서: "An ungated channel is a prompt injection vector". 중계가 켜지면 allowlist의 누구나 도구 사용을 승인할 수 있다.

## 무인 권한 — 확인
출처: https://code.claude.com/docs/en/permission-modes
- 선택지: `--permission-mode dontAsk --allowedTools ...`(잠금), `--permission-mode auto`(분류기, 전 플랜, "안전 보장 아님"), `--dangerously-skip-permissions`(컨테이너·VM에서만). 이 프로젝트는 auto + guard 훅.

## /loop — 확인
출처: https://code.claude.com/docs/en/scheduled-tasks
- `/loop 5m <prompt>`(고정, 최소 1분) / `/loop <prompt>`(자율 간격 1~60분). 세션이 열려 있고 idle일 때만 발동, 놓친 실행은 따라잡지 않음, **7일 후 만료**, 세션당 최대 50개. `--resume`은 cron만 복구. 매 회 전체 컨텍스트를 보내 한도를 쓴다.

## 서브에이전트·Agent teams — 확인
출처: https://code.claude.com/docs/en/sub-agents, https://code.claude.com/docs/en/agent-teams
- 백그라운드 서브에이전트는 동시 실행(기본 20개). 각자 같은 한도에서 토큰을 쓴다.
- Agent teams는 실험적(`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`), 팀원 plan 모드 시 약 7배 토큰. → 제외.

## 알림 대안 — 확인
출처: https://code.claude.com/docs/en/remote-control
- Remote Control(Pro 가능): 폰 Claude 앱/claude.ai/code로 로컬 세션 조작. PushNotification 도구는 Remote Control이 켜져 있을 때 폰 푸시. Telegram 선제 알림이 안 되면 이쪽을 쓴다.

## 로컬 확인
- `claude plugin validate plugin`(v2.1.330): 통과(경고: author·LICENSE·icon 없음 — 마켓 제출 시에만 필요).
- 실측(2026-11-24, Pro): Telegram 지시 "NVDA 분석"이 처음부터 끝까지 정상 동작(task → worker 4관점 순차 → 검토 → Telegram 보고). 한도 소모는 5시간 한도의 약 4%(`/usage`). 주간 한도 소모는 미측정.
- 실측(2026-11-25): 맥미니 재부팅 → 로그인 후 watchdog(launchd)이 `nidus` 세션을 다시 띄우고 Telegram 재시작 알림이 옴. 단, 볼트는 한 번 직접 신뢰해 둬야 함(`--add-dir` 승인은 세션마다 사라져 확인 화면에서 멈춤). SwiftBar 메뉴바 아이콘은 SwiftBar의 Launch at Login을 켜야 재부팅 후 뜸.

---

# 추가 검증 (2026-11-27, 0.4.0: 팀 폴더 + 동시 분배)

## 서브에이전트 동시 실행·훅 입력 — 실측 확인
출처: https://code.claude.com/docs/en/sub-agents, https://code.claude.com/docs/en/hooks, 임시 플러그인(`tprobe`)을 `claude -p --plugin-dir`로 실행(v2.1.332)
- 메인 대화에서 띄운 커스텀 서브에이전트는 기본으로 백그라운드에서 시작하고, 끝나면 다음 턴에 완료 알림이 온다. 동시 실행 기본 상한 20(`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`).
- 한 메시지에서 두 에이전트를 띄우면 동시에 돌았다. 각 PreToolUse 입력에 `agent_id`와 `agent_type: "<플러그인>:<에이전트>"`(예: `tprobe:probe`)가 들어온다 → guard의 `nidus:builder` 완전 일치 판정이 동시 실행에서도 유효.
- `SubagentStart`·`SubagentStop` 입력에 `agent_id`·`agent_type`이 있고, Stop에는 `last_assistant_message`·`agent_transcript_path`도 있다 → `hooks/running.mjs`가 `system/running/<agent_id>`로 돌고 있는 워커를 기록.
- 백그라운드 서브에이전트도 frontmatter의 도구(Read·Write·WebSearch·WebFetch·Bash)를 받았다. 문서는 "백그라운드는 더 작은 기본 도구 세트"라고 적지만 이 구성에서는 빠진 도구가 없었다.
- `claude -p`(기본 권한 모드)에서는 워커의 Write가 권한 확인으로 거절됐다. 실제 세션과 같은 auto 모드에서는 확인 화면 없이 썼다(아래 중첩 서브에이전트 실측).

## 구독 사용량 — 문서 확인
출처: https://code.claude.com/docs/en/statusline
- 상태 줄 stdin의 `rate_limits.five_hour`·`seven_day`(`used_percentage`, `resets_at` 초 단위)는 Pro·Max·Ultra에서, 첫 API 응답 뒤에만 들어온다. 상태 줄은 새 응답·`/compact`·권한 모드 변경 등에서 다시 실행된다(300ms 디바운스).
- `office.sh`가 `--settings`로 상태 줄을 `scripts/nidus-usage.mjs`로 지정해 `system/usage.json`에 저장한다. 실제 세션에서 `refreshInterval: 60`으로 관리자가 조용한 동안에도 60초마다 다시 써지는 것을 확인했다(2026-11-28, 17:10:02 → 17:11:02 UTC).

## 그 밖의 확인
- `tmux display-message -p -t nidus '#{pane_current_path}'`가 office 경로를 준다 → 메뉴바(`nidus-state.sh`)가 설정 없이 `system/running/`을 찾는다.
- **미확인**: 동시 실행 때 한도 소모(task별 `Result`의 사용량 기록으로 쌓아 측정), Red Team 1회의 비용.

## 중첩 서브에이전트(그룹 관리자) — 실측 확인 (2026-11-28)
출처: https://code.claude.com/docs/en/sub-agents (중첩은 문서 요약에서 확인), 임시 플러그인 실측(v2.1.332)
- 서브에이전트는 기본으로 자기 서브에이전트를 띄울 수 있다(메인 아래 최대 3단, `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`). 메인 → lead → worker는 2단이다.
- 실제 세션과 같은 조건(대화형 tmux, `--permission-mode auto`)에서 백그라운드로 띄운 lead가 `Agent` 도구로 probe 둘을 한 메시지에 띄웠고, 둘이 동시에 돌았다. 중첩된 쪽의 PreToolUse에도 `agent_type: "tprobe:probe"`가 들어와 guard의 역할 판정이 그대로 통한다.
- 중첩된 워커의 Write가 확인 화면 없이 통과했다(auto 모드, `~/Developer` 아래). → 0.4.0에서 미확인이던 "백그라운드 워커가 확인 화면에 걸리는지"도 이걸로 확인.
- lead는 워커를 띄운 뒤 턴을 끝내고(SubagentStop), 워커가 끝나면 알림으로 다시 깨어난다(SubagentStart). 그래서 lead가 오래 붙잡혀 있지 않고, 상태는 desk 파일에 남기면 된다.
- Agent teams(실험적, 세션 하나에 팀 하나, `-p`에서 안 됨, 토큰 많음)와 팀별 상시 세션(cross-session 메시지)은 검토 후 쓰지 않았다(사용자 결정: 일 단위로 띄우는 서브에이전트).
- 직접 만든 채널은 `--dangerously-load-development-channels`가 필요하고 시작할 때 경고 화면이 떠서 무인 재시작과 맞지 않는다. Telegram은 `obsidian://` 링크를 누를 수 있게 보내지 않는다(실측, 텍스트만 옴).

## guard 점검 — 실측 확인 (2026-11-28)
메인 세션이 플러그인을 스스로 점검한 결과를 바탕으로 고쳤다(0.4.0).
- PreToolUse 훅은 종료 코드 2만 차단이다. guard가 예외로 죽으면 node가 1로 끝나 그 호출이 통과했다(세션이 확인). → 예외를 잡아 2로 막는다.
- 워커의 "office는 `tasks/`에만" 규칙이 Write·Edit에만 걸려 있어 `echo … >> jobs.md` 같은 Bash 쓰기는 통과했다. → builder가 아닌 서브에이전트의 Bash 쓰기 명령은 모두 막는다. 스크립트가 스스로 쓰는 경우는 여전히 못 막는다(샌드박스 필요).
- 오탐: `\.env\b`가 `process.env`에, `>`가 `=>`에 걸렸고, 읽기 전용 경로에서 복사하는 `cp`도 쓰기로 막혔다.
- 실제 `jobs.md`는 CronCreate로 등록하는데 스킬은 `/loop`만 적고 있었다. 세션이 정상 재시작이 아닌 경우(`NIDUS_RESTARTED=1`)에는 `handoff.md`를 읽으라는 안내가 없었다.
- `npm test`를 세션 안에서 돌리면 `NIDUS_*` 환경 변수가 테스트에 섞였다. → test 스크립트가 지우고 돌린다.
- 반영할 때 세션을 끌 필요는 없었다: 수정은 worktree에서 하고, 세션이 handoff를 쓴 뒤 대기일 때 `system/restart-request`를 만들면 watchdog이 1분 안에 재시작했다(15:52).

## Telegram 메시지가 transcript에 남는 모양 — 실측 (2026-11-28)
- 턴을 시작한 메시지는 `type: "user"`(문자열 content)로, 작업 중에 와서 흡수된 메시지는 `type: "attachment"`·`attachment.type: "queued_command"`(`prompt`, `origin.kind: "channel"`)와 `type: "queue-operation"`(`content`)로 남는다. 실제 transcript에서 뒤쪽으로만 남은 메시지가 11건 있었다.
- 태그 형식: `<channel source="plugin:telegram:telegram" chat_id message_id user user_id ts="ISO">\n본문\n</channel>`. `tool_result`·`api-request-blob` 안의 태그는 세지 않는다(웹 내용으로 가짜 메시지를 만들 수 없게).
