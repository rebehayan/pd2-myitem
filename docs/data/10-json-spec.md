# JSON Specification

PD2에서 Ctrl+C로 복사되는 아이템 데이터 구조

---

# 기본 구조

예시

```json
{
  "iLevel": 99,
  "location": "Inventory",
  "quality": "Normal",
  "quantity": 21,
  "type": "Worldstone Shard"
}
```

---

# 주요 필드

| 필드     | 설명          |
| -------- | ------------- |
| name     | 아이템 이름   |
| type     | 베이스 아이템 |
| quality  | 아이템 등급   |
| iLevel   | 아이템 레벨   |
| defense  | 방어도        |
| quantity | 수량          |
| location | 위치          |
| stats    | 옵션 목록     |

---

# stats 구조

{\
 "name": "Faster Run/Walk",\
 "stat_id": 96,\
 "value": 20\
}

range가 있는 경우

{\
 "name": "Crushing Blow",\
 "range": {\
 "min": 15,\
 "max": 25\
 },\
 "value": 23\
}

---

# corrupted 판별

stats 내부에 다음이 있으면 corrupted

corrupted: 1

또는

name = Corrupt

---

# display_name 생성 규칙

display_name = name ?? type

즉 name이 있으면 name 사용\
없으면 type 사용\

---

# 5️⃣ `docs/data/13-sample-items.md`

````md\
# Sample Items

테스트용 JSON 데이터 모음

---

# 재료 아이템

```json\
{\
  "iLevel": 99,\
  "location": "Inventory",\
  "quality": "Normal",\
  "quantity": 21,\
  "type": "Worldstone Shard"\
}

* * * * *

유니크 아이템
=======

{\
  "defense": 33,\
  "iLevel": 90,\
  "location": "Equip",\
  "name": "Goblin Toe",\
  "quality": "Unique",\
  "type": "Light Plated Boots"\
}

* * * * *

corrupted 아이템
=============

{\
  "name": "Goblin Toe",\
  "quality": "Unique",\
  "type": "Light Plated Boots",\
  "stats": [\
    {\
      "corrupted": 1,\
      "name": "Faster Hit Recovery",\
      "value": 10\
    }\
  ]\
}

* * * * *

stack 아이템
=========

{\
  "type": "Worldstone Shard",\
  "quantity": 12,\
  "quality": "Normal"\
}

* * * * *

name 없는 아이템
===========

{\
  "quality": "Magic",\
  "type": "Ring",\
  "iLevel": 88\
}
````
