# nidus plugin

맥미니에 상시로 켜 두는 관리자 세션. Telegram으로 지시·알림을 주고받고, 팀 스킬의 관점마다 worker를 순차로 돌려 결과를 자동 검토한다. Obsidian 볼트는 읽기 전용 library.

## 구성
- `skills/office` 관리자 절차(지시 → task 파일 → worker 순차 → 검토 → Telegram 보고, 반복 작업 `jobs.md` + `/loop`)
- `skills/team-stock` 팀 예시(주식 4관점). 다른 분야는 `skills/team-<이름>`을 추가한다.
- `agents/worker` 범용 워커(Sonnet). Telegram 도구 없음.
- `bin/af-query` Asset_Frame DB 읽기 전용 조회 (`AF_DB`로 경로 변경)
- `hooks/guard.mjs` `NIDUS_GUARD=1`일 때 office 폴더 밖 쓰기, main/force push, 자격 증명 경로 차단. office를 볼트 안(예: `<볼트>/nidus_office`)에 두면 볼트에서 그 폴더만 쓰기 허용

## 준비 (1회)
1. `brew install bun tmux`
2. Telegram BotFather `/newbot` → 토큰 복사
3. Claude Code에서 `/plugin install telegram@claude-plugins-official` → `/telegram:configure <토큰>`
4. `scripts/office.sh <볼트 경로>`로 시작 → 봇에 메시지 → `/telegram:access pair <코드>` → `/telegram:access policy allowlist`
5. (선택) 자동 재시작: `scripts/watchdog.sh install <볼트 경로> [office 폴더]` — launchd가 1분마다 `nidus` 세션을 확인한다.
   - 없으면 다시 띄워 `/loop` 재등록 + Telegram 알림. 30분에 3회까지만, 넘으면 watchdog이 Bot API로 직접 알림.
   - 승인 대기 3분, 작업 중 60분이 넘으면 Bot API로 직접 알림(멈춤 의심). 토큰은 Telegram 플러그인의 `.env`에서 읽는다.
   - 매일 06~08시(KST) 사이 대기 상태이고 진행 중 task가 없으면 `system/handoff.md`를 쓰게 한 뒤 재시작(컨텍스트 정리 + `/loop` 7일 만료 대응). 8시까지 못 하면 그날은 건너뛰고 알림.
   - 기록: `<office>/system/events.md`. 전송 확인: `scripts/watchdog.sh notify <office 폴더> 테스트`. 로그 `~/Library/Logs/nidus-watchdog.log`. 일부러 끌 때는 먼저 `scripts/watchdog.sh uninstall`(안 그러면 1분 안에 다시 뜸). 로그인한 뒤에만 동작한다. 재시작이 확인 화면에서 멈추지 않도록 볼트는 한 번 `cd <볼트> && claude`로 신뢰해 둔다(`--add-dir` 승인은 세션마다 사라짐).
6. (선택) 메뉴바 상태: `brew install --cask swiftbar` → 플러그인 폴더 선택 → `ln -s "$PWD/scripts/nidus-status.10s.sh" <플러그인 폴더>/`. 🔴 꺼짐 · 🟡 승인 대기 · 🔵 작업 중 · 🟢 대기, 클릭하면 tmux attach·로그.

## 한계
- Channels는 research preview(문법이 바뀔 수 있음). 선제 알림은 실측으로 확인됨(2026-11-24).
- `/loop`는 7일 후 만료 → SessionStart 훅이 `jobs.md`로 재등록.
- 웹 내용으로 데이터가 새는 경로(WebFetch URL)는 막지 않는다.
