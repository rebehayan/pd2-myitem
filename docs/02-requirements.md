# Requirements

## 핵심 기능

### 아이템 수집

- Ctrl+C JSON 감지
- 자동 DB 저장
- 중복 제거

참고: `docs/integration/44-clipboard-monitoring.md`

---

### 아이템 목록

- 최근 획득 아이템
- 오늘 획득 목록
- 검색 및 필터

참고: `docs/ui/21-dashboard-ui.md`

---

### 방송 오버레이

OBS Browser Source로 아이템 표시

참고:

- `docs/ui/20-overlay-ui.md`
- `docs/integration/40-obs-integration.md`

---

### 아이템 공유

아이템 설명을 다음 포맷으로 생성

- Discord
- Reddit
- Compact

참고:

- `docs/integration/41-discord-format.md`
- `docs/integration/42-reddit-format.md`
- `docs/integration/43-compact-format.md`

---

### QR 페이지

오늘 획득 아이템 목록 공개

참고:

- `docs/ui/22-today-page-ui.md`

---

# MVP 범위

다음 기능이 동작하면 MVP 완료

- JSON 자동 수집
- DB 저장
- 최근 아이템 목록
- OBS 오버레이
- 기본 썸네일
- Discord 포맷
- QR 페이지

---

# 제외 기능

다음 기능은 구현하지 않는다.

- 게임 메모리 접근
- 패킷 분석
- 자동 입력
