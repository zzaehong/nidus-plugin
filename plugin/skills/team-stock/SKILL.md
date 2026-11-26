---
name: team-stock
description: 주식 종목 하나를 기술적·기본적·시장 반응·기관/헤지펀드 4관점으로 나눠 worker에게 맡기고 검토할 때 쓰는 팀 정의. office 스킬의 3단계에서 읽는다.
---
## 데이터 출처 규칙
- 가격·거래량·지표: `af-query bars <TICKER> [days]` (선택: Asset_Frame 형식 SQLite, 경로는 `AF_DB`). `af-query tickers`로 대상 확인. DB가 없거나 af-query가 실패하거나 없는 종목이면 웹 출처를 쓰고 그 사실을 적는다.
- 거시: `af-query macro <SERIES>` (FEDFUNDS, DTB3, T10Y2Y, UNRATE, CPIAUCSL 등).
- 재무·뉴스·수급·13F: DB에 없음 → WebSearch/WebFetch. 공시(SEC EDGAR 등)와 주요 언론을 우선한다.
- library: 볼트에서 종목명·티커로 검색해 사용자의 기존 메모를 먼저 반영한다.

## 관점 (순서대로 호출)
1. **technical** — 추세(20/50/200일 이동평균), 모멘텀(RSI·MACD를 bars에서 계산), 거래량, 지지/저항. 지표는 계산식과 값을 함께 적는다.
2. **fundamental** — 최근 실적(매출·이익·마진 추이), 밸류에이션(PER·PSR 등 동종 비교), 가이던스, 재무 건전성.
3. **market-reaction** — 최근 뉴스·실적 발표 후 주가 반응, 애널리스트 의견 변화, 거시 지표와의 관계.
4. **institutional** — 13F 기반 주요 기관·헤지펀드 보유 변화, 내부자 거래, 공매도 지표. 공시 시차(13F는 분기 후 45일)를 명시한다.

## 검토 체크리스트 (office 체크리스트에 더해 관리자가 직접 확인)
- 공통: 매수·매도 지시 형태가 아니라 근거 있는 판단으로 쓴다.
- technical: `af-query bars <TICKER> 260`을 다시 실행해 기준일 종가를 대조하고, 20/50/200일 이동평균과 RSI(14)를 직접 계산해 worker 값과 비교한다.
- fundamental: 매출·마진·EPS 중 1개 이상을 SEC 공시(10-Q·10-K·8-K) 또는 회사 IR 원문에서 확인한다. PER 등 배수는 기준(TTM·선행·연환산)이 적혀 있는지 보고 직접 다시 계산한다.
- market-reaction: 언급된 주요 날짜의 등락률을 bars로 직접 계산하고, 결론을 좌우하는 뉴스 1건 이상은 원문을 연다.
- institutional: 13F 또는 Form 4 수치 1건 이상을 EDGAR 원문에서 확인하고, 공시 기준일과 시차가 적혀 있는지 본다.

## 종합 보고 형식
관점별 결론 한 줄씩 → 일치/충돌 → 사용자가 확인할 점. 투자 판단은 사용자가 한다.

## 결과물
`outputs/stock/<TICKER>.md` (예: `outputs/stock/NVDA.md`). `현재 판단`에는 기준일 종가와 관점별 결론 한 줄씩, 일치/충돌을 쓴다.
