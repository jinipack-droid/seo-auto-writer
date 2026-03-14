@echo off
title SEO Auto Writer - 서버 시작
cd /d "%~dp0"

echo ========================================
echo   SEO Auto Writer 서버 시작 중...
echo ========================================

:: HTML 이미지 서버 (포트 3002) - Puppeteer 기반, 폰트 완벽 지원
echo [1/2] HTML 이미지 서버 시작 (포트 3002)...
start "HTML이미지 서버 3002" cmd /k "cd /d "%~dp0" && node html-image-server.mjs"

:: 잠깐 대기
timeout /t 3 /nobreak >nul

:: Next.js 앱 서버 (포트 3000) - 별도 창으로 실행
echo [2/2] Next.js 앱 서버 시작 (포트 3000)...
start "SEO앱 3000" cmd /k "cd /d "%~dp0" && npm run dev"

echo.
echo ✅ 서버 2개 시작됨!
echo    앱:    http://localhost:3000
echo    이미지: http://localhost:3002
echo.
echo 5초 후 브라우저가 자동으로 열립니다...
timeout /t 5 /nobreak >nul

:: 브라우저 자동 열기
start http://localhost:3000

exit
