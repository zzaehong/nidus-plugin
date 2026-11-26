# Nidus

맥미니에 상시로 켜 두는 Claude Code 관리자 세션. Telegram으로 지시하고 알림을 받으며, 관리자가 팀 스킬의 관점마다 worker를 순차로 돌려 결과를 자동 검토한다. Obsidian 볼트는 읽기 전용 library로 쓴다.

## 필요한 것
- macOS (launchd·caffeinate 사용), 로그인 상태로 켜 둘 Mac
- Claude Code (구독 로그인, Channels 사용 가능 버전), Telegram 봇 1개
- `bun`·`tmux`(Homebrew), `node`(훅 실행), `python3`(선택: `af-query`)
- Obsidian 볼트 폴더 1개 (office 폴더를 그 안에 둘 수 있다)
- (선택) SwiftBar — 메뉴바 상태 아이콘

## 설치
```sh
git clone https://github.com/zzaehong/nidus-plugin.git
cd nidus-plugin
scripts/office.sh <볼트 경로> <office 폴더>
```
플러그인은 `--plugin-dir`로 이 레포에서 바로 로드한다(마켓플레이스 설치는 `scripts/`가 빠져서 지원하지 않는다). Telegram 연결, watchdog, 메뉴바, 환경 변수 설정은 [plugin/README.md](plugin/README.md)의 준비 순서를 따른다.

## 구성
- 플러그인 본체: [plugin/](plugin/) — 관리자(office 스킬), 리서치 worker(웹 O, 코드 쓰기 X), 코딩 builder(코드 쓰기 O, 웹 X), guard·inbox 훅
- 실행·감시: `scripts/office.sh`, `scripts/watchdog.sh`, 메뉴바 `scripts/nidus-status.10s.sh`
- 변경 내역: [CHANGELOG.md](CHANGELOG.md)
- 테스트: `npm test`
- 공식 문서 검증 기록: [docs/verification.md](docs/verification.md)
