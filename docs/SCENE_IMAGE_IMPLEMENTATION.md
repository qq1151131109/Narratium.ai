# 场景图片生成功能实施文档

## 功能概述

场景图片生成功能允许用户根据对话上下文自动生成场景图片。系统会：
1. 使用 LLM 分析对话内容并生成英文图像提示词
2. 调用 RunningHub 图像生成 API 创建场景图片
3. 在聊天界面中显示生成的图片

## 实施内容

### 📁 新增文件

1. **lib/api/scene-image-service.ts** (~500 行)
   - 场景图片生成服务核心类
   - 提示词生成（支持 OpenAI 和 Ollama）
   - RunningHub API 调用和任务轮询
   - 图片缓存管理

2. **hooks/useSceneImage.ts** (~200 行)
   - 场景图片状态管理 Hook
   - 生成状态、进度、错误处理
   - 与 SceneImageService 的集成

3. **components/SceneImageSettingsPanel.tsx** (~300 行)
   - 场景图片设置界面组件
   - API Key 和工作流 ID 配置
   - LLM 配置（类型、地址、模型、API Key）

### ✏️ 修改的文件

1. **components/CharacterChatPanel.tsx**
   - 添加场景图片配置状态管理
   - 集成 useSceneImage Hook
   - 添加场景图片生成按钮（在 TTS 按钮旁边）
   - 添加场景图片显示组件
   - 实现生成控制逻辑

2. **components/ModelSidebar.tsx**
   - 集成 SceneImageSettingsPanel 组件
   - 在 TTS 设置面板下方显示

3. **lib/data/roleplay/character-record-operation.ts**
   - CharacterRecord 接口添加 `referenceImage?` 字段
   - 用于存储角色参考人像（待实现上传功能）

4. **components/CharacterChatPanel.tsx** (Message 接口)
   - Message 接口添加 `sceneImage?` 字段
   - 存储生成的场景图片信息（URL、提示词、时间戳等）

## 功能特性

### 🎨 核心功能

1. **智能提示词生成**
   - 使用 LLM 分析对话上下文
   - 重点关注最后一条消息（当前场景）
   - 生成专业的英文图像生成提示词

2. **场景图片生成**
   - 使用 RunningHub Nano Banana 工作流
   - 支持纯文生图模式（使用空白图像）
   - 预留参考人像接口（待实现）

3. **实时进度追踪**
   - 提示词生成进度（0-30%）
   - 图片生成进度（30-100%）
   - 2 秒轮询间隔，最多轮询 60 次

4. **状态管理**
   - 每条消息独立的生成状态
   - 生成中、已完成、错误状态
   - 图片缓存避免重复生成

5. **用户界面**
   - 消息旁的生成按钮（紫色图标）
   - 加载动画和进度提示
   - 生成的图片显示在消息下方
   - 点击按钮可重新生成

## 配置说明

### 必需配置

在模型设置侧边栏中找到 "🎨 场景图片生成设置"：

1. **启用场景图片生成**：开关按钮

2. **RunningHub API Key**：
   - 您的 RunningHub API 密钥
   - 用于调用图像生成 API

3. **工作流 ID**：
   - 默认值：`1978370860388126722`（Nano Banana 工作流）
   - 可自定义其他工作流

4. **LLM 配置**（用于提示词生成）：
   - **LLM 类型**：OpenAI 兼容 API 或 Ollama
   - **API 地址**：
     - OpenAI: `https://api.openai.com`
     - Ollama: `http://localhost:11434`
   - **模型名称**：
     - OpenAI: `gpt-3.5-turbo` 或其他
     - Ollama: `llama2` 或其他
   - **API Key**（仅 OpenAI）：LLM API 密钥

### 配置存储

所有设置保存在 localStorage 中：
- `scene_image_enabled`: 是否启用
- `scene_image_api_key`: RunningHub API Key
- `scene_image_workflow_id`: 工作流 ID
- `scene_image_llm_type`: LLM 类型
- `scene_image_llm_base_url`: LLM API 地址
- `scene_image_llm_model`: LLM 模型名称
- `scene_image_llm_api_key`: LLM API Key

