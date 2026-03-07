# Parsing Rules

클립보드 JSON을 내부 데이터 구조로 변환한다.

참고  
`docs/data/10-json-spec.md`

---

# display_name

display_name = name ?? type

---

# corrupted 판별

다음 중 하나 만족

1.

corrupted: 1

2.

name = Corrupt

---

# quantity 처리

다음 필드 존재 시

quantity

stack item으로 처리

예

- WSS
- 재료

---

# stats 파싱

stats 배열을 다음 구조로 저장

item_stats

각 stat

| field      | 설명      |
| ---------- | --------- |
| stat_name  | 옵션 이름 |
| stat_value | 값        |
| range_min  | 최소      |
| range_max  | 최대      |

---

# range 없는 stat

range 필드가 없으면

range_min = null  
range_max = null

---

# stat_id 없는 stat

stat_id는 optional

---

# category 생성

base_type 기반

예

boots  
armor  
weapon  
jewel  
rune  
material

---

# icon_key 생성

icon mapping 사용

참고  
`docs/assets/31-icon-mapping-rules.md`
