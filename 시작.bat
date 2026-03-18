@echo off
chcp 65001 >nul
echo.
echo ==========================================
echo   SEO Auto Writer - 서버 시작
echo ==========================================
echo.
echo [1] 카드뉴스 서버 시작 (포트 3002)...
start "카드뉴스 서버 :3002" cmd /k "cd /d "%~dp0" && node html-image-server.mjs"
timeout /t 2 /nobreak >nul

echo [2] Next.js 앱 서버 시작 (포트 3000)...
start "SEO Auto Writer :3000" cmd /k "cd /d "%~dp0" && npm run dev"

echo.
echo ✅ 서버 시작 완료!
echo    - 카드뉴스 서버: http://localhost:3002
echo    - 앱 서버:     http://localhost:3000  (약 30초 후 접속 가능)
echo.
echo 브라우저에서 http://localhost:3000 을 열어주세요.
echo.
pause
