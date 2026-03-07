# OBS Overlay UI

최근 획득 아이템을 방송 화면에 표시한다.

참고  
`docs/integration/40-obs-integration.md`

---

# 기본 구조

각 행은 다음 요소 포함

- 썸네일
- 아이템 이름
- 품질 배지
- 수량 배지
- corrupted 배지

---

# 표시 개수

기본

10개

설정 가능

5 / 10 / 15

---

# 정렬

최근 획득 순

---

# 애니메이션

새 아이템 추가

slide + fade

---

# 색상 정책

| quality | color  |
| ------- | ------ |
| Normal  | gray   |
| Magic   | blue   |
| Rare    | yellow |
| Set     | green  |
| Unique  | gold   |

---

# corrupted 표시

붉은 badge

---

# 레이아웃

[icon] Item Name (Unique)
qty badge
corrupted badge

---

# 방송 UI 정책

- 반투명 배경
- 큰 폰트
- 최대 두 줄
- overflow ellipsis
