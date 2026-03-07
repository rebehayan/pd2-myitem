# Project Overview

## 프로젝트 이름

PD2 Broadcast Item Tracker

## 한 줄 정의

PD2 플레이 중 `Ctrl+C`로 복사되는 아이템 JSON을 자동 수집하여,
방송 오버레이/대시보드/공유 포맷/모바일 조회(오늘 페이지)까지 연결하는 로컬 앱.

## 해결하려는 문제

- 방송 중 드랍 아이템을 수동 기록하기 어렵다.
- 시청자에게 현재 드랍 상황을 즉시 보여주기 어렵다.
- Discord/Reddit 공유 텍스트를 매번 수동 작성해야 한다.

## 목표 사용자

- PD2를 스트리밍하는 방송인
- 파밍 로그를 축적하고 공유하고 싶은 플레이어

## 제품 범위

### In Scope

- 클립보드 감시 기반 자동 수집
- 아이템 정규화/중복 처리/세션 구분 저장
- OBS Browser Source 기반 오버레이
- Discord/Reddit/Compact 포맷 생성
- 오늘 획득 아이템 페이지 + QR 접근

### Out of Scope

- 게임 메모리/패킷 읽기
- 외부 서버 강제 의존 구조
- 계정 기반 멀티 유저 동기화(초기 단계)

## 핵심 기능 축

1. 수집: `docs/integration/44-clipboard-monitoring.md`
2. 데이터: `docs/data/10-json-spec.md`, `docs/data/11-database-schema.md`
3. UI: `docs/ui/20-overlay-ui.md`, `docs/ui/21-dashboard-ui.md`, `docs/ui/22-today-page-ui.md`
4. 공유: `docs/integration/41-discord-format.md`, `docs/integration/42-reddit-format.md`, `docs/integration/43-compact-format.md`
5. 배포/운영: `docs/operations/60-release-plan.md`

## 성공 기준 (MVP)

- 아이템 복사 후 1초 내 최근 목록 반영
- 앱 재시작 후에도 데이터 일관성 유지
- OBS 오버레이 연결을 비개발자도 5분 내 완료
- 공유 포맷 복사 시 별도 편집 없이 게시 가능

## 기술 스택

- Tauri + Rust (Desktop shell / 시스템 접근)
- React + TypeScript (UI)
- SQLite (로컬 저장)
- Local HTTP API (UI/OBS 데이터 공급)
