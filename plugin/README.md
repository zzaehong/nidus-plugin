# nidus plugin

맥미니에 상시로 켜 두는 관리자 세션. Telegram으로 지시·알림을 주고받고, 팀 스킬의 관점마다 worker를 순차로 돌려 결과를 자동 검토한다. Obsidian 볼트는 읽기 전용 library.

## 구성
- `skills/office` 관리자 절차(지시 → task 파일 → worker 순차 → 검토 → Telegram 보고, 반복 작업 `jobs.md` + `/loop`)
- `skills/team-stock` 팀 예시(주식 4관점). 다른 분야는 `skills/team-<이름>`을 추가한다.
- `agents/worker` 리서치 워커(Sonnet). 웹 O, `~/Developer` 쓰기 X. Telegram 도구 없음.
- `agents/builder` 코딩 워커(Sonnet). `~/Developer` 쓰기 O, 웹 X(도구 없음 + curl·wget 차단). worker가 office에 남긴 리서치만 읽는다. 웹에서 들어온 지시가 쓰기 권한으로 바로 이어지지 않게 둘을 나눴다.
- `bin/af-query` (선택) Asset_Frame 형식 SQLite 시세 DB 읽기 전용 조회. 경로는 `AF_DB`(기본 `~/Developer/Asset_Frame/var/asset_frame.sqlite3`). 없으면 team-stock은 웹 출처를 쓴다.
- `hooks/guard.mjs` `NIDUS_GUARD=1`일 때: 쓰기는 office 폴더(누구나)와 `NIDUS_WRITABLE`(`NIDUS_DEV`, 기본 `~/Developer`, builder만)에만. `NIDUS_READONLY`(볼트, 이 레포, `~/Library/LaunchAgents`, `NIDUS_EXTRA_READONLY`)는 누구도 못 씀. main/force push, 자격 증명 경로 차단. office를 볼트 안에 두면 볼트에서 그 폴더만 쓰기 허용
- `hooks/inbox.mjs` Stop 훅. 작업 중 온 Telegram 메시지는 `system/inbox.md`에 `- [ ]`로 적히고, 남아 있으면 응답을 끝내지 못하게 막아 처리하게 한다.

## office 폴더
- `00.dashboard.md` 검토 대기·막힘·진행 중·최근 완료·반복 작업. 여기만 보면 된다.
- `outputs/<분야>/<대상>.md` 결과물. 대상마다 문서 하나를 계속 갱신(현재 판단 → 확인할 점 → 변경 이력). 바뀌면 `review: 대기`, 읽고 나면 Obsidian에서 `확인`으로.
- `tasks/YYYY-MM/<id>/report.md` + `workers/` 작업 기록. `jobs.md` 반복 작업. `system/` chat_id·handoff·watchdog 기록.

## 준비 (1회)
1. `brew install bun tmux`
2. Telegram BotFather `/newbot` → 토큰 복사
3. Claude Code에서 `/plugin install telegram@claude-plugins-official` → `/telegram:configure <토큰>`
4. `scripts/office.sh <볼트 경로> <office 폴더>`로 시작 → 봇에 메시지 → `/telegram:access pair <코드>` → `/telegram:access policy allowlist`
5. (선택) 자동 재시작: `scripts/watchdog.sh install <볼트 경로> <office 폴더>` — launchd가 1분마다 `nidus` 세션을 확인한다. 아래 설정을 쓰면 install할 때 같은 환경 변수를 붙여야 plist에 저장된다(예: `NIDUS_EXTRA_READONLY=~/Developer/Asset_Frame/var scripts/watchdog.sh install ...`).
   - 없으면 다시 띄워 `/loop` 재등록 + Telegram 알림. 30분에 3회까지만, 넘으면 watchdog이 Bot API로 직접 알림.
   - 승인 대기 3분, 작업 중 60분이 넘으면 Bot API로 직접 알림(멈춤 의심). 토큰은 Telegram 플러그인의 `.env`에서 읽는다.
   - Telegram 연결이 끊기면(플러그인 `bot.pid`의 server.ts 프로세스가 없음) 2분 뒤 대기 상태일 때 handoff 후 재시작. 작업 중이면 끝날 때까지 기다리고, 30분 넘게 끊겨 있으면 Bot API로 직접 알림. 재시작 상한은 오류 재시작과 공유. 메뉴바는 🟠.
   - 세션이 스스로 재시작을 요청할 수 있다: `handoff.md`를 쓰고 `system/restart-request`를 만들면 대기 상태일 때(늦어도 10분 뒤) 재시작. 세션은 `$NIDUS_WATCHDOG notify`로 Telegram 채널 없이도 알림을 보낼 수 있다. 절차는 office 스킬 "Telegram이 안 될 때".
   - 매일 06~08시(`NIDUS_TZ`, 기본 Asia/Seoul) 사이 대기 상태이고 진행 중 task가 없으면 `system/handoff.md`를 쓰게 한 뒤 재시작(컨텍스트 정리 + `/loop` 7일 만료 대응). 재시작한 세션은 이어 간 일을 Telegram으로 알림. 8시까지 못 하면 그날은 건너뛰고 알림.
   - 기록: `<office>/system/events.md`. 전송 확인: `scripts/watchdog.sh notify <office 폴더> 테스트`. 로그 `~/Library/Logs/nidus-watchdog.log`. 일부러 끌 때는 먼저 `scripts/watchdog.sh uninstall`(안 그러면 1분 안에 다시 뜸). 로그인한 뒤에만 동작한다. 재시작이 확인 화면에서 멈추지 않도록 볼트와 `NIDUS_DEV` 폴더(기본 `~/Developer`)는 각각 한 번 `cd <폴더> && claude`로 신뢰해 둔다(`--add-dir` 승인은 세션마다 사라짐).
