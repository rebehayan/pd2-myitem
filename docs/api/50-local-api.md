# Local API

로컬 앱 내부에서 사용하는 API 명세.

이 API는 다음 목적을 위해 존재한다.

- UI 데이터 제공\
- OBS overlay 데이터 제공\
- 아이템 상세 조회\
- 통계 제공

---

# Base URL

````text\
http://127.0.0.1:{PORT}/api

PORT는 앱 시작 시 설정된다.

예

http://127.0.0.1:4173/api

* * * * *

API 목록
======

최근 아이템
------

GET /api/items/recent

### 설명

최근 획득 아이템 반환

### 응답 예시

[\
  {\
    "id": "uuid",\
    "display_name": "Goblin Toe",\
    "quality": "Unique",\
    "quantity": null,\
    "is_corrupted": true,\
    "thumbnail": "/icons/boots/light_plated_boots.png",\
    "captured_at": "2025-01-01T12:00:00"\
  }\
]

* * * * *

오늘 아이템
------

GET /api/items/today

### 설명

오늘 획득 아이템 전체 목록

* * * * *

아이템 상세
------

GET /api/items/:id

### 설명

특정 아이템 상세

* * * * *

overlay 데이터
-----------

GET /api/overlay

### 설명

OBS overlay 전용 데이터

최근 N개 아이템만 반환

* * * * *

오늘 통계
-----

GET /api/stats/today

### 응답

{\
  "total_items": 42,\
  "unique_items": 3,\
  "runes": 5,\
  "materials": 12\
}

* * * * *

API 정책
======

-   모든 API는 로컬 전용

-   인증 없음

-   외부 접근 차단 권장\
---

# 2️⃣ `docs/api/51-route-structure.md`

```md\
# Route Structure

웹 UI 라우팅 구조 정의.

---

# 페이지 목록

| route | 설명 |\
|------|------|\
| / | dashboard |\
| /overlay | 방송 오버레이 |\
| /today | 오늘 아이템 목록 |\
| /item/:id | 아이템 상세 |\
| /settings | 설정 |

---

# /

## Dashboard

최근 아이템 목록\
아이템 검색\
아이템 공유

참고\
`docs/ui/21-dashboard-ui.md`

---

# /overlay

OBS Browser Source 전용 페이지

참고\
`docs/ui/20-overlay-ui.md`

---

# /today

오늘 획득 아이템 공개 페이지

참고\
`docs/ui/22-today-page-ui.md`

---

# /item/:id

아이템 상세 페이지

표시 내용

- 아이템 이름\
- 썸네일\
- stats\
- 공유 버튼

---

# /settings

설정 페이지

가능 설정

- overlay 표시 개수\
- 품질 색상\
- 세션 이름
````
