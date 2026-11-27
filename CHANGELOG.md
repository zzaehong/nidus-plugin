# Changelog

## 0.4.0 — 미출시
관리자 한 명에게 시키면 팀에 나눠 동시에 처리한다.

### 추가
- **팀 폴더** `office/teams/<팀>/`: `TEAM.md`(언제 쓰나, 맡는 폴더 `library`·`repos`, 멤버와 종류, 원칙, 데이터 출처, 완료 기준 예시, 검토 체크리스트, 결과물, Red Team 정책)와 `desk.md`(이어받을 맥락·배운 점). 처음 실행할 때 예시 팀 `stock`·`dev`를 복사하고, 그 뒤로는 사용자가 고친 내용을 덮어쓰지 않는다.
- **동시 실행**: 서로 기다릴 필요 없는 멤버를 백그라운드로 한 번에 돌리고, 기다리는 동안에도 Telegram 메시지를 받아 다른 task를 분배한다. 같은 레포에는 builder를 하나만 둔다.
- **사용량 관리**: 상태 줄이 구독 사용량(5시간·7일)을 `system/usage.json`에 남기고, 관리자가 그 값을 보고 동시 실행 수를 정한다(기준 표는 office 스킬). task마다 사용량을 기록하고 대시보드에 보여 준다.
- **Completion Contract**: task마다 Goal·Scope·Constraints·Acceptance Criteria·Verification·Result를 먼저 쓰고, 기준을 모두 확인해야 완료로 둔다.
- **Red Team** (`nidus:redteam`): 종합한 결론이나 코드 변경을 중간 과정 없이 받아 전제·취약점·실패 시나리오·반례를 공격하고 Pass·Revise·Conflict로 판정한다. Conflict는 사용자에게 올린다.
- **Inbox 두 단계**: 1단계는 지금처럼 Telegram 메시지를 `system/inbox.md`에 빠짐없이 적는다. 2단계는 종류(일 요청·운영 지시·답변·질문)를 나누고, 일 요청에 우선순위(지금·빠른 일·예약·나중)를 매겨 Task Board에 올린다. 관리자가 추천하고, 사용자가 답장으로 바꿀 수 있다.
- **Task Board** (`board.md`): 끝나지 않은 task를 우선순위 칸별로 모은 표. 원본은 각 `report.md`의 `status`·`priority`·`due`이고, 관리자는 자리가 날 때마다 board 순서대로 팀에 분배한다.
- **돌고 있는 워커 추적**: SubagentStart/Stop 훅이 `system/running/`에 기록한다. 관리자 화면이 대기처럼 보여도 watchdog과 메뉴바는 작업 중으로 본다(돌고 있는 워커를 재시작으로 죽이지 않음).

### 바뀜
- 워커(worker·builder·redteam)는 office의 `tasks/` 아래 결과 파일에만 쓴다. 대시보드·outputs·teams·jobs·system은 관리자만 쓴다.
- 일일 재시작은 `진행`·`검토` task가 있을 때만 미룬다. board에서 기다리는 `접수` task는 재시작 뒤에도 이어진다.
- `skills/team-stock`을 `teams/stock/TEAM.md`로 옮겼다. 0.3.0에서 올리면 첫 실행 때 `office/teams/`가 생긴다.

## 0.3.0 — 2026-11-27
남도 설치해 쓸 수 있게 정리한 첫 공개 릴리즈.

### 추가
- **watchdog** (`scripts/watchdog.sh`, launchd 1분 간격): 세션이 꺼지면 다시 띄우고(30분에 3회까지), 승인 대기 3분·작업 60분이 넘으면 Bot API로 직접 알림.
- **일일 재시작**: 06~08시 대기 상태이고 진행 중 task가 없으면 `handoff.md`를 쓰게 한 뒤 재시작, 재시작한 세션이 Telegram으로 알림.
- **Telegram 끊김 복구**: 채널 서버가 사라지면 대기 상태일 때 handoff 후 재시작. 세션이 스스로 재시작을 요청(`system/restart-request`)하거나 `watchdog.sh notify`로 채널 없이 알릴 수 있다. 장애 매뉴얼(세션용·사람용).
- **메뉴바** (SwiftBar): 흰 집 아이콘의 창문 색으로 상태 표시(초록 대기 · 노랑 작업 중 · 주황 승인 대기 · 빨강 Telegram 끊김 · 어두움 꺼짐), tmux attach·로그.
- **로고·아이콘**: `assets/logo.svg`, 플러그인 아이콘 `plugin/.claude-plugin/icon.png`, 다시 그리기는 `swift assets/render.swift`.
- **office 구조**: `00.dashboard.md`(검토 시작점), `outputs/<분야>/<대상>.md`(계속 갱신하는 결과물, `review: 대기|확인`), `tasks/YYYY-MM/<id>/`(작업 기록), `system/`.
- **권한 분리**: 리서치 `worker`(웹 O, 코드 쓰기 X)와 코딩 `builder`(코드 쓰기 O, 웹 X). 이 레포·볼트·추가 지정 경로는 누구도 쓰지 못함.
- **inbox**: 작업 중 온 Telegram 메시지를 `system/inbox.md`에 적고, 남은 항목이 있거나 기록되지 않은 메시지가 있으면 Stop 훅이 응답 종료를 막음.
- **검토 체크리스트**: 관리자가 핵심 숫자 재조회·계산 재현·기준일·library 인용·볼트 유출·결론 일치를 직접 확인.
- **권한 설정 파일** `~/.config/nidus/config`: builder 쓰기 폴더 여러 개(`writable`), 추가 읽기 전용(`readonly`), 읽기 금지(`noread`, Read·Grep·Glob·Bash 언급 차단), 일일 재시작 시간대(`tz`). 볼트·이 레포·설정 파일·자격 증명 보호는 끌 수 없음.
- LICENSE(MIT).

### 바뀜
- office 경로는 필수 인자(기본값 없음). office를 볼트 안에 두면 볼트에서 그 폴더만 쓰기 허용.
- 볼트 내용이 웹 요청으로 나가는 것은 프롬프트 규칙과 검토로 제한(코드 차단 없음).
- guard: office 위치를 `NIDUS_OFFICE`로 고정, `.claude/`·`CLAUDE.md`·`.mcp.json`·`.git/hooks` 쓰기 차단, builder 식별 완전 일치.
- 프롬프트의 개인 이름을 "사용자"로, 개인 경로(`~/Developer/nidus-plugin`, Asset_Frame DB)를 설정값으로 바꿈. 이전 버전 outputs 문서의 "확인할 점" 제목은 그대로 둬도 된다.
- 0.2.0에서 올리는 경우: 예전에 코드에 박혀 있던 읽기 전용 경로(예: Asset_Frame `var/`)는 이제 설정 파일의 `readonly`에 적어야 보호된다.

## 0.2.0 — 2026-11-24
첫 버전: 상시 관리자 세션(tmux), Telegram 채널, 순차 worker 팀(team-stock 예시), 읽기 전용 library, guard 훅.