## 使用方法

### 基本使用

1. **配置设置**
   - 打开聊天界面右上角的模型设置侧边栏
   - 滚动到底部找到 "🎨 场景图片生成设置"
   - 填写所有必需配置并保存

2. **生成场景图片**
   - 在对话中，每条 assistant 消息旁会显示一个紫色图标按钮
   - 点击按钮开始生成场景图片
   - 等待生成完成（通常需要 10-30 秒）
   - 生成的图片会自动显示在消息下方

3. **重新生成**
   - 如果对生成的图片不满意，可以再次点击按钮重新生成
   - 新图片会替换旧图片

### 工作流程

```
用户点击生成按钮
    ↓
提取最近 3-5 条消息 + 当前消息
    ↓
调用 LLM 生成图像提示词（英文）
    ↓
调用 RunningHub API 创建生成任务
    ↓
轮询任务状态（每 2 秒）
    ↓
获取生成的图片 URL
    ↓
显示图片在消息下方
```

### 提示词生成逻辑

系统会发送给 LLM 以下信息：
- **角色信息**：名字、描述、性格
- **最近对话**：最近 3-5 条消息（提供上下文）
- **当前场景**：最后一条消息（最重要）

LLM 会生成专业的英文提示词，包含：
- 场景环境、氛围、光线
- 角色动作、表情、服装
- 具体的视觉细节（颜色、材质、构图）

## 技术架构

### 服务层 (SceneImageService)

```typescript
class SceneImageService {
  // 生成图像提示词（使用 LLM）
  async generatePrompt(character, recentMessages, lastMessage): Promise<string>

  // 生成场景图片
  async generateSceneImage(prompt, referenceImage?, onProgress?): Promise<SceneImageTaskResult>

  // 图片缓存
  getCachedImage(messageId): string | undefined
  cacheImage(messageId, imageUrl): void
}
```

### Hook 层 (useSceneImage)

```typescript
function useSceneImage(config: SceneImageConfig): {
  status: "idle" | "generating" | "completed" | "error"
  progress: number
  error: string | null
  imageUrl: string | null
  generatedPrompt: string | null
  generateSceneImage(character, messages, referenceImage?): Promise<void>
  reset(): void
}
```

### UI 层

- **CharacterChatPanel**: 集成生成按钮和图片显示
- **SceneImageSettingsPanel**: 配置界面
- **ModelSidebar**: 设置面板容器

## API 调用流程

### 1. 提示词生成 API

**OpenAI 兼容 API**:
```
POST {llmBaseUrl}/v1/chat/completions
Headers:
  - Content-Type: application/json
  - Authorization: Bearer {llmApiKey}
Body:
  - model: {llmModel}
  - messages: [system_prompt, user_prompt]
```

**Ollama API**:
```
POST {llmBaseUrl}/api/chat
Headers:
  - Content-Type: application/json
Body:
  - model: {llmModel}
  - messages: [system_prompt, user_prompt]
```

### 2. RunningHub 图像生成 API

**创建任务**:
```
POST https://www.runninghub.cn/api/hub/workflow/openApiRun?workflowId={workflowId}
Headers:
  - Content-Type: application/json
  - Authorization: {apiKey}
Body:
  - prompt: {workflow_config}
```

**轮询结果**:
```
GET https://www.runninghub.cn/api/hub/workflow/taskResult?taskId={taskId}
Headers:
  - Authorization: {apiKey}
```

## 数据结构

### Message 接口扩展

```typescript
interface Message {
  id: string
  role: string
  content: string
  sceneImage?: {
    url: string           // 图片 URL
    prompt: string        // 生成时使用的提示词
    timestamp: number     // 生成时间
    characterRef?: string // 使用的角色人像
  }
}
```

### CharacterRecord 接口扩展

```typescript
interface CharacterRecord {
  id: string
  data: RawCharacterData
  imagePath: string
  referenceImage?: string  // 参考人像（待实现上传功能）
  created_at: string
  updated_at: string
}
```

