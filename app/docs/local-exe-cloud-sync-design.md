# 로컬 EXE + 회원 클라우드 동기화 설계

## 1) 목표

- 게임 환경에서 `Ctrl+C` 아이템 수집을 100% 로컬에서 안정적으로 유지한다.
- 비개발자도 사용할 수 있도록 Windows 설치형 EXE(Tauri)를 제공한다.
- 로그인 회원의 아이템 획득 이력을 계정 단위로 클라우드 DB에 보관한다.
- 오프라인에서도 로컬 우선(local-first)으로 동작하고, 온라인 복귀 시 동기화한다.

## 2) 현재 코드베이스 상태

- 데스크톱 패키징 설정은 이미 존재한다: `app/src-tauri/tauri.conf.json`.
- 로컬 영속 저장소(SQLite)는 이미 동작한다: `app/src/server/db.ts`.
- 서버 저장 스키마(Supabase)도 존재한다: `app/docs/supabase-schema.sql`.
- API 인증 흐름은 로컬 게스트/인증 사용자 분기 구조를 갖고 있다: `app/src/server/index.ts`.
- 현재 RLS는 마스터 단일 계정 기준이라, 회원별 소유권 모델로 전환이 필요하다: `app/docs/supabase-rls.sql`.

## 3) 목표 아키텍처

1. 수집 계층 (로컬 전용)
- 게임 복사 -> 로컬 클립보드 모니터 -> 로컬 ingest 파이프라인.
- 클라우드 연결 유무와 무관하게 항상 동작해야 한다.

2. 로컬 저장소 (실행 중 기준 데이터)
- 수집 즉시 SQLite에 기록한다.
- 현재 fingerprint 기반 중복 억제 로직을 유지한다.

3. 동기화 엔진 (백그라운드)
- 로그인 사용자가 있을 때 미동기화 로컬 데이터를 클라우드로 전송한다.
- 실패 시 backoff 재시도.
- 내구성을 위해 로컬 `sync_queue` 테이블을 사용한다.

4. 클라우드 저장소 (회원 단위)
- 각 아이템 row가 사용자 id를 소유해야 한다.
- 조회 페이지는 로컬 우선 + 클라우드 보강(backfill) 또는 병합 전략을 사용할 수 있다.

## 4) 데이터 모델 변경

### 4.1 Supabase 스키마 마이그레이션

소유권 컬럼 추가:

- `sessions.owner_id uuid not null`
- `items.owner_id uuid not null`

인덱스 추가:

- `idx_items_owner_captured (owner_id, captured_at desc)`
- `idx_items_owner_fingerprint_captured (owner_id, fingerprint, captured_at desc)`

권장 제약:

- 동기화 멱등성을 위한 unique 키: `(owner_id, id)` 또는 `source_item_id`.

### 4.2 로컬 SQLite 마이그레이션

sync 메타데이터/큐 추가:

- `items.sync_state TEXT NOT NULL DEFAULT 'pending'` (`pending|synced|failed`)
- `items.last_sync_at TEXT`
- `items.sync_error TEXT`
- 신규 `sync_queue` 테이블:
  - `id INTEGER PK`
  - `entity_type TEXT` (`item|setting`)
  - `entity_id TEXT`
  - `operation TEXT` (`upsert|delete`)
  - `attempt_count INTEGER`
  - `next_retry_at TEXT`
  - `last_error TEXT`
  - `created_at TEXT`

## 5) 인증/보안

- EXE는 사용자 액세스 토큰(Supabase Auth)만 사용한다.
- 서비스 롤 키는 절대 클라이언트 번들에 포함하지 않는다.
- 서버의 비공개 API는 기존처럼 인증을 유지한다(로컬 게스트 허용 경로는 예외).
- RLS를 마스터 단일 정책에서 사용자 소유권 정책으로 전환한다.

RLS 목표 예시:

- `items`: `owner_id = auth.uid()` 인 데이터만 read/write
- `sessions`: `owner_id = auth.uid()` 인 데이터만 read/write
- `item_stats`: 소유한 `items`를 통해 read/write

