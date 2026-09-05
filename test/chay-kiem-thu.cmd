@echo off
rem Chay ca hai bo kiem thu. Dung Node neu may co san, khong thi muon Node
rem nam san trong VS Code.
setlocal enabledelayedexpansion
cd /d "%~dp0.."

set "RUNNER="
where node >nul 2>&1
if %errorlevel%==0 (
  set "RUNNER=node"
) else (
  for %%P in (
    "%LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe"
    "%ProgramFiles%\Microsoft VS Code\Code.exe"
    "%ProgramFiles(x86)%\Microsoft VS Code\Code.exe"
  ) do (
    if exist %%P if not defined RUNNER (
      set "RUNNER=%%P"
      set "ELECTRON_RUN_AS_NODE=1"
    )
  )
)

if not defined RUNNER (
  echo Khong tim thay Node lan VS Code. Cai Node tai https://nodejs.org roi chay lai.
  exit /b 1
)

echo === Kiem thu trang web ===
%RUNNER% test\run-tests.js
set "RC1=%errorlevel%"

echo.
echo === Kiem thu cong ghi Apps Script ===
%RUNNER% test\run-tests-server.js
set "RC2=%errorlevel%"

echo.
if "%RC1%%RC2%"=="00" (
  echo TAT CA DEU DAT.
  exit /b 0
) else (
  echo CO MUC HONG. Xem chi tiet phia tren.
  exit /b 1
)
