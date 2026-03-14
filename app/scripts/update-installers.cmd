@echo off
setlocal

call "%~dp0tauri-env.cmd" npx tauri build
if errorlevel 1 (
  echo [installer-update] build failed
  exit /b %errorlevel%
)

set "SRC_SETUP=%~dp0..\src-tauri\target\release\bundle\nsis\PD2 Broadcast Item Tracker_0.1.0_x64-setup.exe"
set "SRC_MSI=%~dp0..\src-tauri\target\release\bundle\msi\PD2 Broadcast Item Tracker_0.1.0_x64_en-US.msi"
set "DST_SETUP=%~dp0..\..\PD2 Broadcast Item Tracker_0.1.0_x64-setup.exe"
set "DST_MSI=%~dp0..\..\PD2 Broadcast Item Tracker_0.1.0_x64_en-US.msi"

if not exist "%SRC_SETUP%" (
  echo [installer-update] missing setup: %SRC_SETUP%
  exit /b 1
)

if not exist "%SRC_MSI%" (
  echo [installer-update] missing msi: %SRC_MSI%
  exit /b 1
)

copy /y "%SRC_SETUP%" "%DST_SETUP%" >nul
if errorlevel 1 (
  echo [installer-update] setup copy failed
  exit /b %errorlevel%
)

copy /y "%SRC_MSI%" "%DST_MSI%" >nul
if errorlevel 1 (
  echo [installer-update] msi copy failed
  exit /b %errorlevel%
)

echo [installer-update] setup ready: %DST_SETUP%
echo [installer-update] msi ready: %DST_MSI%
exit /b 0
