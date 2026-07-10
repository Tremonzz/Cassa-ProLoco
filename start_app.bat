@echo off
cd /d "%~dp0"
echo Starting Sagra App...
start http://localhost:3000
npm start
pause
