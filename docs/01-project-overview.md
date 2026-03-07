# Project Overview

## 프로젝트 이름

PD2 Broadcast Item Tracker

## 한 줄 정의

PD2 플레이 중 `Ctrl+C`로 복사되는 아이템 JSON을 자동 수집해,
방송 표시(Overlay), 관리(Dashboard), 공유(Discord/Reddit), 모바일 조회(Today)까지 연결하는 로컬 우선 서비스.

## 이 서비스를 왜 만드는가

- 방송 중 드랍 아이템을 수동으로 기록하면 누락과 지연이 잦다.
- 시청자는 현재 드랍 상황을 즉시 보기 어렵다.
- Discord/Reddit 공유 문구를 매번 수동으로 작성하면 운영 피로가 커진다.

이 서비스의 목표는 **기록 자동화 + 실시간 표시 + 공유 자동화**를 한 흐름으로 묶어,
방송 운영 시간을 절약하고 시청자 경험을 개선하는 것이다.

## 서비스가 동작하는 전체 흐름

1. 플레이어가 게임 아이템에 커서를 두고 `Ctrl+C`
2. 앱이 클립보드 JSON을 감지하고 검증/정규화
3. 중복 처리 후 SQLite에 세션 단위로 저장
4. Local API가 최신 데이터를 제공
5. Dashboard/Overlay/Today 화면이 동일 데이터로 갱신
6. 필요 시 Discord/Reddit/Compact 포맷으로 즉시 복사/공유

핵심은 **수집 경로는 단일(클립보드 JSON), 소비 채널은 다중(UI/OBS/공유)** 구조다.

## 누가 어떻게 쓰는가 (사용자 시나리오)

### 시나리오 A: 방송 진행자

- 앱을 켜고 OBS Browser Source에 Overlay URL 연결
- 파밍 중 아이템을 복사하면 Overlay가 자동 갱신
- 방송 종료 후 Today 페이지를 QR로 열어 모바일에서 결과 확인

### 시나리오 B: 커뮤니티 공유 사용자

- 하루 파밍 로그를 Dashboard에서 검토
- Discord/Reddit 포맷을 클릭 한 번으로 생성
- 별도 편집 없이 커뮤니티 게시

## 제품 범위

### In Scope (MVP)

- 클립보드 감시 기반 아이템 자동 수집
- 파싱/정규화/중복 처리/세션 구분 저장
- Overlay / Dashboard / Today 기본 화면
- Discord / Reddit / Compact 텍스트 포맷 생성
- QR 기반 Today 페이지 접근

### Out of Scope (초기 단계)

- 게임 메모리/패킷 읽기
- 외부 서버 의존 필수 구조
- 계정 기반 멀티 유저 동기화

## 핵심 화면과 역할

- `Overlay`: 방송 화면에 최근 드랍을 짧고 선명하게 표시
- `Dashboard`: 상세 조회, 필터, 세션 회고용 운영 화면
- `Today`: 모바일 친화형 일일 요약 화면

관련 상세:

- `docs/ui/20-overlay-ui.md`
- `docs/ui/21-dashboard-ui.md`
- `docs/ui/22-today-page-ui.md`

## 데이터/연동 축

1. 수집: `docs/integration/44-clipboard-monitoring.md`
2. 데이터 규격/저장: `docs/data/10-json-spec.md`, `docs/data/11-database-schema.md`, `docs/data/12-parsing-rules.md`
3. API: `docs/api/50-local-api.md`, `docs/api/51-route-structure.md`
4. 외부 공유 포맷: `docs/integration/41-discord-format.md`, `docs/integration/42-reddit-format.md`, `docs/integration/43-compact-format.md`

## 성공 기준 (MVP)

- 아이템 복사 후 1초 내 최근 목록 반영
- 앱 재시작 후에도 데이터 일관성 유지
- 비개발자도 5분 내 OBS Overlay 연결 가능
- 공유 포맷 복사 후 추가 편집 없이 게시 가능

## 기술 스택

- Tauri + Rust: Desktop shell 및 시스템 접근
- React + TypeScript: UI
- SQLite: 로컬 저장
- Local HTTP API: UI/OBS 데이터 공급

## 확장 방향 (MVP 이후)

- 세션 비교/주간 리포트 같은 통계 뷰
- 아이템 하이라이트 규칙(희귀도/가치 기반)
- 선택적 원격 백업 또는 팀 공유 모드
