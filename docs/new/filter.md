Kryszard's PD2 Loot Filter README를 참고해
게임 내 loot filter 규칙을 웹 UI용 item theme system으로 변환해줘.

목표:

- 아이템을 중요도/가치/용도 기준으로 분류
- 각 그룹에 색상, 배지, 강조 스타일 부여
- OBS overlay, today page, item detail page에서 재사용 가능하게 설계

생성 파일:

- src/data/filter-rules.json
- src/data/filter-theme.json
- src/theme/resolveItemTheme.ts

주의:

- 게임 필터 문법을 그대로 복제하지 말고
- 웹 UI용 의미 그룹과 시각 테마로 추상화할 것
- 예: high runes, good uniques, uber materials, high ed items, +skills highlights
