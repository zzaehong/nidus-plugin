# nidus plugin

맥미니에 상시로 켜 두는 관리자 세션. Telegram으로 지시·알림을 주고받고, 팀 폴더의 멤버에게 일을 나눠 사용량에 맞춰 동시에 돌리고, 결과를 직접 검토하고 Red Team이 심사한다. Obsidian 볼트는 읽기 전용 library.

## 구성
- `skills/office` 관리자 절차(지시 → task 파일 → Completion Contract → 팀 멤버 동시 분배 → 검토 → Red Team → Telegram 보고, 사용량에 따른 동시 실행 수, 반복 작업 `jobs.md` + `/loop`)
- `teams/` 예시 팀(`stock` 주식 4관점, `dev` 코딩). 처음 실행할 때 office의 `teams/`로 복사되고, 그 뒤로는 office 쪽을 고친다. 새 팀은 폴더를 복사해 만든다.
- `agents/worker` 리서치 워커(Sonnet). 웹 O, `~/Developer` 쓰기 X. Telegram 도구 없음.
- `agents/redteam` Red Team(Sonnet). 종합한 결론만 받아 공격하고 Pass·Revise·Conflict로 판정. 웹 O, 쓰기는 결과 파일만.
- `agents/builder` 코딩 워커(Sonnet). `~/Developer` 쓰기 O, 웹 X(도구 없음 + curl·wget 차단). worker가 office에 남긴 리서치만 읽는다. 웹에서 들어온 지시가 쓰기 권한으로 바로 이어지지 않게 둘을 나눴다.
- `bin/af-query` (선택) Asset_Frame 형식 SQLite 시세 DB 읽기 전용 조회. 경로는 `AF_DB`(기본 `~/Developer/Asset_Frame/var/asset_frame.sqlite3`). 없으면 stock 팀은 웹 출처를 쓴다.
- `hooks/guard.mjs` `NIDUS_GUARD=1`일 때 [권한 설정](#권한-설정)을 지킨다. 쓰기는 office 폴더(누구나)와 `writable`(builder만)에만, `readonly`·고정 보호 경로는 누구도 못 씀, `noread`는 누구도 못 읽음. main/force push, 자격 증명 경로 차단. office를 볼트 안에 두면 볼트에서 그 폴더만 쓰기 허용
- `hooks/running.mjs` SubagentStart/Stop 훅. 돌고 있는 워커를 `system/running/`에 적어 watchdog·메뉴바가 백그라운드 작업을 알게 한다.
- 상태 줄 `scripts/nidus-usage.mjs`(office.sh가 `--settings`로 지정): 5시간·7일 사용량을 보여 주고 `system/usage.json`에 저장한다.
- `hooks/inbox.mjs` Stop 훅. 작업 중 온 Telegram 메시지는 `system/inbox.md`에 `- [ ]`로 적히고, 남아 있으면 응답을 끝내지 못하게 막아 처리하게 한다.

## office 폴더
- `00.dashboard.md` 검토 대기·막힘·진행 중·최근 완료·반복 작업. 여기만 보면 된다.
- `outputs/<분야>/<대상>.md` 결과물. 대상마다 문서 하나를 계속 갱신(현재 판단 → 확인할 점 → 변경 이력). 바뀌면 `review: 대기`, 읽고 나면 Obsidian에서 `확인`으로.
- `teams/<팀>/TEAM.md`·`desk.md` 팀 정의와 팀의 이어받을 맥락. 워커는 못 쓰고 관리자와 사용자만 고친다.
- `tasks/YYYY-MM/<id>/report.md` + `workers/` 작업 기록. `jobs.md` 반복 작업. `system/` chat_id·handoff·watchdog 기록.

## 준비 (1회)
1. `brew install bun tmux`
2. Telegram BotFather `/newbot` → 토큰 복사
3. Claude Code에서 `/plugin install telegram@claude-plugins-official` → `/telegram:configure <토큰>`
4. `scripts/office.sh <볼트 경로> <office 폴더>`로 시작 → 봇에 메시지 → `/telegram:access pair <코드>` → `/telegram:access policy allowlist`
5. (선택) 자동 재시작: `scripts/watchdog.sh install <볼트 경로> <office 폴더>` — launchd가 1분마다 `nidus` 세션을 확인한다.
   - 없으면 다시 띄워 `/loop` 재등록 + Telegram 알림. 30분에 3회까지만, 넘으면 watchdog이 Bot API로 직접 알림.
   - 승인 대기 3분, 작업 중 60분이 넘으면 Bot API로 직접 알림(멈춤 의심). 토큰은 Telegram 플러그인의 `.env`에서 읽는다.
   - "대기 상태"는 관리자 화면이 대기이고 `system/running/`에 돌고 있는 워커가 없을 때다. 백그라운드 워커가 돌면 작업 중으로 본다(메뉴바 창문도 노랑).
   - Telegram 연결이 끊기면(플러그인 `bot.pid`의 server.ts 프로세스가 없음) 2분 뒤 대기 상태일 때 handoff 후 재시작. 작업 중이면 끝날 때까지 기다리고, 30분 넘게 끊겨 있으면 Bot API로 직접 알림. 재시작 상한은 오류 재시작과 공유. 메뉴바 창문은 빨강.
   - 세션이 스스로 재시작을 요청할 수 있다: `handoff.md`를 쓰고 `system/restart-request`를 만들면 대기 상태일 때(늦어도 10분 뒤) 재시작. 세션은 `$NIDUS_WATCHDOG notify`로 Telegram 채널 없이도 알림을 보낼 수 있다. 절차는 office 스킬 "Telegram이 안 될 때".
   - 매일 06~08시(설정 `tz`, 기본 Asia/Seoul) 사이 대기 상태이고 진행 중 task가 없으면 `system/handoff.md`를 쓰게 한 뒤 재시작(컨텍스트 정리 + `/loop` 7일 만료 대응). 재시작한 세션은 이어 간 일을 Telegram으로 알림. 8시까지 못 하면 그날은 건너뛰고 알림.
   - 기록: `<office>/system/events.md`. 전송 확인: `scripts/watchdog.sh notify <office 폴더> 테스트`. 로그 `~/Library/Logs/nidus-watchdog.log`. 일부러 끌 때는 먼저 `scripts/watchdog.sh uninstall`(안 그러면 1분 안에 다시 뜸). 로그인한 뒤에만 동작한다. 재시작이 확인 화면에서 멈추지 않도록 볼트와 `writable` 폴더(기본 `~/Developer`)는 각각 한 번 `cd <폴더> && claude`로 신뢰해 둔다(`--add-dir` 승인은 세션마다 사라짐).
6. (선택) 메뉴바 상태: `brew install --cask swiftbar` → 플러그인 폴더 선택 → `ln -s "$PWD/scripts/nidus-status.10s.sh" <플러그인 폴더>/`. 흰 집 아이콘의 창문 색: 초록 대기 · 노랑 작업 중(불 켜고 일함) · 주황 승인 대기(사람 필요) · 빨강 Telegram 끊김 · 어두움 꺼짐, 클릭하면 tmux attach·로그.

## 권한 설정
`~/.config/nidus/config`에 적는다(없으면 기본값). 고친 뒤 세션을 재시작하면 반영된다(`tmux kill-session -t nidus` → watchdog이 다시 띄움). 한 줄에 하나, 같은 키를 여러 번 쓰면 목록이 된다. 경로는 절대 경로나 `~/...`, `'`와 `:`는 쓸 수 없다. 값이 잘못되면 세션이 시작되지 않고 이유를 출력한다.
```
# builder만 쓸 수 있는 폴더. 없으면 ~/Developer 하나. 각각 세션에 --add-dir로 붙는다. 홈 폴더 전체는 안 된다.
writable = ~/Developer
writable = ~/Projects

# writable 안에서도 누구도 못 쓰는 경로 (예: 레포 안의 데이터 DB)
readonly = ~/Developer/Asset_Frame/var

# 누구도 못 읽는 경로
noread = ~/Documents/private

# 일일 재시작(06~08시) 시간대. 기본 Asia/Seoul
tz = Asia/Seoul
```
- 설정으로 끌 수 없는 보호: 볼트(office 폴더 제외)·이 레포·`~/.config/nidus`·`~/Library/LaunchAgents`는 쓰기 금지, 자격 증명 경로(`.ssh`, `.env` 등)는 읽기·쓰기 금지, `.claude/`·`CLAUDE.md`·`.git/hooks`는 쓰기 금지. 읽기 전용이 쓰기 허용보다 우선한다.
- 웹은 worker만, `writable` 쓰기는 builder만 쓴다(역할 분리는 설정으로 바꾸지 않는다).
- `noread`의 한계: Read·Grep·Glob 도구는 훅이 막고, 그 경로를 품은 상위 폴더 검색도 막는다(예: `noread`가 볼트 안이면 볼트 전체 검색은 거절되고 하위 폴더를 지정해야 한다). Bash는 명령에 그 경로가 적혀 있을 때만 막으므로 상위 폴더에 `grep -r`을 돌리면 읽힐 수 있다. 정말 민감한 파일은 이 Mac에 두지 않는 편이 낫다.
- `af-query`의 DB 경로는 환경 변수 `AF_DB`(기본 `~/Developer/Asset_Frame/var/asset_frame.sqlite3`).

## Telegram이 안 될 때 (사람용)
보통은 자동으로 복구된다: watchdog이 채널 끊김을 감지하거나 세션이 재시작을 요청해 handoff 후 재시작한다. 메뉴바 창문이 빨강이면 끊긴 상태다.
1. `tail ~/Library/Logs/nidus-watchdog.log`, `<office>/system/events.md`에서 재시작 기록과 "한도라 보류"를 본다.
2. 세션만 다시 붙이기: `tmux attach -t nidus` → `/mcp` → telegram 선택 → Reconnect. 빠져나올 땐 Ctrl+b, d.
3. 세션 재시작: `tmux kill-session -t nidus` (watchdog이 1분 안에 다시 띄움). 한도에 걸렸으면 `<office>/system/restarts`를 비우고 기다린다.
4. 그래도 안 되면: 같은 봇 토큰으로 다른 세션이 polling 중인지(409 Conflict) 본다 — `ps aux | grep server.ts`에 여러 개면 남은 것을 끈다. 토큰이 바뀌었으면 `/telegram:configure <토큰>`.
5. 직접 알림 경로 확인: `scripts/watchdog.sh notify <office> 테스트`.

## 한계
- Channels는 research preview(문법이 바뀔 수 있음). 선제 알림은 실측으로 확인됨(2026-11-24).
- `/loop`는 7일 후 만료 → watchdog의 일일 재시작과 SessionStart 안내로 `jobs.md`에서 재등록.
- 팀의 `repos`·`library`는 권한 경계가 아니다. 관리자가 브리프로 지키는 규칙이고, 훅은 `writable` 전체를 builder에게 허용한다. 레포를 정말 막으려면 `readonly`에 적는다.
- 워커가 office의 `tasks/` 밖에 쓰지 못하게 하는 것은 Write·Edit 도구만 막는다. Bash 리다이렉트(`echo > teams/...`)는 통과한다.
- 동시 실행 수는 관리자의 판단이고 코드로 막지 않는다(Claude Code 자체 상한은 20).
- 워커가 SubagentStop 없이 죽으면 `system/running/`의 파일이 최대 3시간 남는다. 그동안 watchdog은 작업 중으로 보고 대기 상태 재시작을 미루며, "60분째 작업 중" 알림이 잘못 갈 수 있다. 세션을 다시 시작하면 지워진다.
- 볼트 내용이 웹 요청(검색어·URL)으로 새는 것은 코드로 막지 않고 프롬프트 규칙(worker 지침)과 관리자 검토(체크리스트 6번)로만 제한한다.
