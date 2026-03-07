# Config and Settings

사용자 설정 관리 문서.

---

# 설정 목적

다음 기능을 사용자 환경에 맞게 조정할 수 있게 한다.

---

# 설정 목록

## Overlay 설정

| 설정 | 설명 |\
|-----|------|\
| overlay_item_limit | 표시 개수 |\
| overlay_position | 위치 |\
| overlay_opacity | 투명도 |

예

## overlay_item_limit = 10\

## UI 설정

| 설정 | 설명 |\
|-----|------|\
| theme | dark / light |\
| font_scale | UI 글자 크기 |

---

## 데이터 설정

| 설정 | 설명 |\
|-----|------|\
| session_name | 방송 세션 이름 |\
| save_history_days | 기록 보관 기간 |

---

## QR 페이지 설정

| 설정 | 설명 |\
|-----|------|\
| qr_public_enabled | 공개 여부 |\
| qr_token | 보안 토큰 |

---

# 설정 저장 위치

SQLite settings table

또는

## config.json\

# 예시 config.json

````json\
{\
  "overlay_item_limit": 10,\
  "overlay_opacity": 0.8,\
  "theme": "dark",\
  "qr_public_enabled": true\
}

* * * * *

설정 UI 위치
========

Dashboard → Settings

참고\
`docs/ui/21-dashboard-ui.md`\
---

# 3️⃣ `docs/operations/62-security-and-sharing.md`

```md\
# Security and Sharing

QR 페이지와 공개 데이터 접근 정책 정의.

---

# 목적

오늘 획득 아이템을 외부에 공개할 때 보안을 유지한다.

---

# 공개 데이터

공개 가능한 정보

- 아이템 이름\
- 품질\
- 썸네일\
- 획득 시간

공개하지 않는 정보

- PC 경로\
- 로컬 DB\
- 내부 ID

---

# 공개 URL 방식

두 가지 방식 가능

## 1. 공개 URL

예

https://example.com/today\
모든 사람이 접근 가능

---

## 2. 토큰 URL

예

https://example.com/today?key=abc123\
토큰을 아는 사람만 접근

---

# 추천 방식

초기

토큰 URL

---

# 토큰 생성

길이

32 chars\
예

8fa3d92c41c0eab52e0a1f7f1d8d1c31\
---

# QR 코드 정책

QR 코드는 항상 **token URL**로 생성한다.

예

/today?key=token\
---

# 데이터 보호

공개 페이지는 다음 정보만 제공

| 항목 | 공개 여부 |\
|----|-----------|\
| 아이템 이름 | O |\
| 썸네일 | O |\
| stats | O |\
| 내부 ID | X |

---

# Rate Limit

외부 접근 제한

예

60 req/min\
---

# 캐싱

오늘 페이지는 캐싱 가능

예

30 sec cache\
---

# 로그

접근 로그 기록 가능

예

IP\
timestamp\
---

# 참고

참고\
`docs/ui/23-qr-page-flow.md`
````
