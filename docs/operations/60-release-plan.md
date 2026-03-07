# Release Plan

이 문서는 프로젝트 배포 전략과 릴리즈 단계를 정의한다.

---

# 목표

안정적인 단계별 배포를 통해 방송 도구를 점진적으로 완성한다.

---

# Release 단계

## Version 0.1 (MVP)

목표

아이템 수집 + 방송 오버레이

포함 기능

- clipboard monitoring
- JSON parsing
- SQLite 저장
- 최근 아이템 목록
- OBS overlay
- 기본 썸네일

참고  
`docs/integration/44-clipboard-monitoring.md`

---

## Version 0.2

목표

공유 기능 추가

포함 기능

- Discord format
- Reddit format
- Compact format

참고  
`docs/integration/41-discord-format.md`

---

## Version 0.3

목표

QR 공유 페이지

포함 기능

- today page
- QR 코드

참고  
`docs/ui/22-today-page-ui.md`

---

## Version 0.4

목표

아이콘 확장

포함 기능

- icon mapping
- category fallback

참고  
`docs/assets/31-icon-mapping-rules.md`

---

## Version 0.5

목표

유니크 이미지

포함 기능

- unique image system

참고  
`docs/assets/32-unique-image-phase2.md`

---

# 배포 방식

초기

- 로컬 실행

후기

- 설치 패키지 제공

예
PD2 Item Tracker Setup.exe

---

# 업데이트 전략

2가지

1️⃣ 수동 업데이트  
2️⃣ 자동 업데이트 (후기)

---

# 테스트 전략

### 테스트 환경

- Windows
- OBS

### 테스트 시나리오

- 아이템 복사
- overlay 표시
- QR 페이지 표시

---

# 릴리즈 체크리스트

- [ ] overlay 정상 동작
- [ ] JSON 파싱 정상
- [ ] icon fallback 정상
- [ ] share format 정상
