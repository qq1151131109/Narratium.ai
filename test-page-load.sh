#!/bin/bash

echo "=========================================="
echo "🧪 测试角色详情页面实际加载"
echo "=========================================="
echo ""

# 获取第一个角色的ID
echo "📡 获取角色列表..."
CHARACTER_ID=$(curl -s http://localhost:3000/api/characters | jq -r '.data[0].id')
CHARACTER_NAME=$(curl -s http://localhost:3000/api/characters | jq -r '.data[0].data.name')

echo "✅ 获取到角色: $CHARACTER_NAME (ID: $CHARACTER_ID)"
echo ""

echo "🌐 测试访问角色详情页..."
echo "URL: http://localhost:3000/character?id=$CHARACTER_ID"
echo ""

# 检查页面是否能正常加载
HTTP_CODE=$(curl -s -o /tmp/character-page.html -w "%{http_code}" "http://localhost:3000/character?id=$CHARACTER_ID")

echo "HTTP 状态码: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 页面加载成功"

    # 检查页面内容
    if grep -q "角色不存在" /tmp/character-page.html; then
        echo "❌ 页面显示'角色不存在或已被删除'"
        echo ""
        echo "这表明问题出在前端逻辑，不是数据结构问题"
    elif grep -q "$CHARACTER_NAME" /tmp/character-page.html; then
        echo "✅ 页面包含角色名称，可能正常"
    else
        echo "⚠️  页面内容未知"
    fi
else
    echo "❌ 页面加载失败，HTTP 状态码: $HTTP_CODE"
fi

echo ""
echo "=========================================="
echo "💡 建议："
echo "=========================================="
echo "1. 打开浏览器访问: http://localhost:3000/character-cards"
echo "2. 打开浏览器控制台 (F12)"
echo "3. 点击任意角色"
echo "4. 查看控制台的错误日志"
echo ""
echo "我已在 function/dialogue/info.ts 中添加了详细日志"
echo "控制台会显示具体在哪一步失败了"
echo "=========================================="
