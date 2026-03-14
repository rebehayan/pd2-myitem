@echo off
setlocal

call "%~dp0tauri-env.cmd" npx tauri build
if errorlevel 1 (
  echo [installer-update] build failed
  exit /b %errorlevel%
)

for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "(Get-Content '%~dp0..\src-tauri\tauri.conf.json' -Raw | ConvertFrom-Json).version"`) do set "APP_VERSION=%%V"

if "%APP_VERSION%"=="" (
  echo [installer-update] failed to resolve version from tauri.conf.json
  exit /b 1
)

set "SRC_SETUP=%~dp0..\src-tauri\target\release\bundle\nsis\PD2 Broadcast Item Tracker_%APP_VERSION%_x64-setup.exe"
set "DST_SETUP=%~dp0..\..\PD2 Broadcast Item Tracker_%APP_VERSION%_x64-setup.exe"

if not exist "%SRC_SETUP%" (
  echo [installer-update] missing setup: %SRC_SETUP%
  exit /b 1
)

copy /y "%SRC_SETUP%" "%DST_SETUP%" >nul
if errorlevel 1 (
  echo [installer-update] setup copy failed
  exit /b %errorlevel%
)

echo [installer-update] setup ready: %DST_SETUP%
exit /b 0
