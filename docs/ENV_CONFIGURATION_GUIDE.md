# 环境变量配置说明

本项目使用 `.env` 文件进行配置。所有前端设置面板已移除，改为通过环境变量配置。

## 配置步骤

1. **复制示例文件**
   ```bash
   cp .env.example .env
   ```

2. **编辑 `.env` 文件**
   根据你的实际情况修改配置值

3. **重启开发服务器**
   修改 `.env` 后需要重启服务器
   ```bash
   # 停止当前服务（Ctrl+C）
   pnpm run dev
   ```

## 配置项说明

### 聊天 LLM 配置(主要对话模型)

```bash
# LLM 类型 (openai 或 ollama)
NEXT_PUBLIC_CHAT_LLM_TYPE=openai

# LLM API 地址
NEXT_PUBLIC_CHAT_LLM_BASE_URL=https://api.openai.com/v1

# LLM 模型名称
NEXT_PUBLIC_CHAT_LLM_MODEL=gpt-4-turbo

# LLM API Key
NEXT_PUBLIC_CHAT_LLM_API_KEY=your_openai_api_key
```

**说明:**
- `CHAT_LLM_TYPE`: 设置为 `openai` 或 `ollama`
- `CHAT_LLM_BASE_URL`: API 服务器地址
  - OpenAI: `https://api.openai.com/v1`
  - Ollama: `http://localhost:11434`
  - 其他 OpenAI 兼容服务: 自定义地址
- `CHAT_LLM_MODEL`: 模型名称
  - OpenAI: `gpt-4-turbo`, `gpt-3.5-turbo` 等
  - Ollama: `llama3`, `mistral`, `mixtral` 等
- `CHAT_LLM_API_KEY`: API 密钥(Ollama 无需配置)

**兼容性说明:**
- 支持回退到旧版环境变量 `NEXT_PUBLIC_API_*`
- 建议使用新的 `NEXT_PUBLIC_CHAT_LLM_*` 变量

### TTS 语音合成配置

```bash
# 是否启用 TTS 功能
NEXT_PUBLIC_TTS_ENABLED=true

# TTS API Key (RunningHub API)
NEXT_PUBLIC_TTS_API_KEY=your_runninghub_api_key

# TTS 工作流 ID
NEXT_PUBLIC_TTS_WORKFLOW_ID=1983711725981769729

# 是否自动播放（true/false）
NEXT_PUBLIC_TTS_AUTO_PLAY=true
```

**说明：**
- `TTS_ENABLED`: 设置为 `true` 启用，`false` 禁用
- `TTS_API_KEY`: 从 RunningHub 获取的 API Key
- `TTS_WORKFLOW_ID`: TTS 工作流的 ID
- `TTS_AUTO_PLAY`: 新消息是否自动播放语音

### 场景图片生成配置

```bash
# 是否启用场景图片生成
NEXT_PUBLIC_SCENE_IMAGE_ENABLED=true

# 场景图片 API Key (RunningHub API)
NEXT_PUBLIC_SCENE_IMAGE_API_KEY=your_runninghub_api_key

# 场景图片工作流 ID
NEXT_PUBLIC_SCENE_IMAGE_WORKFLOW_ID=1978370860388126722
```

**说明：**
- `SCENE_IMAGE_ENABLED`: 设置为 `true` 启用，`false` 禁用
- `SCENE_IMAGE_API_KEY`: RunningHub API Key
- `SCENE_IMAGE_WORKFLOW_ID`: 场景图片工作流 ID
- **提示词生成**: 自动使用上面的"聊天 LLM 配置"

### 场景视频生成配置

```bash
# 是否启用场景视频生成
NEXT_PUBLIC_VIDEO_GEN_ENABLED=true

# ComfyUI 服务地址 (本地)
NEXT_PUBLIC_VIDEO_GEN_COMFYUI_URL=http://localhost:9000
```

**说明：**
- `VIDEO_GEN_ENABLED`: 设置为 `true` 启用，`false` 禁用
- `VIDEO_GEN_COMFYUI_URL`: ComfyUI 服务地址（通常为 `http://localhost:9000`）
- **提示词生成**: 自动使用上面的"聊天 LLM 配置"

## 完整示例

### 使用 OpenAI API

