# PD2 Broadcast Item Tracker - Project Index

PD2 방송 중 획득한 아이템을 **클립보드(JSON) 기반**으로 자동 수집하고,
방송/공유/조회까지 연결하는 로컬 중심 도구의 문서 인덱스다.

## 핵심 원칙

- 게임 메모리/패킷을 읽지 않는다.
- 오직 `Ctrl+C`로 복사된 JSON만 처리한다.
- 오프라인/로컬 우선 설계를 유지한다.

## 문서 구조

```text
docs/
  00-project-index.md
  01-project-overview.md
  02-requirements.md
  03-architecture.md
  04-development-roadmap.md
  05-task-checklist.md
  data/
    10-json-spec.md
    11-database-schema.md
    12-parsing-rules.md
    13-sample-items.md
  ui/
    20-overlay-ui.md
    21-dashboard-ui.md
    22-today-page-ui.md
    23-qr-page-flow.md
  assets/
    30-icon-strategy.md
    31-icon-mapping-rules.md
    32-unique-image-phase2.md
  integration/
    40-obs-integration.md
    41-discord-format.md
    42-reddit-format.md
    43-compact-format.md
    44-clipboard-monitoring.md
  api/
    50-local-api.md
    51-route-structure.md
  operations/
    60-release-plan.md
    61-config-and-settings.md
    62-security-and-sharing.md
```

## 빠른 읽기 순서

1. `docs/01-project-overview.md` - 무엇을 왜 만드는지
2. `docs/02-requirements.md` - 기능/비기능 요구사항
3. `docs/03-architecture.md` - 구성요소/데이터 흐름
4. `docs/04-development-roadmap.md` - 구현 우선순위
5. `docs/05-task-checklist.md` - 실행 단위 점검

## 구현 우선순위 (MVP)

1. 클립보드 감시 (`docs/integration/44-clipboard-monitoring.md`)
2. JSON 파싱/검증 (`docs/data/10-json-spec.md`, `docs/data/12-parsing-rules.md`)
3. DB 저장 (`docs/data/11-database-schema.md`)
4. 최근 아이템 표시 UI (`docs/ui/20-overlay-ui.md`, `docs/ui/21-dashboard-ui.md`)
5. 로컬 API 노출 (`docs/api/50-local-api.md`, `docs/api/51-route-structure.md`)
6. 공유 포맷 (`docs/integration/41-discord-format.md`, `docs/integration/42-reddit-format.md`, `docs/integration/43-compact-format.md`)
7. 오늘 페이지/QR (`docs/ui/22-today-page-ui.md`, `docs/ui/23-qr-page-flow.md`)
