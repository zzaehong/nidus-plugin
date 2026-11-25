# Nidus

맥미니에 상시로 켜 두는 Claude Code 관리자 세션. Telegram으로 지시하고 알림을 받으며, 관리자가 팀 스킬의 관점마다 worker를 순차로 돌려 결과를 자동 검토한다. Obsidian 볼트는 읽기 전용 library로 쓴다.

- 플러그인 본체: [plugin/](plugin/) — 구성과 준비 순서는 [plugin/README.md](plugin/README.md)
- 실행: `scripts/office.sh <볼트 경로> <office 폴더>`, 자동 재시작: `scripts/watchdog.sh install <볼트 경로> <office 폴더>`
- 테스트: `npm test`
- 공식 문서 검증 기록: [docs/verification.md](docs/verification.md)
