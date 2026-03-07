# Icon Mapping Rules

1차 썸네일 시스템에서 아이템 이미지를 자동 매칭하기 위한 규칙 문서.

참고: `docs/assets/30-icon-strategy.md`

---

## 목적

모든 아이템을 다음 우선순위로 아이콘에 연결한다.

1. `type` 정확 매칭
2. 카테고리 fallback
3. generic fallback

---

## 기본 원칙

- 아이콘 매핑의 기준 키는 `type`
- `name`은 1차에서 아이콘 선택 기준으로 사용하지 않음
- 유니크 전용 이미지는 2차에서 별도 적용
- 매핑 실패 시 UI가 깨지지 않도록 반드시 fallback 제공

---

## 아이콘 파일 구조

````text
src/assets/icons/
  armor/
  belt/
  boots/
  charm/
  gem/
  gloves/
  helm/
  jewel/
  jewelry/
  map/
  material/
  misc/
  quest/
  rune/
  shield/
  weapon/
  generic/

  # System Architecture

## 전체 구조

이 시스템은 다음 구성요소로 이루어진다.

1\. Desktop App\
2\. Local API Server\
3\. SQLite Database\
4\. Web UI\
5\. OBS Overlay

---

# 데이터 흐름

사용자 행동

Ctrl+C (아이템 JSON 복사)

↓

클립보드 감지

↓

JSON 파싱

↓

SQLite 저장

↓

API 업데이트

↓

UI / OBS Overlay 갱신

---

# 구성 요소 설명

## Desktop App

역할

- 클립보드 감시\
- JSON 파싱\
- DB 저장\
- 로컬 서버 실행\
- 트레이 아이콘 관리

기술

- Tauri\
- Rust\
- Node bridge

---

## Local API Server

역할

UI와 OBS가 데이터를 가져갈 수 있게 한다.

예

http://localhost:xxxx/api/items

---

## SQLite

아이템 저장

테이블

- items\
- item_stats\
- sessions

참고\
`docs/data/11-database-schema.md`

---

## Web UI

다음 페이지 제공

- Dashboard\
- Overlay\
- Today\
- Item Detail

참고\
`docs/ui/21-dashboard-ui.md`

---

## OBS Overlay

OBS Browser Source에서 표시

참고\
`docs/integration/40-obs-integration.md`

---

# 주요 라우트

/api/items/recent\
/api/items/today\
/api/items/:id

/overlay\
/today\
참고\
`docs/api/51-route-structure.md`파일명 규칙
------

### 규칙

-   소문자 사용

-   공백은 `_`로 변환

-   특수문자 제거

-   확장자는 `.png`

### 예시

| type | file name |
| --- | --- |
| Light Plated Boots | `light_plated_boots.png` |
| Worldstone Shard | `worldstone_shard.png` |
| Ring | `ring.png` |
| Small Charm | `small_charm.png` |

* * * * *

icon_key 생성 규칙
--------------

### 방식

`type` 값을 정규화해서 `icon_key`를 만든다.

### 예시

Light Plated Boots -> light_plated_boots\
Worldstone Shard -> worldstone_shard

* * * * *

category 분류 규칙
--------------

`type` 기반으로 category를 먼저 생성하고, category에 따라 기본 폴더를 결정한다.

### 대표 category

-   weapon

-   armor

-   helm

-   shield

-   gloves

-   boots

-   belt

-   jewelry

-   charm

-   rune

-   gem

-   jewel

-   map

-   material

-   consumable

-   quest

-   misc

* * * * *

1차 정확 매칭
--------

먼저 `type -> file path` 매핑 JSON을 확인한다.

예시:

{\
  "Light Plated Boots": "boots/light_plated_boots.png",\
  "Worldstone Shard": "material/worldstone_shard.png",\
  "Ring": "jewelry/ring.png"\
}

파일: `src/data/icon-map.json`

* * * * *

2차 category fallback
--------------------

정확 매칭 실패 시 category 기본 아이콘을 사용한다.

예시:

{\
  "boots": "generic/boots.png",\
  "weapon": "generic/weapon.png",\
  "material": "generic/material.png",\
  "misc": "generic/misc.png"\
}

파일: `src/data/category-icon-map.json`

* * * * *

3차 generic fallback
-------------------

category도 판별 실패하면 아래 아이콘 사용

src/assets/icons/generic/item_unknown.png

* * * * *

추천 구현 함수
--------

### 함수 예시

type IconMatchResult = {\
  iconPath: string;\
  iconKey: string;\
  category: string;\
  matchedBy: 'type' | 'category' | 'generic';\
};

