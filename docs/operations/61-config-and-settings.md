# Config and Settings

사용자 설정 관리 문서.

---

# 설정 목적

다음 기능을 사용자 환경에 맞게 조정할 수 있게 한다.

---

# 설정 목록

## Overlay 설정

| 설정 | 설명 |\
|-----|------|\
| overlay_item_limit | 표시 개수 |\
| overlay_position | 위치 |\
| overlay_opacity | 투명도 |

예

## overlay_item_limit = 10\

## UI 설정

| 설정 | 설명 |\
|-----|------|\
| font_scale | UI 글자 크기 |

---

## 데이터 설정

| 설정 | 설명 |\
|-----|------|\
| session_name | 방송 세션 이름 |\
| save_history_days | 기록 보관 기간 |

---

## QR 페이지 설정

| 설정 | 설명 |\
|-----|------|\
| qr_public_enabled | 공개 여부 |\
| qr_token | 보안 토큰 |

---

# 현재 운영 기본값 (도메인 미보유 기준)

아직 도메인이 없으면 로컬 기준으로 아래 값을 사용한다.

```env
API_PORT=4310
ENABLE_CLIPBOARD_MONITOR=true
VITE_API_BASE=
PUBLIC_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
TRUST_PROXY_FOR_RATE_LIMIT=false
```

도메인을 발급한 뒤에는 `PUBLIC_ALLOWED_ORIGINS`를 실제 도메인으로 교체한다.

예

```env
PUBLIC_ALLOWED_ORIGINS=https://your-domain.com
TRUST_PROXY_FOR_RATE_LIMIT=true
```

---

# QR 점검 명령

기본 점검

```bash
npm run verify:qr
```

Windows cmd

```bat
set "VERIFY_API_BASE=http://127.0.0.1:4310"
set "VERIFY_EXPECT_PUBLIC_NO_KEY=true"
npm run verify:qr
```

Windows PowerShell

```powershell
$env:VERIFY_API_BASE = "http://127.0.0.1:4310"
$env:VERIFY_EXPECT_PUBLIC_NO_KEY = "true"
npm run verify:qr
```

---

# 설정 저장 위치

SQLite settings table

또는

## config.json

예시

```json
{
  "overlay_item_limit": 10,
  "overlay_opacity": 0.8,
  "qr_public_enabled": true
}
```

---

# 설정 UI 위치

Dashboard -> Settings

참고

- `docs/ui/21-dashboard-ui.md`
- `docs/operations/62-security-and-sharing.md`
