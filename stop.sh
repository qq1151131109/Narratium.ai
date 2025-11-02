#!/bin/bash
# 停止开发服务器

echo "正在查找开发服务器进程..."

if ! pgrep -f "pnpm dev" > /dev/null; then
    echo "⚠️  没有找到运行中的服务器"
    exit 0
fi

echo "正在停止服务器..."
pkill -f "pnpm dev"

sleep 2

if ! pgrep -f "pnpm dev" > /dev/null; then
    echo "✅ 服务器已成功停止"
else
    echo "❌ 停止失败，尝试强制停止..."
    pkill -9 -f "pnpm dev"
    sleep 1
    if ! pgrep -f "pnpm dev" > /dev/null; then
        echo "✅ 服务器已强制停止"
    else
        echo "❌ 强制停止失败，请手动处理"
        ps aux | grep 'pnpm dev' | grep -v grep
    fi
fi
