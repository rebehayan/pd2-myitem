@echo off
setlocal

set "VSDEVCMD=C:\BuildTools\Common7\Tools\VsDevCmd.bat"
if not exist "%VSDEVCMD%" (
  echo [tauri-env] Missing VsDevCmd at %VSDEVCMD%
  exit /b 1
)

call "%VSDEVCMD%" -arch=x64 -host_arch=x64 >nul
if errorlevel 1 (
  echo [tauri-env] Failed to initialize Visual Studio build environment
  exit /b 1
)

set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"

set "MSVC_VER="
for /f "usebackq delims=" %%i in (`powershell.exe -NoProfile -Command "(Get-ChildItem 'C:\BuildTools\VC\Tools\MSVC' -Directory | Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty Name)"`) do (
  set "MSVC_VER=%%i"
)

:found_msvc
if "%MSVC_VER%"=="" (
  echo [tauri-env] MSVC toolset not found under C:\BuildTools\VC\Tools\MSVC
  exit /b 1
)

set "CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER=C:\BuildTools\VC\Tools\MSVC\%MSVC_VER%\bin\Hostx64\x64\link.exe"

call %*
exit /b %errorlevel%
