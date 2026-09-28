@echo off
setlocal
cd /d "%~dp0"
call npm run storage:info
pause
endlocal
