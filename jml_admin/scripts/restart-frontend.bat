@echo off
setlocal
node.exe "%~dp0start-with-webapi.js" --restart frontend
set "result=%ERRORLEVEL%"
pause
exit /b %result%
