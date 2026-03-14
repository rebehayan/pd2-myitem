@echo off
setlocal

call "%~dp0tauri-env.cmd" cmd /c "npm run build && cargo build --manifest-path src-tauri\Cargo.toml --release"
if errorlevel 1 (
  echo [portable-update] build failed
  exit /b %errorlevel%
)

set "SRC_EXE=%~dp0..\src-tauri\target\release\pd2_broadcast_item_tracker.exe"
set "SRC_RES=%~dp0..\src-tauri\target\release\_up_"
set "DST_EXE=%~dp0..\..\PD2 Broadcast Item Tracker_portable-latest.exe"
set "DST_RES=%~dp0..\..\_up_"

if not exist "%SRC_EXE%" (
  echo [portable-update] missing exe: %SRC_EXE%
  exit /b 1
)

copy /y "%SRC_EXE%" "%DST_EXE%" >nul
if errorlevel 1 (
  echo [portable-update] copy failed
  exit /b %errorlevel%
)

if exist "%SRC_RES%" (
  if exist "%DST_RES%" rmdir /s /q "%DST_RES%"
  xcopy "%SRC_RES%" "%DST_RES%" /E /I /Y >nul
  if errorlevel 1 (
    echo [portable-update] resource copy failed
    exit /b %errorlevel%
  )
)

echo [portable-update] ready: %DST_EXE%
exit /b 0
