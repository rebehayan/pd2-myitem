# Clipboard Monitoring

이 문서는 PD2 아이템 JSON을 클립보드에서 감지하고 처리하는 시스템을 정의한다.

참고\
docs/data/10-json-spec.md\
docs/data/12-parsing-rules.md

---

# 목적

사용자가 게임에서 다음 행동을 수행할 때

Ctrl + C\
클립보드에 복사된 아이템 JSON을 감지하여 다음 처리를 수행한다.

1\. PD2 아이템 JSON 판별\
2\. 데이터 파싱\
3\. 중복 검사\
4\. 데이터 저장\
5\. UI 및 Overlay 업데이트

---

# 시스템 원칙

다음 원칙을 반드시 유지한다.

- 게임 프로세스 접근 금지\
- 메모리 스캔 금지\
- 키 입력 자동화 없음\
- 오직 클립보드 텍스트만 사용

이 방식은 안전하고 안정적인 방법이다.

---

# 처리 흐름

전체 흐름

Ctrl+C\
↓\
Clipboard Change\
↓\
JSON Parse\
↓\
PD2 Item Validate\
↓\
Normalize Item\
↓\
Fingerprint 생성\
↓\
Duplicate Check\
↓\
Database Save\
↓\
Event Emit\
↓\
UI Update\

---

# 클립보드 감지 방식

두 가지 방식이 있다.

## OS 이벤트 기반

클립보드 변경 이벤트를 직접 수신

장점

- 즉시 반응\
- CPU 사용 낮음

단점

- 플랫폼별 구현 차이

---

## Polling 방식 (MVP 추천)

일정 시간 간격으로 클립보드를 확인

예

interval: 500ms\
장점

- 구현 간단\
- 안정적

단점

- 약간의 지연

---

# 클립보드 후보 데이터 조건

텍스트가 다음 조건을 만족해야 JSON 후보로 판단한다.

1\. `{` 로 시작\
2\. `}` 로 끝남\
3\. JSON.parse 가능

---

# PD2 아이템 JSON 판별

다음 키 중 일부가 존재해야 한다.

| key | 설명 |\
|-----|------|\
| type | 아이템 베이스 |\
| quality | 아이템 품질 |\
| location | 위치 |\
| iLevel | 아이템 레벨 |

최소 필수

## type\

# JSON 예시

```json\
{\
  "iLevel": 99,\
  "location": "Inventory",\
  "quality": "Normal",\
  "quantity": 21,\
  "type": "Worldstone Shard"\
}

* * * * *

파싱 처리
=====

JSON을 내부 모델로 변환한다.

예

type ParsedItem = {\
  displayName: string\
  quality: string\
  type: string\
  itemLevel: number\
  quantity?: number\
  stats?: Stat[]\
}

참고\
docs/data/12-parsing-rules.md

* * * * *

fingerprint 생성
==============

같은 아이템이 반복 저장되는 것을 방지한다.

생성 방식

sha256(canonical_json)

* * * * *

canonical JSON
==============

fingerprint 생성 전에 JSON을 정규화한다.

규칙

-   key 정렬

-   공백 제거

-   동일 구조 유지

* * * * *

중복 검사
=====

동일 fingerprint가 **짧은 시간 내 재입력**될 경우 저장하지 않는다.

예

duplicate window = 3 seconds

* * * * *

저장 처리
=====

중복이 아니라면 DB에 저장한다.

저장 테이블

items\
item_stats

참고\
docs/data/11-database-schema.md

* * * * *

이벤트 발생
======

아이템 저장 후 이벤트를 발생시킨다.

예

type ItemCapturedEvent = {\
  itemId: string\
  displayName: string\
  capturedAt: string\
}

이 이벤트는 다음 시스템에 전달된다.

-   Dashboard UI

-   OBS Overlay

-   Today Page

-   Share Formats

* * * * *

Toast 알림
========

아이템 저장 성공 시 간단한 알림을 표시할 수 있다.

예

Saved: Goblin Toe\
Saved: Worldstone Shard x21

* * * * *

실패 처리
=====

다음 경우는 무시한다.

| 상황 | 처리 |
| --- | --- |
| JSON parse 실패 | 무시 |
| PD2 JSON 아님 | 무시 |
| 필수 key 없음 | 무시 |
| 중복 입력 | 무시 |

* * * * *

로그 정책
=====

개발 모드에서만 로그 출력

예

[clipboard] new item captured\
[clipboard] duplicate ignored\
[clipboard] invalid json ignored

* * * * *

추천 모듈 구조
========

src/clipboard/

clipboardWatcher.ts\
parseClipboardJson.ts\
itemValidator.ts\
fingerprint.ts

* * * * *

예시 흐름 코드
========

readClipboard()\
  -> parseJson()\
  -> validatePd2Item()\
  -> normalizeItem()\
  -> buildFingerprint()\
  -> checkDuplicate()\
  -> saveItem()\
  -> emitItemCapturedEvent()

* * * * *

테스트 시나리오
========

정상
--

-   WSS 복사

-   Unique 아이템 복사

-   stats 포함 아이템

실패
--

-   일반 텍스트

-   깨진 JSON

중복
--

-   같은 JSON 반복 복사

* * * * *

성능 고려
=====

권장 polling interval

500ms

이 설정으로 CPU 사용을 최소화하면서 충분히 빠른 반응을 얻을 수 있다.

* * * * *

관련 문서
=====

참고\
docs/03-architecture.md

참고\
docs/data/12-parsing-rules.md

참고\
docs/api/50-local-api.md
```
