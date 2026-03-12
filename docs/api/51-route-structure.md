# Route Structure

이 문서는 웹 UI와 API의 라우팅 구조를 정의한다.

참고\
docs/api/50-local-api.md\
docs/03-architecture.md

---

# 전체 구조

프로젝트는 두 가지 라우트 영역으로 나뉜다.

| 영역 | 설명 |\
|-----|------|\
| UI Routes | 사용자 인터페이스 페이지 |\
| API Routes | 데이터 제공 API |

---

# UI Routes

사용자가 브라우저에서 접근하는 페이지.

---

## Dashboard

/\
기능

- 최근 아이템 목록\
- 검색\
- 아이템 상세\
- 공유 포맷 생성\
- QR 코드 생성

참고\
docs/ui/21-dashboard-ui.md

---

## Overlay

/overlay\
OBS Browser Source에서 사용하는 페이지.

기능

- 최근 획득 아이템 표시\
- 방송 화면 오버레이

참고\
docs/ui/20-overlay-ui.md

---

## Today Page

/today\
오늘 획득 아이템 공개 페이지.

기능

- 아이템 목록\
- 통계 표시\
- 모바일 최적화

참고\
docs/ui/22-today-page-ui.md

---

## Item Detail

/item/:id\
특정 아이템 상세 정보 페이지.

표시 내용

- 썸네일\
- 이름\
- 품질\
- stats\
- item level\
- defense\
- 공유 버튼

---

## Settings

/settings\
설정 페이지.

가능 설정

- overlay 표시 개수\
- overlay 위치\
- overlay 투명도\
- QR 공개 설정\
- QR 토큰

참고\
docs/operations/61-config-and-settings.md

---

# API Routes

API는 로컬 서버에서 제공된다.

base URL

/api\
예

## http://localhost:4173/api\

# Item API

## 최근 아이템

GET /api/items/recent\
최근 획득 아이템 목록 반환.

---

## 오늘 아이템

GET /api/items/today\
오늘 획득 아이템 반환.

---

## 아이템 상세

GET /api/items/:id\
특정 아이템 상세 정보 반환.

---

# Overlay API

OBS overlay에서 사용하는 API.

GET /api/overlay\
반환 데이터

- 최근 아이템\
- 썸네일\
- 이름\
- 품질

---

# Stats API

통계 데이터 제공.

GET /api/stats/today\
예시 응답

```json\
{\
  "total_items": 42,\
  "unique_items": 3,\
  "runes": 5,\
  "materials": 12\
}

---

# Health API

GET /api/health\
서버 상태 확인

---

# Events API

GET /api/events/items\
SSE 기반 item-captured 이벤트 스트림

---

# Ingest API

POST /api/ingest\
JSON payload를 수동 저장

---

# Settings API

설정 데이터 제공/갱신.

GET /api/settings\
현재 설정 조회

PUT /api/settings\
설정 값 업데이트

* * * * *

Route 설계 원칙
===========

다음 원칙을 따른다.

1.  UI route와 API route 분리

2.  REST 스타일 유지

3.  overlay는 별도 API 사용

4.  today page는 API 기반 렌더링

* * * * *

추천 라우트 구조
=========

/\
 /overlay\
 /today\
 /item/:id\
 /settings

/api\
 /api/items/recent\
 /api/items/today\
 /api/items/:id\
 /api/overlay\
 /api/stats/today\
 /api/settings\
 /api/health\
 /api/events/items\
 /api/ingest

* * * * *

향후 확장
=====

추가 가능 API

/api/items/search\
/api/items/session\
/api/items/category

* * * * *

관련 문서
=====

참고\
docs/api/50-local-api.md

참고\
docs/ui/21-dashboard-ui.md

참고\
docs/ui/20-overlay-ui.md
```
