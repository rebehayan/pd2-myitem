# Unique Image Phase 2

이 문서는 유니크 아이템에 전용 이미지를 적용하는 2차 아이콘 시스템을 정의한다.

참고\
docs/assets/30-icon-strategy.md\
docs/assets/31-icon-mapping-rules.md

---

# 목적

1차 시스템에서는 모든 아이템을 다음 방식으로 표시한다.

base icon + quality frame\
예

- boots icon\
- ring icon\
- rune icon

하지만 유니크 아이템은 다음 문제가 있다.

- 방송 시 구분이 어려움\
- 아이템 개성이 없음\
- 커뮤니티 공유 시 식별 어려움

그래서 **2차 단계에서 유니크 전용 이미지를 추가한다.**

---

# 적용 대상

다음 조건을 만족하는 아이템

| 조건 | 설명 |\
|-----|------|\
| quality | Unique |\
| name 존재 | true |

예

Goblin Toe\
Harlequin Crest\
Stormshield\

---

# 파일 구조

유니크 이미지는 별도 폴더에 저장한다.

src/assets/unique/\
예

src/assets/unique/goblin_toe.png\
src/assets/unique/harlequin_crest.png\
src/assets/unique/stormshield.png\

---

# 이미지 매핑

유니크 이름 → 이미지 파일

파일

src/data/unique-image-map.json\
예

```json\
{\
  "Goblin Toe": "goblin_toe.png",\
  "Harlequin Crest": "harlequin_crest.png",\
  "Stormshield": "stormshield.png"\
}

* * * * *

적용 우선순위
=======

이미지 결정 순서

1 unique image\
2 base icon\
3 category icon\
4 generic icon

예

Goblin Toe\
→ unique image

Unknown Unique\
→ base icon

* * * * *

이미지 결정 로직
=========

추천 함수 구조

type ThumbnailResult = {\
  imagePath: string\
  source: 'unique' | 'base' | 'category' | 'generic'\
}

처리 흐름

if (quality === Unique && name in uniqueMap)\
    return unique image

else\
    return base icon

* * * * *

파일명 규칙
======

유니크 이미지 파일명 규칙

| 규칙 | 설명 |
| --- | --- |
| 소문자 | 사용 |
| 공백 → `_` | 변환 |
| 특수문자 제거 | 적용 |

예

Goblin Toe\
→ goblin_toe.png

Harlequin Crest\
→ harlequin_crest.png

* * * * *

이미지 사이즈
=======

권장 크기

64x64

또는

128x128

방송 overlay에서는 다음 크기로 표시한다.

32px ~ 48px

* * * * *

fallback 정책
===========

유니크 이미지가 없으면 다음을 사용한다.

base icon

예

Goblin Toe\
→ unique image

Rare Boots\
→ boots base icon

* * * * *

매핑 누락 로그
========

유니크 이미지가 없는 경우 로그를 남긴다.

예

[unique-image-miss] name="Goblin Toe"

이 로그를 기반으로 매핑을 확장한다.

* * * * *

초기 운영 전략
========

초기에는 **모든 유니크를 등록할 필요 없다.**

추천 방식

1.  자주 등장하는 유니크부터 추가

2.  방송에서 등장한 유니크만 추가

3.  점진적 확장

* * * * *

향후 확장
=====

추가 가능 시스템

| 기능 | 설명 |
| --- | --- |
| set item image | 세트 아이템 이미지 |
| rune HD icons | 룬 고해상도 |
| hover preview | 아이템 확대 |

* * * * *

관련 문서
=====

참고\
docs/assets/30-icon-strategy.md

참고\
docs/assets/31-icon-mapping-rules.md

참고\
docs/ui/20-overlay-ui.md
```