## 待完善功能

### 1. 角色参考人像上传 🔜

**计划实现**：
- 在角色编辑器中添加 "上传参考人像" 功能
- 支持上传图片并转换为 base64 存储
- 使用参考人像提高生成图片的角色外观一致性

**实现位置**：
- `components/EditCharacterModal.tsx`
- 添加文件上传组件和预览

### 2. 图像工作流切换

**当前**：使用 Nano Banana 文生图工作流（空白图像模式）

**未来**：
- 支持 PuLID + Joy2 保留人脸工作流
- 根据是否有参考人像自动选择工作流
- 用户可在设置中选择首选工作流

### 3. 批量生成

- 为多条消息批量生成场景图片
- 后台队列处理避免 API 限流

### 4. 图片编辑和优化

- 重新生成特定部分
- 调整图片样式和风格
- 图片本地存储和导出

## 故障排查

### 常见问题

1. **生成失败：提示 "LLM configuration is required"**
   - 检查是否正确配置了 LLM API
   - 确认 API Key 是否有效

2. **生成失败：提示 "API Key is required"**
   - 检查 RunningHub API Key 是否填写
   - 确认 API Key 格式正确

3. **生成超时**
   - 默认轮询 60 次（约 2 分钟）
   - 检查网络连接
   - 检查 RunningHub 工作流状态

4. **图片无法显示**
   - 检查图片 URL 是否有效
   - 检查浏览器控制台错误信息
   - 可能是 CORS 问题或 URL 过期

### 调试日志

在浏览器控制台中查看详细日志：
- `[SceneImageService]`: 服务层日志
- `[useSceneImage]`: Hook 层日志
- 包含 API 请求、响应和错误信息

## 性能考虑

### 1. API 成本

每次生成场景图片需要：
- LLM API 调用（约 500-1000 tokens）
- 图像生成 API 调用

建议：
- 避免频繁重新生成
- 考虑为生成设置冷却时间

### 2. 生成时间

- 提示词生成：1-3 秒
- 图片生成：10-30 秒
- 总计：约 15-35 秒

### 3. 缓存策略

- 已生成的图片存储在内存 Map 中
- 页面刷新后缓存清空（未持久化）
- 未来可考虑使用 IndexedDB 持久化

## 代码统计

| 文件 | 新增代码行数 | 说明 |
|------|-------------|------|
| `lib/api/scene-image-service.ts` | ~500 | 核心服务 |
| `hooks/useSceneImage.ts` | ~200 | 状态管理 |
| `components/SceneImageSettingsPanel.tsx` | ~300 | 设置界面 |
| `components/CharacterChatPanel.tsx` | ~150 | UI 集成 |
| `components/ModelSidebar.tsx` | ~5 | 设置面板集成 |
| **总计** | **~1155 行** | |

## 更新日志

### v1.0.0 (2025-10-30)

**新增**：
- ✅ 场景图片生成核心服务
- ✅ 状态管理 Hook
- ✅ 设置面板组件
- ✅ 聊天界面集成
- ✅ 提示词生成功能（LLM）
- ✅ RunningHub API 集成
- ✅ 实时进度追踪
- ✅ 图片缓存管理

**待完善**：
- 🔜 角色参考人像上传功能
- 🔜 多工作流支持
- 🔜 图片持久化缓存

## 总结

场景图片生成功能已完整实施，包括：
- ✅ 完整的服务层、Hook 层和 UI 层
- ✅ 智能提示词生成（基于 LLM）
- ✅ RunningHub API 集成
- ✅ 用户友好的配置和操作界面
- ✅ 实时进度追踪和错误处理
- ✅ 代码质量检查通过（ESLint）

用户现在可以：
1. 配置场景图片生成设置
2. 点击按钮为任意 assistant 消息生成场景图片
3. 在聊天界面中查看生成的图片
4. 根据需要重新生成图片

下一步建议：
1. 在真实环境中测试功能
2. 收集用户反馈
3. 完善参考人像上传功能
4. 优化图片生成质量和速度
