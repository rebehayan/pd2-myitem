# OBS Integration

이 문서는 PD2 Item Tracker와 OBS 방송 화면을 연동하는 방법을 정의한다.

참고\
docs/ui/20-overlay-ui.md\
docs/api/50-local-api.md

---

# 목적

게임 플레이 중 획득한 아이템을 방송 화면에 실시간으로 표시한다.

사용자는 다음과 같은 흐름을 경험한다.

게임에서 아이템 획득\
↓\
Ctrl + C\
↓\
Clipboard 감지\
↓\
아이템 저장\
↓\
Overlay 업데이트\
↓\
OBS 화면 표시\

---

# 기본 구조

OBS 연동은 **Browser Source**를 사용한다.

OBS는 다음 URL을 읽는다.

http://localhost:{PORT}/overlay\
예

http://localhost:4173/overlay\
이 페이지는 **React Overlay UI**를 렌더링한다.

---

# OBS 설정

OBS에서 다음 설정을 사용한다.

### Source Type

## Browser Source\

### URL

## http://localhost:4173/overlay\

### Width

## 400\

### Height

## 800\

### FPS

## 30\

### Shutdown source when not visible

권장

## OFF\

### Refresh browser when scene becomes active

선택 사항

## ON\

# Overlay 데이터 흐름

Overlay 페이지는 다음 API를 호출한다.

GET /api/overlay\
응답 예

```json\
[\
  {\
    "display_name": "Goblin Toe",\
    "quality": "Unique",\
    "quantity": null,\
    "thumbnail": "/icons/boots/light_plated_boots.png",\
    "captured_at": "2025-01-01T12:00:00"\
  }\
]

* * * * *

Overlay 갱신 방식
=============

Overlay는 일정 시간 간격으로 API를 호출한다.

권장 방식

polling

간격

1000 ms

즉

1초마다 최근 아이템 확인

* * * * *

Overlay 표시 구조
=============

Overlay는 최근 획득 아이템 목록을 표시한다.

예

[아이콘] Goblin Toe\
[아이콘] Worldstone Shard x21\
[아이콘] Rare Ring

각 행에는 다음 정보가 표시된다.

| 요소 | 설명 |
| --- | --- |
| icon | 아이템 썸네일 |
| name | 아이템 이름 |
| quantity | 수량 |
| quality | 품질 색상 |
| corrupted | 표시 |

* * * * *

Overlay UI 정책
=============

방송 화면에서 잘 보이도록 다음 규칙을 사용한다.

### 아이템 수

최대 10개

* * * * *

### 표시 위치

권장

오른쪽 세로 리스트

* * * * *

### 애니메이션

새 아이템 등장 시

fade + slide

* * * * *

### 텍스트 길이 제한

2줄

* * * * *

### overflow 처리

ellipsis

* * * * *

아이템 표시 예시
=========

Unique 아이템

[icon] Goblin Toe

재료 아이템

[icon] Worldstone Shard x21

Magic 아이템

[icon] Ring

* * * * *

품질 색상
=====

| 품질 | 색상 |
| --- | --- |
| Normal | Gray |
| Magic | Blue |
| Rare | Yellow |
| Set | Green |
| Unique | Gold |

* * * * *

Corrupted 표시
============

Corrupted 아이템은 다음 표시를 추가한다.

[Corrupted]

또는

red badge

* * * * *

OBS 테스트 절차
==========

방송 전에 다음 테스트를 수행한다.

### 테스트 1

Worldstone Shard 복사

Overlay 표시 확인

* * * * *

### 테스트 2

Unique 아이템 복사

썸네일 확인

* * * * *

### 테스트 3

연속 아이템 복사

Overlay 업데이트 확인

* * * * *

Overlay 성능 고려
=============

Overlay는 가볍게 유지한다.

권장 사항

-   React 상태 최소화

-   이미지 lazy load

-   최대 아이템 수 제한

* * * * *

향후 확장
=====

가능한 확장

| 기능 | 설명 |
| --- | --- |
| 사운드 알림 | 유니크 드랍 |
| 색상 애니메이션 | 레어 드랍 |
| 룬 강조 | 고룬 표시 |

* * * * *

관련 문서
=====

참고\
docs/ui/20-overlay-ui.md

참고\
docs/api/50-local-api.md

참고\
docs/assets/30-icon-strategy.md
```
