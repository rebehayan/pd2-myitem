# 변경 사항

- Settings 저장 시 빈 QR 토큰 때문에 저장이 무시되던 문제를 막기 위해 API 검증을 완화했습니다.

## OBS에서 스타일 미반영 원인
- 브라우저(Settings/Overlay)에서 보이는 변화는 `localStorage` 기반 미리보기 값이 적용된 상태이고, OBS Browser Source는 다른 브라우저 컨텍스트라 `localStorage`가 공유되지 않습니다.
- OBS는 API에서 저장된 설정만 읽기 때문에 저장하지 않거나 서버 재시작 없이 다른 인스턴스를 보고 있으면 반영되지 않습니다.

## 탭 이동 시 설정 초기화 원인
- Settings 화면에서만 `overlay_title_preview*` 키를 쓰고, 탭을 나가면 미리보기 키를 제거하도록 처리되어 있어 다른 탭 이동 후 다시 돌아오면 미리보기 값이 사라집니다.
- 저장 응답에 신규 타이틀 스타일 필드가 누락된 경우가 있어 저장 후 상태가 기본값으로 재설정될 수 있습니다.

## OBS에 제목 스타일링이 반영되지 않는 이유
- OBS는 `localStorage` 미리보기를 사용하지 않으므로 저장된 값만 반영됩니다.
- 서버가 이전 코드로 실행 중이거나, OBS가 다른 URL/포트의 서버를 보고 있으면 `/api/overlay`에 신규 필드가 포함되지 않아 기본값으로 표시됩니다.

## 아이템 삭제가 OBS에 미반영 원인
- `OverlayPage`는 최신 API 목록과 비교해서 삭제된 항목을 제거하지 않고, 새 항목만 추가/갱신하는 방식이라 삭제가 화면에서 제거되지 않습니다.
- 따라서 대시보드에서 삭제해도 OBS 오버레이는 기존 리스트를 계속 유지합니다.

## 룬 이미지 매칭 점검 결과 (현재 수집 데이터 기준)
- 대상: `app/data/pd2.sqlite`의 `category = rune`
- 결과: base_type에서 룬 키를 정상 추출했으며 파일명은 JSON 규칙(타입 기반)으로 재구성 가능
- 상세
  - Sol Rune -> rune/RuneSol.webp
  - Thul Rune -> rune/RuneThul.webp
  - Hel Rune -> rune/RuneHel.webp
  - Vex Rune -> rune/RuneVex.webp
  - Ist Rune -> rune/RuneIst.webp

## 의견
- 현재 수집된 룬들은 타입 문자열이 정상(`"<Name> Rune"`)이라 룬 아이콘 매칭에는 문제가 없어 보입니다.
- 만약 OBS에서 다른 이미지가 보이면, OBS가 다른 서버 인스턴스를 보고 있거나 아이콘 캐시/오래된 코드가 원인일 가능성이 높습니다.

## 변경 파일
- app/src/server/index.ts
