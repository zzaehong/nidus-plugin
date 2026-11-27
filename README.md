<div align="center">

<img src="assets/logo.svg" width="140" alt="Nidus 로고: 창문에 불이 켜진 흰 집">

# Nidus

**Telegram으로 일을 맡기면, 맥에 상주하는 Claude Code가 팀을 꾸려 처리하고 검토까지 끝내 보고하는 개인 비서 사무실**

![version](https://img.shields.io/badge/version-0.4.0-blue)
![platform](https://img.shields.io/badge/platform-macOS-lightgrey?logo=apple)
![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-d97757)
![Telegram](https://img.shields.io/badge/Telegram-channel-26A5E4?logo=telegram&logoColor=white)
![license](https://img.shields.io/badge/license-MIT-green)

</div>

---

## 어떤 앱인가요?

Nidus는 **항상 켜 둔 Mac에서 돌아가는 Claude Code 플러그인**입니다.

- 📱 휴대폰 Telegram으로 *"NVDA 분석해 줘"*, *"이 레포에 기능 추가해 줘"*처럼 지시합니다.
- 🧑‍💼 Mac의 **관리자 세션**이 지시를 받아 task로 만들고, 완료 기준을 정한 뒤 **팀**에 일을 나눠 **동시에** 돌립니다.
- 👥 팀은 office의 `teams/<팀>/` 폴더 하나입니다. 팀마다 멤버(🔍 **worker** 리서치, 🛠️ **builder** 코딩), 맡는 폴더, 원칙, 검토 기준이 있습니다.
- ✅ 관리자가 체크리스트로 결과를 **직접 다시 확인**하고, 😈 **Red Team**이 결론을 공격해 본 뒤 Telegram으로 보고합니다.
- 📚 Obsidian 볼트는 **읽기 전용 자료실**로 참고하고, 결과물은 볼트 안의 office 폴더에 정리해 둡니다.

API 키 없이 **Claude 구독 안의 공식 기능**(Claude Code, Channels, 플러그인)만 씁니다.

```mermaid
flowchart LR
    U["📱 사용자<br/>Telegram"] -- 지시 --> M["🧑‍💼 관리자 세션<br/>Mac · tmux 상주"]
    M -- "동시에 분배" --> T["👥 팀 폴더<br/>teams/stock · teams/dev …"]
    T --> W["🔍 worker ×N<br/>웹 O · 코드 쓰기 X"]
    T --> B["🛠️ builder<br/>레포당 1개 · 웹 X"]
    W -- 결과 --> M
    B -- 결과 --> M
    M -- 심사 --> R["😈 Red Team<br/>Pass · Revise · Conflict"]
    V[("📚 Obsidian 볼트<br/>읽기 전용")] -. 참고 .-> W
    M -- "검토 후 보고" --> U
    M -- 정리 --> O["🗂️ office 폴더<br/>대시보드 · 결과물"]
    D["🐕 watchdog<br/>launchd"] -. 감시·재시작 .-> M
```

## ✨ 주요 기능

| | 기능 | 설명 |
|---|---|---|
| 💬 | **Telegram 지시·보고** | 어디서든 메시지로 일을 맡기고, 끝나면 알림을 받습니다. 작업 중에 보낸 메시지도 inbox에 쌓여 빠짐없이 처리됩니다. |
| 👥 | **폴더 기반 팀** | `teams/<팀>/TEAM.md` 하나로 팀을 만듭니다. 멤버, 맡는 볼트 폴더·레포, 원칙, 검토 기준을 적습니다. 리서치(worker)와 코딩(builder)은 권한을 나눠 웹에서 읽은 내용이 곧바로 코드 수정으로 이어지지 않습니다. |
| ⚡ | **동시 처리** | 여러 일을 한꺼번에 시켜도 관리자가 나눠 동시에 돌립니다. 기다리는 동안에도 새 지시를 받습니다. |
| 📊 | **사용량 관리** | 상태 줄이 구독 사용량(5시간·7일)을 기록하고, 관리자가 그 값을 보고 동시에 돌릴 수를 정합니다. |
| ✅ | **완료 기준과 직접 검토** | task마다 Completion Contract(목표·범위·완료 기준·검증 방법)를 먼저 쓰고, 핵심 숫자 재조회·계산 재현·출처를 직접 확인해 기준을 모두 채워야 완료로 둡니다. |
| 😈 | **Red Team** | 종합한 결론만 받은 별도 에이전트가 전제·취약점·반례를 공격합니다. 사람이 판단할 쟁점은 사용자에게 올립니다. |
| 🔁 | **반복 작업** | `jobs.md`에 적어 둔 일을 `/loop`로 주기적으로 돌립니다. |
| 🗂️ | **검토하기 쉬운 office** | `00.dashboard.md` 하나만 보면 검토할 것, 막힌 것, 진행 중인 것이 보입니다. |
| 🐕 | **watchdog** | 세션이 꺼지거나 멈추거나 Telegram이 끊기면 알아서 재시작하고 알려 줍니다. 매일 아침에는 깨끗하게 새로 시작합니다. 백그라운드 워커가 도는 동안에는 재시작하지 않습니다. |
| 🚦 | **메뉴바 상태** | 집 아이콘의 창문 색깔로 지금 상태를 바로 확인합니다(SwiftBar). |
| 🔒 | **권한 설정** | 어디에 쓰고, 어디를 못 쓰고, 어디를 못 읽게 할지 설정 파일 하나로 정합니다. |

### 🚦 메뉴바 아이콘

사무실(집) 창문의 불빛 색이 세션 상태를 알려 줍니다. 신호등처럼 초록은 괜찮음, 노랑·주황은 일하는 중이거나 확인이 필요함, 빨강은 문제, 어두우면 꺼짐입니다.


| <img src="assets/menubar/idle.png" width="18"><br>대기 | <img src="assets/menubar/working.png" width="18"><br>작업 중 | <img src="assets/menubar/waiting.png" width="18"><br>승인 대기 | <img src="assets/menubar/tgdown.png" width="18"><br>Telegram 끊김 | <img src="assets/menubar/off.png" width="18"><br>꺼짐 |
|:---:|:---:|:---:|:---:|:---:|
| 지시를 기다리는 중 | 관리자나 워커가 일하는 중 | 사람 확인이 필요함 | 연결 문제, 곧 자동 복구 | 불 꺼짐, watchdog이 다시 띄움 |

## 🔒 안전장치

- **볼트는 읽기 전용**입니다. office 폴더만 예외입니다.
- **역할별로 권한을 나눕니다.** 웹은 worker만, 코드 쓰기는 builder만 쓸 수 있습니다. 이 플러그인 자체와 설정 파일은 누구도 고칠 수 없습니다.
- **main·master push와 force push를 막습니다.** builder는 `nidus/<task>` 브랜치에서만 작업하고, 병합은 사용자가 결정합니다.
- **자격 증명 경로를 차단합니다.** `.ssh`, `.env` 같은 경로는 읽기와 쓰기 모두 막습니다.
- **볼트 내용이 밖으로 나가지 않게 합니다.** 웹 검색에는 공개된 식별자만 쓰고, 사용한 검색어와 URL은 모두 기록해 검토합니다.
- 주문, 매매, 결제, 외부 계정 접근은 하지 않습니다.

## 🚀 빠른 시작

**필요한 것**
- macOS. 로그인한 상태로 켜 둘 Mac이 있어야 합니다.
- Claude Code와 Claude 구독. Channels를 지원하는 버전이어야 합니다.
- Telegram 봇 1개 (BotFather `/newbot`으로 만듭니다)
- 도구: `bun`, `tmux`, `node`. `python3`는 선택이고, 메뉴바를 쓰려면 SwiftBar도 설치합니다.

```sh
# 1. 받기
git clone https://github.com/zzaehong/nidus-plugin.git && cd nidus-plugin
brew install bun tmux

# 2. (선택) 권한 설정: 없으면 ~/Developer만 builder가 쓸 수 있습니다
mkdir -p ~/.config/nidus && $EDITOR ~/.config/nidus/config

# 3. 사무실 열기: 볼트 경로와 office 폴더를 지정합니다
scripts/office.sh ~/MyVault ~/MyVault/nidus_office

# 4. (선택) 자동 감시와 재시작
scripts/watchdog.sh install ~/MyVault ~/MyVault/nidus_office
```

세션에서 Telegram을 연결하고 페어링하는 순서는 **[plugin/README.md › 준비](plugin/README.md#준비-1회)**를 따르면 됩니다.

<details>
<summary><b>⚙️ 권한 설정 예시</b> (<code>~/.config/nidus/config</code>)</summary>

```ini
# builder만 쓸 수 있는 폴더 (여러 줄 가능)
writable = ~/Developer
writable = ~/Projects

# 누구도 못 쓰는 경로
readonly = ~/Developer/my-app/data

# 누구도 못 읽는 경로
noread = ~/Documents/private

# 일일 재시작(06~08시) 시간대
tz = Asia/Seoul
```
자세한 규칙과 한계는 [plugin/README.md › 권한 설정](plugin/README.md#권한-설정)에 있습니다.
</details>

## 🗂️ office 폴더

```
nidus_office/
├── 00.dashboard.md        ← 여기만 보면 됩니다 (검토 대기 · 막힘 · 진행 중 · 최근 완료)
├── jobs.md                ← 반복 작업 목록
├── teams/<팀>/            ← 팀 정의(TEAM.md)와 팀 데스크(desk.md)
├── outputs/<분야>/<대상>.md ← 계속 갱신되는 결과물 (review: 대기 → 확인)
├── tasks/YYYY-MM/<id>/    ← 작업 기록 (report.md + workers/)
└── system/                ← inbox · handoff · 사용량 · watchdog 기록
```

## 📁 레포 구조

| 경로 | 내용 |
|---|---|
| [`plugin/`](plugin/) | 플러그인 본체: 스킬(office·library), 에이전트(worker·builder·redteam), 예시 팀(teams/stock·dev), 훅(guard·inbox·running) |
| [`scripts/`](scripts/) | `office.sh` 실행, `watchdog.sh` 감시, `nidus-status.10s.sh` 메뉴바 |
| [`tests/`](tests/) | `npm test` |
| [`docs/verification.md`](docs/verification.md) | 공식 문서 검증과 실측 기록 (0.4.0 동시 실행·사용량 포함) |
| [`CHANGELOG.md`](CHANGELOG.md) | 변경 내역 |

> 💡 **새 분야 팀 추가하기**: 주식 4관점 팀(`stock`)과 코딩 팀(`dev`)은 예시일 뿐입니다. office의 `teams/stock/`을 복사해 `teams/<이름>/`을 만들고 `TEAM.md`에 멤버와 검토 기준을 적으면 어떤 분야든 팀이 됩니다.

## ⚠️ 알아 둘 점

- **Channels는 research preview 기능**이라 사용법이 바뀔 수 있습니다.
- **구독 사용 한도를 씁니다.** 동시에 돌릴수록 빨리 줄어듭니다. 관리자가 사용량을 보고 동시 실행 수를 줄이고, 한도에 가까우면 급하지 않은 일을 초기화 뒤로 미룹니다. 참고로 순차로 돌린 분석 1건이 5시간 한도의 약 4%를 썼습니다.
- **Mac은 로그인한 상태로 켜 두어야 합니다.** launchd 사용자 에이전트로 동작하기 때문입니다.
- **마켓플레이스 설치는 지원하지 않습니다.** `scripts/`가 함께 설치되지 않아서, 레포를 clone해서 씁니다.

## 📄 라이선스

[MIT](LICENSE)
