# Sample Items

이 문서는 PD2 아이템 JSON 샘플을 모아둔 테스트 데이터 문서이다.

이 데이터는 다음 용도로 사용한다.

- JSON parser 테스트\
- clipboard monitoring 테스트\
- database 저장 테스트\
- UI 렌더링 테스트

참고\
docs/data/10-json-spec.md\
docs/data/12-parsing-rules.md

---

# 1 Normal Material

예: Worldstone Shard

```json\
{\
  "iLevel": 99,\
  "location": "Inventory",\
  "quality": "Normal",\
  "quantity": 21,\
  "type": "Worldstone Shard"\
}

* * * * *

2 Normal Rune
=============

{\
  "iLevel": 95,\
  "location": "Inventory",\
  "quality": "Normal",\
  "type": "Ohm Rune"\
}

* * * * *

3 Magic Item
============

{\
  "iLevel": 88,\
  "location": "Inventory",\
  "quality": "Magic",\
  "type": "Ring",\
  "stats": [\
    {\
      "name": "Faster Cast Rate",\
      "value": 10\
    },\
    {\
      "name": "Mana",\
      "value": 35\
    }\
  ]\
}

* * * * *

4 Rare Item
===========

{\
  "iLevel": 92,\
  "location": "Inventory",\
  "quality": "Rare",\
  "type": "Amulet",\
  "stats": [\
    {\
      "name": "All Resistances",\
      "value": 18\
    },\
    {\
      "name": "Strength",\
      "value": 12\
    }\
  ]\
}

* * * * *

5 Unique Item
=============

예: Goblin Toe

{\
  "defense": 33,\
  "iLevel": 90,\
  "location": "Equip",\
  "name": "Goblin Toe",\
  "quality": "Unique",\
  "type": "Light Plated Boots",\
  "stats": [\
    {\
      "name": "Chance of Crushing Blow",\
      "value": 23,\
      "range": {\
        "min": 15,\
        "max": 25\
      }\
    },\
    {\
      "name": "Faster Run/Walk",\
      "value": 20\
    }\
  ]\
}

* * * * *

6 Corrupted Unique
==================

{\
  "defense": 33,\
  "iLevel": 90,\
  "location": "Equip",\
  "name": "Goblin Toe",\
  "quality": "Unique",\
  "type": "Light Plated Boots",\
  "stats": [\
    {\
      "name": "Chance of Crushing Blow",\
      "value": 23,\
      "range": {\
        "min": 15,\
        "max": 25\
      }\
    },\
    {\
      "name": "Faster Hit Recovery",\
      "value": 10,\
      "corrupted": 1\
    }\
  ]\
}

* * * * *

7 Charm
=======

{\
  "iLevel": 91,\
  "location": "Inventory",\
  "quality": "Magic",\
  "type": "Small Charm",\
  "stats": [\
    {\
      "name": "Fire Resist",\
      "value": 7\
    }\
  ]\
}

* * * * *

8 Jewel
=======

{\
  "iLevel": 94,\
  "location": "Inventory",\
  "quality": "Rare",\
  "type": "Jewel",\
  "stats": [\
    {\
      "name": "Enhanced Damage",\
      "value": 30\
    },\
    {\
      "name": "Attack Rating",\
      "value": 120\
    }\
  ]\
}

* * * * *

테스트 시나리오
========

개발 중 다음 테스트를 수행한다.

Clipboard Test
--------------

Ctrl + C 후 JSON 감지

예

Worldstone Shard\
Goblin Toe

* * * * *

Parser Test
-----------

다음 값이 정상 파싱되는지 확인

| 필드 | 기대 결과 |
| --- | --- |
| name | 아이템 이름 |
| type | 베이스 타입 |
| quality | 품질 |
| quantity | 수량 |
| stats | 옵션 배열 |
```