6. (선택) 메뉴바 상태: `brew install --cask swiftbar` → 플러그인 폴더 선택 → `ln -s "$PWD/scripts/nidus-status.10s.sh" <플러그인 폴더>/`. 🔴 꺼짐 · 🟡 승인 대기 · 🔵 작업 중 · 🟢 대기, 클릭하면 tmux attach·로그.

## 설정 (환경 변수, 모두 선택)
`scripts/office.sh`와 `scripts/watchdog.sh install`에 같은 값을 붙여 실행한다. watchdog은 install할 때 값을 launchd plist에 저장한다(office 폴더에는 세션이 쓸 수 있어서 두지 않는다).
| 변수 | 기본값 | 뜻 |
|---|---|---|
| `NIDUS_DEV` | `~/Developer` | builder가 코드를 쓰는 폴더. 세션에 `--add-dir`로 붙는다. |
| `NIDUS_EXTRA_READONLY` | 없음 | 추가로 누구도 못 쓰게 할 경로(`:`로 구분). 예: 레포 안의 데이터 DB |
| `NIDUS_TZ` | `Asia/Seoul` | 일일 재시작 06~08시의 시간대 |
| `AF_DB` | `~/Developer/Asset_Frame/var/asset_frame.sqlite3` | `af-query`가 읽는 SQLite |

## Telegram이 안 될 때 (사람용)
보통은 자동으로 복구된다: watchdog이 채널 끊김을 감지하거나 세션이 재시작을 요청해 handoff 후 재시작한다. 메뉴바가 🟠면 끊긴 상태다.
1. `tail ~/Library/Logs/nidus-watchdog.log`, `<office>/system/events.md`에서 재시작 기록과 "한도라 보류"를 본다.
2. 세션만 다시 붙이기: `tmux attach -t nidus` → `/mcp` → telegram 선택 → Reconnect. 빠져나올 땐 Ctrl+b, d.
3. 세션 재시작: `tmux kill-session -t nidus` (watchdog이 1분 안에 다시 띄움). 한도에 걸렸으면 `<office>/system/restarts`를 비우고 기다린다.
4. 그래도 안 되면: 같은 봇 토큰으로 다른 세션이 polling 중인지(409 Conflict) 본다 — `ps aux | grep server.ts`에 여러 개면 남은 것을 끈다. 토큰이 바뀌었으면 `/telegram:configure <토큰>`.
5. 직접 알림 경로 확인: `scripts/watchdog.sh notify <office> 테스트`.

## 한계
- Channels는 research preview(문법이 바뀔 수 있음). 선제 알림은 실측으로 확인됨(2026-11-24).
- `/loop`는 7일 후 만료 → watchdog의 일일 재시작과 SessionStart 안내로 `jobs.md`에서 재등록.
- 볼트 내용이 웹 요청(검색어·URL)으로 새는 것은 코드로 막지 않고 프롬프트 규칙(worker 지침)과 관리자 검토(체크리스트 6번)로만 제한한다.
