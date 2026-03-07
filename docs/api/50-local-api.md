# Local API

로컬 앱 내부에서 사용하는 API 명세.

## 목적

- UI 데이터 제공
- OBS overlay 데이터 제공
- 아이템 상세 조회
- 통계 제공
- 설정 조회/저장

## Base URL

`http://127.0.0.1:{PORT}/api`

예: `http://127.0.0.1:4173/api`

## API 목록

### 최근 아이템

`GET /api/items/recent`

응답 예시:

```json
[
  {
    "id": "uuid",
    "display_name": "Goblin Toe",
    "quality": "Unique",
    "quantity": null,
    "is_corrupted": true,
    "thumbnail": "/icons/boots/light_plated_boots.png",
    "captured_at": "2025-01-01T12:00:00"
  }
]
```

### 오늘 아이템

`GET /api/items/today`

### 아이템 상세

`GET /api/items/:id`

### Overlay 데이터

`GET /api/overlay`

OBS overlay 전용 데이터. 최근 N개 아이템 반환.

### 오늘 통계

`GET /api/stats/today`

응답 예시:

```json
{
  "total_items": 42,
  "unique_items": 3,
  "runes": 5,
  "materials": 12
}
```

### 설정 조회/저장

`GET /api/settings`

현재 앱 설정 반환.

`PUT /api/settings`

설정 값 업데이트.

요청/응답 키 예시:

```json
{
  "overlay_item_limit": 10,
  "overlay_position": "right",
  "overlay_opacity": 0.8,
  "theme": "light",
  "qr_public_enabled": true,
  "qr_token": "8fa3d92c41c0eab52e0a1f7f1d8d1c31"
}
```

### 헬스체크

`GET /api/health`

서버 상태 확인용 경량 엔드포인트.

응답 예시:

```json
{
  "ok": true
}
```

### 수집 이벤트 스트림

`GET /api/events/items`

SSE(Server-Sent Events)로 `item-captured` 이벤트를 스트리밍한다.

이벤트 예시:

```text
event: item-captured
data: {"itemId":"uuid","displayName":"Goblin Toe","capturedAt":"2026-03-07T07:00:00.000Z"}
```

### 수동 Ingest

`POST /api/ingest`

클립보드 파이프라인과 동일한 저장 로직을 API로 호출한다.

요청 예시:

```json
{
  "payload": "{\"type\":\"Ring\",\"quality\":\"Magic\"}"
}
```

## API 정책

- 모든 API는 로컬 전용
- 인증 없음
- 외부 접근 차단 권장
