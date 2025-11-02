#!/bin/bash
# 启动开发服务器（后台运行）

echo "正在检查现有进程..."
if pgrep -f "pnpm dev" > /dev/null; then
    echo "⚠️  服务器已在运行中！"
    echo "如需重启，请先运行: ./stop.sh"
    exit 1
fi

echo "正在启动开发服务器..."
nohup pnpm dev > dev.log 2>&1 &

sleep 3

if pgrep -f "pnpm dev" > /dev/null; then
    echo "✅ 服务器已成功启动！"
    echo ""
    echo "📝 查看日志: tail -f dev.log"
    echo "🔍 查看进程: ./status.sh"
    echo "🛑 停止服务: ./stop.sh"
    echo ""
    # 提取端口信息
    sleep 2
    PORT=$(grep -oP 'Local:\s+http://localhost:\K\d+' dev.log | tail -1)
    if [ -n "$PORT" ]; then
        echo "🌐 访问地址: http://localhost:$PORT"
    fi
else
    echo "❌ 服务器启动失败，请查看日志: cat dev.log"
    exit 1
fi
