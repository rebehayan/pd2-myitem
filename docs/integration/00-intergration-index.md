# Integration Index

이 문서는 외부 시스템과의 연동 문서를 모아둔 인덱스 문서이다.

프로젝트는 여러 외부 환경과 연동된다.

대표적으로 다음 시스템과 연결된다.

- OBS
- Discord
- Reddit
- 방송 채팅
- Clipboard
- QR 공유 페이지

각 연동은 별도의 문서로 관리한다.

---

# Integration 문서 목록

| 문서                       | 설명                   |
| -------------------------- | ---------------------- |
| 40-obs-integration.md      | OBS 방송 오버레이 연동 |
| 41-discord-format.md       | Discord 공유 포맷      |
| 42-reddit-format.md        | Reddit 공유 포맷       |
| 43-compact-format.md       | 방송 채팅용 포맷       |
| 44-clipboard-monitoring.md | 클립보드 감시          |

---

# 연동 흐름

아이템 복사

Ctrl + C

↓

Clipboard Monitoring

↓

JSON Parsing

↓

DB 저장

↓

UI 업데이트

↓

Overlay 업데이트

↓

공유 포맷 생성

---

# 관련 문서

참고  
docs/03-architecture.md

참고  
docs/api/50-local-api.md
