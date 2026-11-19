@echo off
setlocal
chcp 65001 >nul
powershell.exe -NoProfile -Command "$c=Get-NetTCPConnection -State Listen -LocalPort 5001 -ErrorAction SilentlyContinue; if ($c) { exit 1 }"
if errorlevel 1 (
  echo 请先在 npm start 窗口按 Ctrl+C 停止管理后台，再执行本脚本。
  pause
  exit /b 1
)
cd /d "%~dp0..\webapi"
if defined WEBAPI_PYTHON (
  "%WEBAPI_PYTHON%" init_daily_task_snapshots.py
) else (
  python init_daily_task_snapshots.py
)
set "result=%ERRORLEVEL%"
if "%result%"=="0" echo 初始化完成。请回到 jml_admin 目录运行 npm start。
pause
exit /b %result%