### 처리 순서

1.  `type` 존재 여부 확인

2.  `type` 정확 매핑 조회

3.  없으면 `type` 기반 category 판별

4.  category 아이콘 조회

5.  최종 generic 반환

* * * * *

정규화 함수 규칙
---------

### normalizeTypeKey

입력:

Light Plated Boots

출력:

light_plated_boots

### 처리 규칙

-   trim

-   lowercase

-   `/`, `-`, `'`, `,`, `(`, `)` 제거 또는 `_` 변환

-   다중 `_`는 하나로 축소

* * * * *

매핑 누락 관리
--------

매핑되지 않은 type은 로그로 남긴다.

예시:

[icon-miss] type="Sacred Armor" category="armor"

이 로그를 기반으로 `icon-map.json`을 점차 확장한다.

* * * * *

아이콘 적용 정책
---------

### 1차 표시 요소

-   base icon

-   quality frame

-   corrupted badge

-   quantity badge

### 1차에서 하지 않는 것

-   유니크 개별 이미지

-   세트 전용 개별 이미지

-   애니메이션 아이콘

* * * * *

샘플 매핑
-----

{\
  "Worldstone Shard": "material/worldstone_shard.png",\
  "Light Plated Boots": "boots/light_plated_boots.png",\
  "Ring": "jewelry/ring.png",\
  "Amulet": "jewelry/amulet.png",\
  "Small Charm": "charm/small_charm.png",\
  "Large Charm": "charm/large_charm.png",\
  "Grand Charm": "charm/grand_charm.png"\
}

* * * * *

참고
--

참고: `docs/assets/30-icon-strategy.md`\
참고: `docs/assets/32-unique-image-phase2.md`\
---

# 2️⃣ `docs/assets/32-unique-image-phase2.md`

```md\
# Unique Image Phase 2

2차 단계에서 유니크 아이템에만 전용 이미지를 적용하는 계획 문서.

참고: `docs/assets/30-icon-strategy.md`

---

## 목적

1차에서는 모든 아이템을 `베이스 아이콘 + 품질 테두리`로 처리한다.

2차에서는 유니크 아이템에 한해 `name` 기준 전용 이미지를 적용한다.

---

## 적용 대상

### 포함\
- `quality = Unique`\
- `name` 존재\
- unique-image-map에 등록된 아이템

### 제외\
- name 없는 아이템\
- 매핑되지 않은 유니크\
- 노멀 / 매직 / 레어 / 세트 아이템

---

## 기본 원칙

- 2차에서도 fallback은 반드시 유지\
- unique image가 없으면 1차 베이스 아이콘 사용\
- 2차 적용은 점진적으로 확장

---

## 파일 구조

```text\
src/assets/unique/\
  goblin_toe.png\
  shako.png\
  ...

* * * * *

매핑 파일
-----

파일: `src/data/unique-image-map.json`

예시:

{\
  "Goblin Toe": "goblin_toe.png",\
  "Harlequin Crest": "harlequin_crest.png"\
}

* * * * *

적용 로직
-----

### 우선순위

1.  `quality === Unique`

2.  `name` 존재

3.  unique-image-map에서 `name` 조회

4.  이미지 있으면 unique image 사용

5.  없으면 base icon fallback

* * * * *

recommended 함수 구조
-----------------

type ResolveThumbnailResult = {\
  imagePath: string;\
  source: 'unique' | 'base' | 'category' | 'generic';\
};

* * * * *

운영 방식
-----

### 초기 운영

-   자주 등장하는 유니크부터 수동 등록

-   방송에서 자주 보이는 유니크 우선

-   인기 유니크 위주로 시작

### 확장 운영

-   unique miss 로그 수집

-   누락 이미지 점진적 추가

* * * * *

로그 정책
-----

매핑되지 않은 유니크 발견 시 로그 기록

[unique-image-miss] name="Goblin Toe" type="Light Plated Boots"

* * * * *

관리 포인트
------

-   `name` 문자열이 정확히 같아야 매칭 가능

-   이름 표기 변화가 있으면 alias 필요

-   언어/서버 차이가 있다면 별도 normalization 고려

* * * * *

후순위 확장 아이디어
-----------

-   세트 아이템 전용 이미지

-   룬 전용 고해상도 이미지

-   hover 상세 프리뷰

* * * * *

참고
--

참고: `docs/assets/31-icon-mapping-rules.md`\
---

# 3️⃣ `docs/integration/40-obs-integration.md`

