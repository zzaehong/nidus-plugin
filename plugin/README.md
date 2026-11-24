# nidus plugin

맥미니에 상시로 켜 두는 관리자 세션. Telegram으로 지시·알림을 주고받고, 팀 스킬의 관점마다 worker를 순차로 돌려 결과를 자동 검토한다. Obsidian 볼트는 읽기 전용 library.

## 구성
- `skills/office` 관리자 절차(지시 → task 파일 → worker 순차 → 검토 → Telegram 보고, 반복 작업 `jobs.md` + `/loop`)
- `skills/team-stock` 팀 예시(주식 4관점). 다른 분야는 `skills/team-<이름>`을 추가한다.
- `agents/worker` 범용 워커(Sonnet). Telegram 도구 없음.
- `bin/af-query` Asset_Frame DB 읽기 전용 조회 (`AF_DB`로 경로 변경)
- `hooks/guard.mjs` `NIDUS_GUARD=1`일 때 office 폴더 밖 쓰기, main/force push, 자격 증명 경로 차단

## 준비 (1회)
1. `brew install bun tmux`
2. Telegram BotFather `/newbot` → 토큰 복사
3. Claude Code에서 `/plugin install telegram@claude-plugins-official` → `/telegram:configure <토큰>`
4. `scripts/office.sh <볼트 경로>`로 시작 → 봇에 메시지 → `/telegram:access pair <코드>` → `/telegram:access policy allowlist`

## 한계
- Channels는 research preview. 사용자가 먼저 말하지 않은 선제 알림이 되는지는 실측 필요.
- `/loop`는 7일 후 만료 → SessionStart 훅이 `jobs.md`로 재등록.
- 웹 내용으로 데이터가 새는 경로(WebFetch URL)는 막지 않는다.
