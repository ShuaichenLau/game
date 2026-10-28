@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 五子棋 - 本地服务器

echo ============================================
echo   五子棋(人机对战) - 本地服务器启动
echo   访问地址: http://localhost:8000
echo   停止服务器请按 Ctrl+C
echo ============================================
echo.
echo   提示：本项目也可直接双击 index.html 运行，无需服务器。
echo.

rem 后台延时 2 秒后打开浏览器（等服务器就绪）
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8000"

where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server 8000
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    py -m http.server 8000
  ) else (
    echo [提示] 未检测到 Python。本项目不依赖服务器，可直接双击 index.html 运行。
    pause
  )
)
