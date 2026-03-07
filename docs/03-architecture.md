# System Architecture

## 아키텍처 목표

- 로컬 우선: 네트워크 없이도 핵심 기능 동작
- 단일 수집 경로: 클립보드 JSON만 수용
- 표시 채널 분리: Dashboard / Overlay / Today를 동일 데이터 소스로 제공
- 확장 가능성: 포맷/라우트/자산 전략을 단계적으로 확장

## 상위 구성

1. Desktop Runtime (Tauri/Rust)
2. Clipboard Ingestion Pipeline
3. SQLite Storage
4. Local API Server
5. Web UI (Dashboard, Overlay, Today)
6. OBS Browser Source Consumer

## 데이터 흐름 (정상 경로)

1. 사용자가 게임 아이템에 커서를 두고 `Ctrl+C`
2. 클립보드에서 JSON 페이로드 감지
3. 파싱/검증/정규화 수행
4. 중복 판정 및 세션 메타데이터 계산
5. SQLite 트랜잭션 저장
6. Local API가 최신 데이터 노출
7. Dashboard/Overlay/Today 화면 갱신

관련 문서:

- `docs/integration/44-clipboard-monitoring.md`
- `docs/data/12-parsing-rules.md`
- `docs/data/11-database-schema.md`

## 컴포넌트 책임

### Desktop Runtime

- 클립보드 구독, 앱 생명주기, 설정/트레이 관리
- Local API 프로세스 실행/정지 제어

### Ingestion Pipeline

- JSON schema 검증
- 필드 표준화(이름, 타입, 희귀도, 옵션 표현)
- 저장 가능한 도메인 모델로 변환

### SQLite Storage

- `items`, `item_stats`, `sessions` 중심 저장
- 검색/정렬/집계를 위한 인덱스 유지

### Local API Server

- UI/OBS를 위한 read 모델 제공
- endpoint 예: `/api/items/recent`, `/api/items/today`, `/api/items/:id`

### Web UI + OBS Overlay

- Dashboard: 탐색/필터/상세
- Overlay: 방송 친화적 실시간 표시
- Today: QR 접근용 모바일 읽기 페이지

## 라우팅 경계

- 데이터 API: `docs/api/51-route-structure.md`
- 페이지 라우트: `/overlay`, `/today`, `/dashboard`
- OBS 연동: `docs/integration/40-obs-integration.md`

## 장애/복구 전략

- 파싱 실패: 원문 폐기 대신 실패 이벤트 로그 축적
- DB 실패: 트랜잭션 롤백 + 사용자 알림
- API 일시 중단: UI는 마지막 스냅샷 표시

## 보안 및 공유 경계

- 기본 바인딩: localhost
- 외부 공유는 명시적 설정에서만 활성화
- 민감 정보/개인 식별 정보는 저장 대상 제외

상세 운영 정책:

- `docs/operations/61-config-and-settings.md`
- `docs/operations/62-security-and-sharing.md`
