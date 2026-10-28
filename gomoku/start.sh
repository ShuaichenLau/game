#!/usr/bin/env bash
# 五子棋(人机对战) 本地服务器启动脚本（macOS / Linux）
# 用法：bash start.sh

cd "$(dirname "$0")"

echo "============================================"
echo "  五子棋(人机对战) - 本地服务器启动"
echo "  访问地址: http://localhost:8000"
echo "  停止服务器请按 Ctrl+C"
echo "============================================"
echo "  提示：本项目也可直接用浏览器打开 index.html，无需服务器。"
echo

( sleep 1.5
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open http://localhost:8000
  elif command -v open >/dev/null 2>&1; then
    open http://localhost:8000
  fi
) &

if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server 8000
elif command -v python >/dev/null 2>&1; then
  python -m http.server 8000
else
  echo "[提示] 未检测到 Python。本项目不依赖服务器，可直接用浏览器打开 index.html。"
  exit 1
fi