```md\
# OBS Integration

OBS Browser Source를 사용해 최근 획득 아이템 오버레이를 표시한다.

참고: `docs/ui/20-overlay-ui.md`

---

## 목적

- 방송 중 최근 획득 아이템을 실시간 표시\
- 별도 수동 갱신 없이 자동 반영\
- OBS 장면에 쉽게 붙일 수 있는 구조 제공

---

## 기본 방식

로컬 앱이 `/overlay` 페이지를 제공하고, OBS Browser Source가 해당 페이지를 읽는다.

예시 URL:

```text\
http://127.0.0.1:4173/overlay

* * * * *

OBS 설정 예시
---------

### Source Type

-   Browser Source

### URL

-   `http://127.0.0.1:4173/overlay`

### Width / Height

-   500 x 800

-   또는 장면 구성에 맞게 조절

### FPS

-   기본값 사용 가능

### Shutdown source when not visible

-   필요에 따라 해제 권장

### Refresh browser when scene becomes active

-   켜도 되고 꺼도 됨

-   실시간 웹소켓/폴링이면 꺼도 됨

* * * * *

overlay 갱신 방식
-------------

### 추천

-   polling

-   또는 event push

### MVP 추천 방식

-   1~2초 polling

이유:

-   구현 단순

-   안정적

-   방송용으로 충분

* * * * *

overlay 페이지 역할
--------------

`/overlay` 페이지는 다음 데이터만 가져오면 된다.

-   최근 획득 10개

-   display_name

-   quality

-   quantity

-   is_corrupted

-   thumbnail

API 예시:

GET /api/overlay

* * * * *

오버레이 표시 위치 예시
-------------

### 우측 세로형

-   방송 화면 오른쪽

-   최근 획득 로그 느낌

### 좌측 하단형

-   작은 카드 리스트 형태

### 추천

초기에는 우측 세로형

이유:

-   길이 변화 대응 쉬움

-   아이템 수량이 많아도 안정적

* * * * *

방송 테스트 체크리스트
------------

-   아이템 복사 후 2초 내 표시되는가

-   긴 이름이 레이아웃을 깨지 않는가

-   quantity badge가 잘 보이는가

-   corrupted badge가 구분되는가

-   썸네일 로딩 실패 시 fallback이 나오는가

* * * * *

권장 UI 제약
--------

-   최대 10개

-   각 행 높이 고정

-   텍스트 1~2줄

-   반투명 배경

-   큰 폰트

-   애니메이션 과하지 않게

* * * * *

개발 순서
-----

1.  `/overlay` 정적 목업 제작

2.  테스트 JSON 연결

3.  API 연결

4.  OBS Browser Source 테스트

5.  실제 방송 장면에서 위치 조정

* * * * *

참고
--

참고: `docs/ui/20-overlay-ui.md`\
참고: `docs/api/50-local-api.md`\
참고: `docs/api/51-route-structure.md`\
---

# 4️⃣ `docs/integration/41-discord-format.md`

```md\
# Discord Format Rules

Discord에 아이템 정보를 보기 좋게 붙여넣기 위한 포맷 규칙.

참고: `docs/data/12-parsing-rules.md`

---

## 목적

- 길지 않게\
- 핵심 옵션 위주로\
- 줄 수는 2~4줄 정도\
- 방송 중 빠르게 복사 가능

---

## 기본 규칙

- `display_name` 우선 표시\
- 가능하면 `quality + base_type` 함께 표시\
- 중요한 stat만 요약\
- corrupted 여부는 마지막에 표시

---

## 추천 출력 구조

### 3줄 기본형

```text\
Goblin Toe (Unique Light Plated Boots)\
iLvl 90 | Def 33\
CB 23% | FRW 20 | FHR 10 (Corrupted)

* * * * *

stat 축약 규칙 예시
-------------

| 원문 | 축약 |
| --- | --- |
| Chance of Crushing Blow | CB |
| Faster Run/Walk | FRW |
| Faster Hit Recovery | FHR |
| Physical Damage Taken Reduced by | PDR |
| Magic Damage Taken Reduced by | MDR |
| Enhanced Defense | EDef |
| Enhanced Maximum Damage | MaxDmg |
| Enhanced Minimum Damage | MinDmg |

* * * * *

stat 선택 우선순위
------------

모든 stat를 출력하지 않고 핵심 옵션만 선택한다.

### 우선순위 예시

1.  corrupted 옵션

2.  빌드 핵심 옵션

3.  수치가 큰 옵션