```bash
# 聊天 LLM 配置（所有功能共用）
NEXT_PUBLIC_CHAT_LLM_TYPE=openai
NEXT_PUBLIC_CHAT_LLM_BASE_URL=https://api.openai.com/v1
NEXT_PUBLIC_CHAT_LLM_MODEL=gpt-4-turbo
NEXT_PUBLIC_CHAT_LLM_API_KEY=sk-xxxxxxxxxxxxx

# TTS
NEXT_PUBLIC_TTS_ENABLED=true
NEXT_PUBLIC_TTS_API_KEY=rh_xxxxxxxxxxxxx
NEXT_PUBLIC_TTS_WORKFLOW_ID=1983711725981769729
NEXT_PUBLIC_TTS_AUTO_PLAY=true

# 场景图片
NEXT_PUBLIC_SCENE_IMAGE_ENABLED=true
NEXT_PUBLIC_SCENE_IMAGE_API_KEY=rh_xxxxxxxxxxxxx
NEXT_PUBLIC_SCENE_IMAGE_WORKFLOW_ID=1978370860388126722

# 场景视频
NEXT_PUBLIC_VIDEO_GEN_ENABLED=true
NEXT_PUBLIC_VIDEO_GEN_COMFYUI_URL=http://localhost:9000
```

### 使用 Ollama（本地 LLM）

```bash
# 聊天 LLM 配置（所有功能共用）
NEXT_PUBLIC_CHAT_LLM_TYPE=ollama
NEXT_PUBLIC_CHAT_LLM_BASE_URL=http://localhost:11434
NEXT_PUBLIC_CHAT_LLM_MODEL=llama3
NEXT_PUBLIC_CHAT_LLM_API_KEY=

# TTS（仍使用 RunningHub）
NEXT_PUBLIC_TTS_ENABLED=true
NEXT_PUBLIC_TTS_API_KEY=rh_xxxxxxxxxxxxx
NEXT_PUBLIC_TTS_WORKFLOW_ID=1983711725981769729
NEXT_PUBLIC_TTS_AUTO_PLAY=true

# 场景图片
NEXT_PUBLIC_SCENE_IMAGE_ENABLED=true
NEXT_PUBLIC_SCENE_IMAGE_API_KEY=rh_xxxxxxxxxxxxx
NEXT_PUBLIC_SCENE_IMAGE_WORKFLOW_ID=1978370860388126722

# 场景视频
NEXT_PUBLIC_VIDEO_GEN_ENABLED=true
NEXT_PUBLIC_VIDEO_GEN_COMFYUI_URL=http://localhost:9000
```

## 禁用某个功能

如果不想使用某个功能，只需将对应的 `ENABLED` 设置为 `false`：

```bash
# 禁用 TTS
NEXT_PUBLIC_TTS_ENABLED=false

# 禁用场景图片
NEXT_PUBLIC_SCENE_IMAGE_ENABLED=false

# 禁用场景视频
NEXT_PUBLIC_VIDEO_GEN_ENABLED=false
```

## 注意事项

1. **API Key 安全**
   - `.env` 文件包含敏感信息，不要提交到 Git
   - 项目的 `.gitignore` 已包含 `.env`

2. **环境变量格式**
   - 所有环境变量必须以 `NEXT_PUBLIC_` 开头才能在客户端使用
   - 不要在值周围加引号，除非引号是值的一部分

3. **重启服务**
   - 修改 `.env` 后必须重启开发服务器才能生效
   - 构建生产版本时会自动读取 `.env`

4. **验证配置**
   - 启动后打开浏览器开发者工具（F12）
   - 查看 Console 是否有配置相关的错误信息

## 故障排查

### 按钮不显示
- 检查对应功能的 `ENABLED` 是否为 `true`
- 检查 API Key 是否正确配置
- 查看浏览器 Console 是否有错误

### 功能无法使用
- 验证 API Key 是否有效
- 对于视频生成，确保 ComfyUI 正在运行
- 对于 Ollama，确保 Ollama 服务已启动

### 提示词生成失败
- 检查 LLM API Key 是否正确
- 确认 LLM 服务可访问（OpenAI 或 Ollama）
- 查看 Console 错误信息

## 更多帮助

- TTS 功能说明：`docs/TTS_CHANGES.md`
- 场景图片说明：`docs/SCENE_IMAGE_IMPLEMENTATION.md`
- 场景视频说明：`docs/VIDEO_GENERATION_USER_GUIDE.md`
