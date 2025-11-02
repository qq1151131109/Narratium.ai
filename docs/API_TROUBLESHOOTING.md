# API 配置故障排查指南

## 问题：请求失败 - 请检查网络连接或API配置

### 原因分析

当你看到这个错误时，最常见的原因是：

1. **环境变量未生效**：修改 `.env` 文件后没有重启开发服务器
2. **API Key 失效**：API Key 过期或余额不足
3. **Base URL 错误**：LLM 服务地址配置错误
4. **网络问题**：无法连接到 LLM 服务

---

## 快速解决方案

### 方案 1：重启开发服务器（最常见）

修改 `.env` 文件后，**必须重启开发服务器**才能使环境变量生效。

```bash
# 1. 停止当前服务器（Ctrl+C 或关闭终端）
pkill -f "next dev"

# 2. 重新启动
pnpm dev
```

**为什么需要重启？**
- Next.js 在启动时读取 `.env` 文件
- 客户端代码使用 `process.env.NEXT_PUBLIC_*` 读取环境变量
- 环境变量在构建时被注入到代码中
- 修改 `.env` 后不重启，旧的值仍在内存中

---

### 方案 2：检查 .env 配置

打开 `/home/ubuntu/shenglin/Narratium.ai/.env` 文件，确认以下配置：

```bash
# ========================================
# 聊天 LLM 配置（主要）
# ========================================
# LLM 类型 (openai 或 ollama)
NEXT_PUBLIC_CHAT_LLM_TYPE=openai

# LLM API 地址
NEXT_PUBLIC_CHAT_LLM_BASE_URL=https://your-api-url.com/v1

# LLM 模型名称
NEXT_PUBLIC_CHAT_LLM_MODEL=gpt-4

# LLM API Key
NEXT_PUBLIC_CHAT_LLM_API_KEY=sk-xxxxxxxxxxxxxx
```

**检查清单：**
- ✅ `NEXT_PUBLIC_CHAT_LLM_API_KEY` 不为空
- ✅ `NEXT_PUBLIC_CHAT_LLM_BASE_URL` 格式正确（通常以 `/v1` 结尾）
- ✅ `NEXT_PUBLIC_CHAT_LLM_MODEL` 模型名称正确
- ✅ 没有多余的空格或引号

---

### 方案 3：验证 API Key

#### 使用 curl 测试 API Key：

```bash
curl https://your-api-url.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

**成功响应示例：**
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you?"
      }
    }
  ]
}
```

**失败响应示例：**
```json
{
  "error": {
    "message": "Invalid API key",
    "type": "invalid_request_error"
  }
}
```

---

### 方案 4：查看浏览器控制台错误

1. 打开浏览器开发者工具（F12）
2. 切换到 **Console** 标签
3. 查找红色错误信息

**常见错误及解决方法：**

| 错误信息 | 原因 | 解决方法 |
|---------|------|---------|
| `401 Unauthorized` | API Key 错误或失效 | 检查 API Key 是否正确 |
| `403 Forbidden` | 余额不足或权限问题 | 检查账户余额 |
| `404 Not Found` | Base URL 错误 | 检查 Base URL 配置 |
| `500 Internal Server Error` | 服务器错误 | 检查模型名称是否正确 |
| `Network Error` | 网络连接问题 | 检查网络或防火墙 |

---

## 详细排查步骤

### 步骤 1：检查环境变量是否正确读取

在浏览器控制台（F12）运行：

```javascript
console.log({
  type: process.env.NEXT_PUBLIC_CHAT_LLM_TYPE,
  model: process.env.NEXT_PUBLIC_CHAT_LLM_MODEL,
  baseUrl: process.env.NEXT_PUBLIC_CHAT_LLM_BASE_URL,
  apiKey: process.env.NEXT_PUBLIC_CHAT_LLM_API_KEY ? '***configured***' : 'missing'
});
```

**期望输出：**
```javascript
{
  type: "openai",
  model: "gpt-4",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "***configured***"
}
```

**如果输出 `undefined`**：
- 说明环境变量未生效
- 需要重启开发服务器

---

### 步骤 2：检查网络连接

```bash
# 测试能否访问 API 地址
curl -I https://your-api-url.com/v1/models

# 如果返回 200 OK 说明网络正常
```

---

### 步骤 3：查看服务器日志

在终端查看 Next.js 服务器输出：

```bash
# 查看最近的日志
tail -50 dev.log

# 实时监控日志
tail -f dev.log
```

**关键日志信息：**
- `Config loaded from environment:` - 确认配置已加载
- `Processing error:` - 查看具体错误原因
- `Failed to parse character data:` - 角色数据解析失败

---

## 常见配置错误

### 错误 1：API Key 前后有空格

❌ **错误：**
```bash
NEXT_PUBLIC_CHAT_LLM_API_KEY= sk-xxxxxx
```

✅ **正确：**
```bash
NEXT_PUBLIC_CHAT_LLM_API_KEY=sk-xxxxxx
```

---

### 错误 2：Base URL 格式错误

❌ **错误：**
```bash
# 缺少 /v1 后缀
NEXT_PUBLIC_CHAT_LLM_BASE_URL=https://api.openai.com

# 多余的斜杠
NEXT_PUBLIC_CHAT_LLM_BASE_URL=https://api.openai.com/v1/
```

✅ **正确：**
```bash
NEXT_PUBLIC_CHAT_LLM_BASE_URL=https://api.openai.com/v1
```

---

### 错误 3：使用了错误的模型名称

不同的 API 提供商支持不同的模型名称：

| 提供商 | 示例模型名称 |
|--------|-------------|
| OpenAI | `gpt-4`, `gpt-3.5-turbo` |
| Anthropic | `claude-3-opus`, `claude-3-sonnet` |
| xAI (Grok) | `grok-4-fast`, `grok-2` |
| 本地 Ollama | `llama3`, `mistral` |