4.  일반 방어/기본 옵션

### 기본 제한

-   최대 3~5개 stat만 출력

* * * * *

포맷 프리셋
------

### preset 1: compact multiline

Goblin Toe (Unique Light Plated Boots)\
CB 23 | FRW 20 | FHR 10

### preset 2: detailed multiline

Goblin Toe (Unique Light Plated Boots)\
iLvl 90 | Def 33\
CB 23% | FRW 20 | FHR 10\
PDR 4 | MDR 5 | Corr

* * * * *

corrupted 표기 규칙
---------------

다음 중 하나 선택

### 간단형

Corr

### 명시형

(Corrupted)

MVP에서는 `(Corrupted)` 추천

* * * * *

range 출력 규칙
-----------

Discord 기본 포맷에서는 range는 생략 가능

상세 버전에서만 출력

예:

CB 23% (15-25)

* * * * *

구현 포인트
------

-   Discord 포맷은 너무 길면 안 됨

-   모바일에서도 읽기 쉬워야 함

-   방송 채팅에 붙여도 괜찮아야 함

* * * * *

참고
--

참고: `docs/integration/43-compact-format.md`\
---

# 5️⃣ `docs/integration/42-reddit-format.md`

```md\
# Reddit Format Rules

Reddit에 아이템을 설명할 때 사용하는 Markdown 중심 포맷 규칙.

참고: `docs/data/12-parsing-rules.md`

---

## 목적

- 가독성이 좋아야 함\
- Markdown 친화적이어야 함\
- 옵션이 비교적 자세해야 함

---

## 기본 구조

```md\
**Goblin Toe** *(Unique Light Plated Boots)*\
- iLvl: 90\
- Defense: 33\
- Crushing Blow: 23% (15-25)\
- Faster Run/Walk: 20\
- Faster Hit Recovery: 10 *(Corrupted)*

* * * * *

표시 규칙
-----

-   첫 줄: 이름 + 품질 + 베이스

-   이후 줄: stat bullet

-   range 있으면 함께 표기

-   corrupted 옵션은 별도 강조 가능

* * * * *

name 없는 아이템
-----------

예시:

**Ring** *(Magic)*\
- iLvl: 88

* * * * *

quantity 아이템
------------

예시:

**Worldstone Shard** *(Normal)*\
- Quantity: 21\
- iLvl: 99

* * * * *

stat 출력 규칙
----------

### 출력 방식

-   원문 stat 이름 유지

-   Discord보다 덜 축약

-   길어도 괜찮음

### 예시

-   Crushing Blow: 23% (15-25)

-   Faster Run/Walk: 20

-   Physical Damage Taken Reduced by: 4 (3-5)

* * * * *

range 규칙
--------

range가 있으면 항상 아래 형식 사용

value (min-max)

예:

23 (15-25)

* * * * *

corrupted 규칙
------------

옵션별 corrupted가 있으면 그 줄에 표시

예:

- Faster Hit Recovery: 10 *(Corrupted)*

아이템 전체가 corrupted라면 헤더에 추가해도 됨

예:

**Goblin Toe** *(Unique Light Plated Boots, Corrupted)*

* * * * *

추천 출력 길이
--------

-   기본형: 5줄 내외

-   상세형: 전체 stat 표시

MVP에서는 기본형 + 상세형 둘 다 만들 수 있게 설계

* * * * *

참고
--

참고: `docs/integration/41-discord-format.md`\
---

# 6️⃣ `docs/integration/43-compact-format.md`

```md\
# Compact Format Rules

방송 채팅, 짧은 메시지, 빠른 공유를 위한 초간단 포맷 규칙.

---

## 목적

- 매우 짧아야 함\
- 한 줄 중심\
- 핵심만 보여야 함

---

## 기본 구조

```text\
Goblin Toe / CB23 / FRW20 / FHR10 / Corr

* * * * *

규칙
--

-   `display_name` 우선

-   stat는 최대 2~4개

-   공백 최소화

-   range 미표시

-   단위는 필요 최소한만 유지

* * * * *

예시
--

### 유니크

Goblin Toe / CB23 / FRW20 / FHR10 / Corr

### 수량형

Worldstone Shard x21

### name 없는 아이템

Ring / iLvl88 / Magic

* * * * *

stat 축약 사용
----------

Compact 포맷은 반드시 축약형 사용

예:

-   Crushing Blow -> CB

-   Faster Run/Walk -> FRW

-   Faster Hit Recovery -> FHR

* * * * *

길이 제한
-----

