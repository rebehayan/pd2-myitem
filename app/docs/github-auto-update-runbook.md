# GitHub Auto Update Runbook (Tauri)

## 목적

- 사용자에게 초기 1회 설치 후 무재설치 업데이트 제공
- GitHub Releases를 업데이트 서버로 사용

## 사전 준비

GitHub Repository Secrets에 아래 값을 설정한다.

- `TAURI_SIGNING_PRIVATE_KEY`: `tauri signer generate`로 만든 private key
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: private key 암호
- `TAURI_UPDATER_PUBLIC_KEY`: 위 private key에 대응되는 public key 문자열

참고: public key는 비밀값은 아니지만, 릴리즈 워크플로에서 설정 주입을 단순화하기 위해 secret으로 관리한다.

## 워크플로 파일

- `.github/workflows/release-tauri.yml`

동작:

1. `v*.*.*` 태그 푸시 시 실행
2. `app` 의존성 설치 + Rust toolchain 준비
3. `tauri.conf.json`에 updater endpoint/pubkey 주입
4. `tauri-action`으로 빌드/릴리즈 업로드
5. updater 아티팩트(`latest.json`, signature 포함 번들) 게시

## 배포 절차 (운영자)

1. 앱 버전 업데이트
- `app/src-tauri/Cargo.toml` 의 `version`
- `app/src-tauri/tauri.conf.json` 의 `version`

2. 변경 커밋/푸시

3. 태그 생성/푸시

```bash
git tag v0.1.1
git push origin v0.1.1
```

4. Actions 완료 후 GitHub Releases 확인
- 설치파일(NSIS/MSI)
- updater metadata (`latest.json`)

## 클라이언트 동작

- 앱 Settings 페이지에서 업데이트 확인
- 새 버전이 있으면 다운로드/설치
- 앱 재시작 시 업데이트 반영

## 장애 대응

- 릴리즈 실패: Actions 로그에서 signing key, updater pubkey 주입 단계 확인
- 업데이트 미감지: `latest.json` URL 접근 가능 여부 확인
  - `https://github.com/<owner>/<repo>/releases/latest/download/latest.json`
- 업데이트 검증 실패: private/public key 쌍 불일치 여부 확인
