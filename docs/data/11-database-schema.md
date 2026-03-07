# Database Schema

데이터베이스는 SQLite를 사용한다.

---

# items 테이블

아이템 기본 정보

| column       | type     | description |
| ------------ | -------- | ----------- |
| id           | uuid     | PK          |
| captured_at  | datetime | 수집 시각   |
| session_id   | uuid     | 세션        |
| raw_json     | text     | 원본 JSON   |
| fingerprint  | text     | 중복 방지   |
| name         | text     | 아이템 이름 |
| base_type    | text     | type        |
| quality      | text     | 품질        |
| location     | text     | 위치        |
| item_level   | integer  | iLevel      |
| defense      | integer  | 방어도      |
| quantity     | integer  | 수량        |
| display_name | text     | 표시 이름   |
| is_corrupted | boolean  | 타락 여부   |
| icon_key     | text     | 아이콘 키   |
| category     | text     | 카테고리    |

---

# item_stats 테이블

아이템 옵션

| column     | type    |
| ---------- | ------- |
| id         | integer |
| item_id    | uuid    |
| stat_id    | integer |
| stat_name  | text    |
| stat_value | real    |
| range_min  | real    |
| range_max  | real    |
| corrupted  | boolean |

---

# sessions 테이블

방송 세션

| column     | type     |
| ---------- | -------- |
| id         | uuid     |
| title      | text     |
| started_at | datetime |
| ended_at   | datetime |
| active     | boolean  |

---

# fingerprint

중복 저장 방지

생성 방식
sha256(canonical_json)

같은 fingerprint는 3초 내 중복 저장 방지

참고  
`docs/data/12-parsing-rules.md`