가능하면 50자 안쪽 유지\
길어져도 80자 이내 권장

* * * * *

사용 위치
-----

-   방송 채팅

-   짧은 알림

-   오버레이 보조 문구

-   디스코드 한 줄 공유

* * * * *

참고
--

참고: `docs/integration/41-discord-format.md`\
---

# 7️⃣ `docs/integration/44-clipboard-monitoring.md`

```md\
# Clipboard Monitoring

클립보드에 복사된 PD2 아이템 JSON을 감지하고 저장하는 기능의 구현 기준 문서.

참고: `docs/data/10-json-spec.md`\
참고: `docs/data/12-parsing-rules.md`

---

## 목적

사용자가 게임 안에서 `Ctrl+C`를 눌렀을 때 생성되는 JSON 텍스트를 감지하여:

- PD2 아이템인지 판별\
- 내부 구조로 파싱\
- 중복 검사\
- DB 저장\
- UI/오버레이 갱신

을 수행한다.

---

## 핵심 원칙

- 게임 프로세스를 읽지 않는다\
- 입력 자동화를 하지 않는다\
- 오직 클립보드의 텍스트만 감시한다

---

## 감지 대상

클립보드에 들어온 텍스트가 다음 조건을 만족하면 후보로 본다.

### 1차 후보 조건\
- 텍스트가 `{` 로 시작\
- 텍스트가 `}` 로 끝남\
- JSON.parse 가능

### 2차 PD2 아이템 판별 조건\
다음 키 중 일부가 존재\
- `type`\
- `quality`\
- `location`\
- `iLevel`

최소 필수는 `type`

---

## 처리 흐름

1\. 클립보드 변경 감지\
2\. 텍스트 읽기\
3\. JSON.parse 시도\
4\. PD2 아이템 여부 판별\
5\. 정규화\
6\. fingerprint 생성\
7\. 중복 검사\
8\. DB 저장\
9\. 이벤트 발행\
10\. UI 갱신

---

## fingerprint 생성

중복 방지를 위해 canonical JSON 기준 hash 생성

예시:

```text\
sha256(canonical_json_string)

* * * * *

canonicalize 규칙
---------------

-   key 순서 정렬

-   불필요한 공백 제거

-   동일 데이터는 항상 같은 문자열 생성

* * * * *

중복 제거 규칙
--------

### 기본 규칙

-   동일 fingerprint가 3초 내 재입력되면 무시

### 이유

-   사용자가 같은 아이템을 여러 번 복사할 수 있음

-   일부 환경에서 클립보드 이벤트가 중복 발생할 수 있음

* * * * *

예외 처리
-----

### JSON 파싱 실패

-   무시

-   로그 남기지 않아도 됨

### PD2 아이템 아님

-   무시

### 필수 키 부족

-   무시 또는 debug 로그

### DB 저장 실패

-   에러 로그 출력

-   토스트는 띄우지 않음

* * * * *

토스트 표시 규칙
---------

저장 성공 시만 표시

예시:

Saved: Goblin Toe\
Saved: Worldstone Shard x21

* * * * *

추천 내부 이벤트 구조
------------

type ClipboardItemCapturedEvent = {\
  itemId: string;\
  displayName: string;\
  capturedAt: string;\
};

이 이벤트를 사용해:

-   최근 목록 갱신

-   오버레이 갱신

-   통계 갱신

* * * * *

권장 구현 포인트
---------

### debounce

아주 짧은 시간에 중복 처리 방지용 debounce 가능

### polling vs event

-   OS 이벤트 기반 가능하면 우선

-   어렵다면 300~1000ms polling

### MVP 추천

-   500ms polling

이유:

-   단순

-   안정적

-   구현 쉬움

* * * * *

테스트 시나리오
--------

### 성공 케이스

-   WSS JSON 복사 -> 저장됨

-   Unique JSON 복사 -> 저장됨

-   corrupted stat 포함 -> 저장됨

### 실패 케이스

-   일반 텍스트 -> 무시

-   깨진 JSON -> 무시

-   type 없는 JSON -> 무시

### 중복 케이스

-   같은 JSON 연속 복사 -> 1회만 저장

* * * * *

샘플 의사코드
-------

readClipboardText()\
-> tryParseJson()\
-> isPd2ItemJson()\
-> normalizeItem()\
-> buildFingerprint()\
-> isDuplicateRecently()\
-> saveItem()\
-> emitCapturedEvent()

* * * * *

참고
--

참고: `docs/data/11-database-schema.md`\
참고: `docs/data/13-sample-items.md`
````
