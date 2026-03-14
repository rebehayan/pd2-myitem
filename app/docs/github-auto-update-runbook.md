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
- 설치파일(NSIS)
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

## 최초 1회 키 생성

아래 명령으로 updater 서명 키를 생성한다.

```bash
cd app
npm run tauri signer generate -- -w .tauri/updater.key
```

생성 후 사용 값:

- private key 파일 내용 -> `TAURI_SIGNING_PRIVATE_KEY`
- private key 생성 시 설정한 암호 -> `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- 출력된 public key 문자열 -> `TAURI_UPDATER_PUBLIC_KEY`

## 릴리즈 실패 시 즉시 확인 순서

1. GitHub Actions의 `release-tauri` 실행에서 실패 step 확인
2. 실패가 `Build and release` step이면 secrets 누락/오타 가능성 확인
3. 실패가 `Inject updater config` step이면 `TAURI_UPDATER_PUBLIC_KEY` 값 확인
4. 실패가 서명 단계면 private key와 password 조합 재검증

## 릴리즈 성공 후 검증

1. Releases 페이지에서 최신 릴리즈 열기
2. 자산에 설치 파일(NSIS)과 updater 아티팩트가 있는지 확인
3. 아래 URL로 `latest.json` 접근 확인

```text
https://github.com/<owner>/<repo>/releases/latest/download/latest.json
```

4. 데스크톱 앱 Settings -> App Update -> 업데이트 확인 버튼으로 실제 감지 테스트