## 6) 동기화 프로토콜

### 6.1 Push (로컬 -> 클라우드)

- 트리거: 로그인 성공, 앱 시작, 주기 타이머, 신규 아이템 저장 시.
- 배치 크기: 50~200 rows.
- API 방식: 결정적 키(`id`) 기반 upsert.
- 성공 시: 로컬 `sync_state='synced'`, queue 항목 제거.
- 실패 시: `attempt_count` 증가, 지수 backoff.

### 6.2 Pull (클라우드 -> 로컬)

- 트리거: 로그인 성공 시점 + 주기 refresh.
- 기준: `captured_at > last_pull_cursor`.
- 로컬 SQLite에 item id 기준 upsert.
- 삭제는 명시 정책으로 처리(암묵적 hard delete 금지).

### 6.3 충돌 정책

- 일반 흐름에서 아이템은 append-only에 가까워 충돌 가능성은 낮다.
- 동일 id 충돌 시: 클라우드 canonical 우선, 로컬에만 있는 `raw_json`은 보존.

## 7) API/Repository 리팩터링 계획

### 7.1 Repository 분리

현재 `app/src/server/repository.ts`가 메모리/클라우드 동작을 함께 갖고 있어 역할 분리가 필요하다.

- `repository-local.ts` (SQLite)
- `repository-cloud.ts` (Supabase)
- `sync-service.ts` (queue 처리)

### 7.2 신규 엔드포인트

- `POST /api/sync/push`: 미동기화 배치 push
- `GET /api/sync/pull?since=...`: 클라우드 변경분 pull
- `GET /api/sync/status`: pending/failed 수치 조회

## 8) EXE 패키징 계획

기존 Tauri 설정 기반으로 진행:

1. Windows용 `npm run tauri:build` CI 파이프라인 구성
2. 설치파일 + 릴리즈 노트 배포
3. 2단계에서 자동 업데이트(Tauri updater) 도입

런타임 요구사항:

- 앱 실행 시 로컬 API 서비스 자동 기동
- UI에서 상태 표시: `API`, `Clipboard`, `Sync`

## 9) 단계별 롤아웃

### Phase 1 (MVP)

- EXE 설치 빌드 파이프라인
- 로컬 수집 동작 유지
- owner 기반 스키마/RLS 마이그레이션
- 로그인 사용자 대상 단방향 push sync

### Phase 2 (안정화)

- pull sync + cursor
- sync queue 재시도/backoff + 상태 UI
- 실패 원인 진단 화면

### Phase 3 (제품 완성도)

- 자동 업데이트
- 백업/내보내기/가져오기 UX
- 다중 디바이스 정합성 고도화

## 10) 완료 기준 (Acceptance Criteria)

- 오프라인에서도 수집이 클라우드 의존 없이 동작한다.
- 재연결/로그인 후 60초 내 pending 데이터가 동기화된다.
- 서로 다른 두 사용자 간 데이터 read/write가 불가능하다.
- 재설치 후 로그인 + pull로 클라우드 이력 복구가 가능하다.
- OBS 오버레이는 로컬 소스에서 기존처럼 동작한다.

## 11) 리스크와 대응

- 리스크: 장시간 방송 중 토큰 만료
  - 대응: 주기적 토큰 갱신 + 큐 pause/resume
- 리스크: 중복 업로드
  - 대응: 멱등 upsert 키 + owner 인덱스
- 리스크: SQLite/Supabase 스키마 드리프트
  - 대응: 마이그레이션 버전 테이블 + 시작 시 검사

## 12) 즉시 구현 권장 순서

1. `owner_id` + owner 기반 RLS SQL 마이그레이션 추가
2. `app/src/server/db.ts`에 로컬 `sync_queue` 마이그레이션 추가
3. `sync-service.ts`(push-only 루프) 구현
4. `GET /api/sync/status` 노출 및 Settings 화면에 상태 표시
