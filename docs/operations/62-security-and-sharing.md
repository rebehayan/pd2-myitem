# Security and Sharing

QR 페이지와 공개 데이터 접근 정책을 정의한다.

참고\
docs/ui/23-qr-page-flow.md

---

# 목적

방송 시청자가 QR 코드로 오늘 획득 아이템을 확인할 수 있게 하면서도\
불필요한 정보 노출을 막는다.

---

# 공개 데이터 범위

공개 가능한 데이터

| 항목 | 공개 여부 |\
|-----|-----------|\
| 아이템 이름 | O |\
| 품질 | O |\
| 썸네일 | O |\
| 수량 | O |\
| stats | O |\
| 획득 시간 | O |

공개하지 않는 데이터

| 항목 | 공개 여부 |\
|-----|-----------|\
| 로컬 DB ID | X |\
| 세션 ID | X |\
| 파일 경로 | X |\
| 내부 로그 | X |

---

# URL 접근 방식

QR 페이지 접근 방식은 두 가지를 지원한다.

---

## 1. 공개 URL

예

https://domain.com/today\
특징

- 누구나 접근 가능\
- 설정 없이 사용 가능

단점

- 링크가 퍼질 수 있음

---

## 2. 토큰 URL (권장)

예

https://domain.com/today?key=abc123\
특징

- 토큰을 아는 사람만 접근 가능\
- QR 코드에 토큰 포함

---

# 토큰 생성 규칙

토큰 길이

32 characters\
예

8fa3d92c41c0eab52e0a1f7f1d8d1c31\
생성 방식

## random hex string\

# QR 코드 정책

Dashboard 화면에서 QR 코드를 생성한다.

QR 링크 예

## /today?key={token}\

운영 시 공개 프록시 규칙

- 공개 라우팅 허용: `/api/health`, `/api/today/public`만 허용
- 비공개 유지: `/api/settings`, `/api/items/*`, `/api/events/*`, `/api/ingest`
- 프록시는 `Host`를 공개 도메인으로 고정하고 `x-forwarded-for`를 항상 주입
- `TRUST_PROXY_FOR_RATE_LIMIT=true`는 신뢰 가능한 프록시일 때만 사용

# Rate Limit

외부 접근이 과도해지는 것을 방지한다.

추천 설정

## 60 requests per minute\

# 캐싱 정책

오늘 아이템 페이지는 캐싱 가능하다.

추천

cache duration: 30 seconds\
이유

- 트래픽 감소\
- 페이지 속도 향상

---

# 로그 정책

접근 로그를 기록할 수 있다.

저장 가능한 정보

| 항목 | 설명 |\
|----|------|\
| IP | 접속 위치 |\
| timestamp | 접속 시간 |\
| path | 요청 경로 |

---

# 보안 주의사항

다음 정보는 절대 공개하지 않는다.

- SQLite 파일 경로\
- 내부 API 주소\
- 서버 설정 정보\
- 사용자 시스템 정보

---

# 향후 확장

추가 보안 옵션

- token expiration\
- session based access\
- IP whitelist

---

# 참고

참고\
docs/ui/23-qr-page-flow.md

참고\
docs/operations/61-config-and-settings.md

---

# 도메인 없는 현재 단계 운영

도메인이 없으면 로컬에서 아래 값으로 유지한다.

```env
PUBLIC_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
TRUST_PROXY_FOR_RATE_LIMIT=false
```

도메인 발급 후 교체 예시

```env
PUBLIC_ALLOWED_ORIGINS=https://your-domain.com
TRUST_PROXY_FOR_RATE_LIMIT=true
```