---

### 错误 4：混淆了不同的配置字段

`.env` 文件中有多组配置，确保你修改的是正确的：

```bash
# ========================================
# 聊天 LLM 配置（主要）← 修改这个！
# ========================================
NEXT_PUBLIC_CHAT_LLM_TYPE=openai
NEXT_PUBLIC_CHAT_LLM_BASE_URL=https://www.dmxapi.cn/v1
NEXT_PUBLIC_CHAT_LLM_MODEL=grok-4-fast
NEXT_PUBLIC_CHAT_LLM_API_KEY=sk-xxxxxx

# ⚠️ 下面这些是旧配置，已废弃，不要修改！
OPENAI_API_KEY=sk-xxxxxx
OPENAI_BASE_URL=https://www.dmxapi.cn/v1
OPENAI_MODEL=grok-4-fast
```

---

## 高级排查

### 使用 Network 面板调试

1. 打开浏览器开发者工具（F12）
2. 切换到 **Network** 标签
3. 发送一条消息给角色
4. 查找请求（通常是 `/api/chat` 或类似）
5. 点击请求查看详情：
   - **Headers** 标签：查看请求头（API Key 是否正确）
   - **Payload** 标签：查看发送的数据
   - **Response** 标签：查看服务器返回的错误信息

---

### 查看完整请求信息

在 `app/character/page.tsx` 的 `handleSendMessage` 函数中添加调试日志：

```typescript
const handleSendMessage = async (message: string) => {
  // ... 其他代码 ...

  // 添加调试日志
  console.log("🔍 LLM Config:", {
    llmType,
    modelName,
    baseUrl,
    apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : "missing",
  });

  // ... 其他代码 ...
};
```

---

## 针对不同 LLM 类型的配置

### OpenAI 兼容 API（推荐）

```bash
NEXT_PUBLIC_CHAT_LLM_TYPE=openai
NEXT_PUBLIC_CHAT_LLM_BASE_URL=https://api.openai.com/v1
NEXT_PUBLIC_CHAT_LLM_MODEL=gpt-4
NEXT_PUBLIC_CHAT_LLM_API_KEY=sk-xxxxxx
```

**常见第三方 OpenAI 兼容服务：**
- [DMX API](https://www.dmxapi.cn/) - Grok 等模型
- [OpenRouter](https://openrouter.ai/) - 多模型聚合
- [Together AI](https://together.ai/) - 开源模型
- [DeepSeek](https://platform.deepseek.com/) - 国产大模型

---

### 本地 Ollama

```bash
NEXT_PUBLIC_CHAT_LLM_TYPE=ollama
NEXT_PUBLIC_CHAT_LLM_BASE_URL=http://localhost:11434
NEXT_PUBLIC_CHAT_LLM_MODEL=llama3
NEXT_PUBLIC_CHAT_LLM_API_KEY=  # Ollama 不需要 API Key，可以留空
```

**确保 Ollama 正在运行：**
```bash
# 检查 Ollama 是否运行
curl http://localhost:11434/api/tags

# 启动 Ollama
ollama serve
```

---

## 完整的测试流程

### 1. 修改配置
编辑 `.env` 文件，修改 API 配置

### 2. 重启服务器
```bash
pkill -f "next dev"
pnpm dev
```

### 3. 清除浏览器缓存
- 打开开发者工具（F12）
- 右键点击刷新按钮
- 选择"清空缓存并硬性重新加载"

### 4. 测试对话
- 访问 http://localhost:3000/character-cards
- 选择一个角色
- 发送测试消息："你好"

### 5. 查看日志
- 浏览器控制台（F12 → Console）
- 终端服务器日志
- Network 面板查看请求详情

---

## 应急方案

如果上述方法都无法解决，尝试以下应急方案：

### 方案 A：使用默认配置

临时使用 OpenAI 官方 API（需要科学上网）：

```bash
NEXT_PUBLIC_CHAT_LLM_TYPE=openai
NEXT_PUBLIC_CHAT_LLM_BASE_URL=https://api.openai.com/v1
NEXT_PUBLIC_CHAT_LLM_MODEL=gpt-3.5-turbo
NEXT_PUBLIC_CHAT_LLM_API_KEY=sk-your-openai-key
```

### 方案 B：使用本地 Ollama

完全离线运行：

```bash
# 1. 安装 Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. 下载模型
ollama pull llama3

# 3. 修改配置
NEXT_PUBLIC_CHAT_LLM_TYPE=ollama
NEXT_PUBLIC_CHAT_LLM_BASE_URL=http://localhost:11434
NEXT_PUBLIC_CHAT_LLM_MODEL=llama3
```

### 方案 C：完全重置

```bash
# 1. 删除 node_modules 和构建缓存
rm -rf node_modules .next

# 2. 重新安装依赖
pnpm install

# 3. 重新构建
pnpm build

# 4. 启动开发服务器
pnpm dev
```

---

## 联系支持

如果以上方法都无法解决问题，请提供以下信息寻求帮助：

1. **错误截图**：浏览器控制台的完整错误信息
2. **配置信息**：`.env` 文件内容（隐藏 API Key）
3. **系统信息**：操作系统、Node.js 版本
4. **日志信息**：服务器终端输出

---

## 总结

**最常见的解决方法（90%的情况）：**

```bash
# 修改 .env 文件后，一定要重启服务器！
pkill -f "next dev"
pnpm dev
```

**记住这个原则：**
- 修改 `.env` → 必须重启服务器
- 检查 API Key → 确保没有空格、有效期
- 查看日志 → 浏览器控制台 + 终端输出
- 测试连接 → 使用 curl 验证 API 可达性

祝你使用愉快！✨
