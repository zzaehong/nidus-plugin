# Changelog

## 0.3.0 — 2026-11-26
남도 설치해 쓸 수 있게 정리한 첫 공개 릴리즈.

### 추가
- **watchdog** (`scripts/watchdog.sh`, launchd 1분 간격): 세션이 꺼지면 다시 띄우고(30분에 3회까지), 승인 대기 3분·작업 60분이 넘으면 Bot API로 직접 알림.
- **일일 재시작**: 06~08시 대기 상태이고 진행 중 task가 없으면 `handoff.md`를 쓰게 한 뒤 재시작, 재시작한 세션이 Telegram으로 알림.
- **Telegram 끊김 복구**: 채널 서버가 사라지면 대기 상태일 때 handoff 후 재시작. 세션이 스스로 재시작을 요청(`system/restart-request`)하거나 `watchdog.sh notify`로 채널 없이 알릴 수 있다. 장애 매뉴얼(세션용·사람용).
- **메뉴바** (SwiftBar): 🔴 꺼짐 · 🟡 승인 대기 · 🔵 작업 중 · 🟢 대기 · 🟠 Telegram 끊김, tmux attach·로그.
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
