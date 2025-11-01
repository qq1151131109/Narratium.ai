# TTS 功能完整改动文档

**对比基准**：Narratium.ai 原始代码（无 TTS 功能）
**当前版本**：添加 TTS 功能后的代码
**日期**：2025-10-30

---

## 📋 目录

1. [新增文件](#新增文件)
2. [修改的现有文件](#修改的现有文件)
3. [功能说明](#功能说明)
4. [配置说明](#配置说明)

---

## 🆕 新增文件

### 1. `lib/api/tts-service.ts`

**文件类型**：核心服务模块
**行数**：约 300 行
**作用**：TTS API 调用和音频缓存管理

**主要功能**：
```typescript
export class TTSService {
  // 1. 提取说话内容（从引号转换为 <talk> 标签）
  extractSpeechContent(htmlContent: string): string[]

  // 2. 创建 TTS 任务
  async createTTSTask(text: string, referenceAudioFileName?: string): Promise<string>

  // 3. 查询任务状态
  async queryTaskResult(taskId: string): Promise<TTSTaskResult>

  // 4. 等待任务完成
  async waitForTaskCompletion(taskId: string, ...): Promise<string>

  // 5. 完整生成流程
  async generateSpeech(messageId: string, htmlContent: string, ...): Promise<string>

  // 6. 上传参考音频
  async uploadReferenceAudio(audioFile: File): Promise<string>

  // 7. 缓存管理
  getCachedAudio(messageId: string): string | undefined
  clearCache(): void
  clearMessageCache(messageId: string): void
}
```

**关键配置**：
- API Base URL: `https://www.runninghub.cn`
- 默认工作流 ID: `1983711725981769729`
- 轮询设置：最多 30 次，间隔 2 秒

---

### 2. `hooks/useTTS.ts`

**文件类型**：React Hook
**行数**：约 285 行
**作用**：TTS 状态管理和播放控制

**状态管理**：
```typescript
interface TTSState {
  isGenerating: boolean;  // 是否正在生成
  isPlaying: boolean;     // 是否正在播放
  error: string | null;   // 错误信息
  progress: number;       // 生成进度 0-100
}
```

**主要功能**：
```typescript
export function useTTS(options: UseTTSOptions) {
  return {
    // 操作方法
    generateAndPlay: (messageId, htmlContent) => Promise<void>,
    play: (messageId) => Promise<void>,
    stop: (messageId?) => void,
    toggle: (messageId) => Promise<void>,
    clearCache: () => void,
    clearMessageCache: (messageId) => void,
    uploadReferenceAudio: (audioFile) => Promise<string>,
    setReferenceAudio: (url?) => void,

    // 状态查询
    getState: (messageId) => TTSState,
    isCached: (messageId) => boolean,
    currentPlaying: string | null,
  };
}
```

---

### 3. `components/TTSSettingsPanel.tsx`

**文件类型**：React 组件
**行数**：约 220 行
**作用**：TTS 设置界面

**UI 元素**：
1. **启用开关** - 启用/禁用 TTS
2. **API Key 输入** - 带显示/隐藏功能
3. **自动播放开关** - 控制是否自动播放
4. **工作流 ID** - 高级设置（可折叠）
5. **保存按钮** - 保存配置到 localStorage

**特殊功能**：
- 自动迁移旧工作流 ID (`1983506334995914754` → `1983711725981769729`)
- 设置变更事件广播 (`ttsSettingsChanged`)

---

### 4. `docs/TTS_IMPLEMENTATION_PLAN.md`

**文件类型**：技术文档
**内容**：详细的实现方案和 API 分析

---

### 5. `docs/TTS_IMPLEMENTATION_SUMMARY.md`

**文件类型**：总结文档
**内容**：实施完成总结和测试清单

---

## ✏️ 修改的现有文件

### 1. `components/CharacterChatPanel.tsx`

#### 修改 A：导入 TTS Hook

**位置**：第 30 行
**原始代码**：
```typescript
// （无此导入）
```

**新代码**：
```typescript
import { useTTS } from "@/hooks/useTTS";
```

---

#### 修改 B：添加 TTS 状态变量

**位置**：第 127-138 行
**原始代码**：
```typescript
// （无这些状态）
```

**新代码**：
```typescript
// TTS Configuration states
const [ttsApiKey, setTtsApiKey] = useState<string>("");
const [ttsEnabled, setTtsEnabled] = useState<boolean>(false);
const [ttsAutoPlay, setTtsAutoPlay] = useState<boolean>(true);
const [ttsWorkflowId, setTtsWorkflowId] = useState<string>("1983711725981769729");

// Initialize TTS hook
const tts = useTTS({
  apiKey: ttsApiKey,
  autoPlay: ttsAutoPlay,
  workflowId: ttsWorkflowId,
});
```

**影响**：新增 4 个状态变量和 1 个 Hook 实例

---

#### 修改 C：加载 TTS 配置

**位置**：第 169-192 行（在现有 useEffect 内）
**原始代码**：
```typescript
useEffect(() => {
  // ...现有代码...

  // Load display username using helper function
  setCurrentDisplayName(getDisplayUsername());
}, []);
```

**新代码**：
```typescript
useEffect(() => {
  // ...现有代码...

  // Load display username using helper function
  setCurrentDisplayName(getDisplayUsername());

  // Load TTS configuration
  const savedTtsApiKey = localStorage.getItem("tts_api_key");
  const savedTtsEnabled = localStorage.getItem("tts_enabled");
  const savedTtsAutoPlay = localStorage.getItem("tts_auto_play");
  const savedTtsWorkflowId = localStorage.getItem("tts_workflow_id");

  if (savedTtsApiKey) {
    setTtsApiKey(savedTtsApiKey);
  }
  if (savedTtsEnabled === "true") {
    setTtsEnabled(true);
  }
  if (savedTtsAutoPlay === "false") {
    setTtsAutoPlay(false);
  }

  // Auto-migrate old workflow ID to new one
  if (savedTtsWorkflowId === "1983506334995914754") {
    const newWorkflowId = "1983711725981769729";
    setTtsWorkflowId(newWorkflowId);
    localStorage.setItem("tts_workflow_id", newWorkflowId);
  } else if (savedTtsWorkflowId) {
    setTtsWorkflowId(savedTtsWorkflowId);
  }
}, []);
```

**影响**：在组件初始化时从 localStorage 加载 TTS 配置

---

#### 修改 D：自动生成 TTS

**位置**：第 195-222 行（新增整个 useEffect）
**原始代码**：
```typescript
// （无此 useEffect）
```

**新代码**：
```typescript
// Auto-generate TTS for new assistant messages
useEffect(() => {
  if (!ttsEnabled || !ttsApiKey || messages.length === 0 || isSending) {
    return;
  }

  const lastMessage = messages[messages.length - 1];

  // Only auto-generate for assistant messages
  if (lastMessage.role === "assistant" && ttsAutoPlay) {
    // Check if already generated or generating
    const state = tts.getState(lastMessage.id);
    if (state.isGenerating || state.isPlaying || tts.isCached(lastMessage.id)) {
      console.log('TTS: Skipping generation - already generated or in progress');
      return;
    }

    // Delay to ensure content is fully rendered
    const timer = setTimeout(() => {
      console.log('TTS: Auto-generating for message:', lastMessage.id);
      tts.generateAndPlay(lastMessage.id, lastMessage.content).catch((error) => {
        console.error("Auto TTS generation failed:", error);
      });
    }, 500);

    return () => clearTimeout(timer);
  }
}, [messages, ttsEnabled, ttsApiKey, ttsAutoPlay, isSending]);
```

**影响**：当角色回复新消息时自动生成并播放 TTS

---

#### 修改 E：添加 TTS 播放按钮

**位置**：第 1189-1289 行（在重新生成按钮后面）
**原始代码**：
```typescript
<button
  onClick={() => {
    trackButtonClick("page", "重新生成消息");
    onRegenerate(message.id);
  }}
  // ...重新生成按钮...
>
  {/* SVG 图标 */}
</button>
{/* 这里原来没有 TTS 按钮 */}
```

**新代码**：
```typescript
<button
  onClick={() => {
    trackButtonClick("page", "重新生成消息");
    onRegenerate(message.id);
  }}
  // ...重新生成按钮...
>
  {/* SVG 图标 */}
</button>

{/* TTS Play Button - Show for assistant messages when TTS is enabled */}
{message.role === "assistant" && ttsEnabled && ttsApiKey && (
  <button
    onClick={() => {
      const state = tts.getState(message.id);
      if (state.isPlaying) {
        tts.stop(message.id);
        trackButtonClick("page", "TTS停止播放");
      } else if (tts.isCached(message.id)) {
        tts.play(message.id).catch((error) => {
          console.error("TTS play failed:", error);
        });
        trackButtonClick("page", "TTS播放");
      } else {
        tts.generateAndPlay(message.id, message.content).catch((error) => {
          console.error("TTS generation failed:", error);
        });
        trackButtonClick("page", "TTS生成并播放");
      }
    }}
    disabled={tts.getState(message.id).isGenerating}
    className={`ml-1 w-6 h-6 flex items-center justify-center bg-[#1c1c1c] rounded-lg border shadow-inner transition-all duration-300 group relative ${
      tts.getState(message.id).isPlaying
        ? "text-blue-400 hover:text-blue-300 border-blue-400/60 hover:border-blue-300/70 hover:shadow-[0_0_8px_rgba(59,130,246,0.4)]"
        : tts.getState(message.id).isGenerating
        ? "text-[#8a8a8a] border-[#333333] cursor-not-allowed"
        : "text-[#a18d6f] hover:text-[#60a5fa] border-[#333333] hover:border-[#444444] hover:shadow-[0_0_8px_rgba(96,165,250,0.4)]"
    }`}
    data-tooltip={/* 工具提示内容 */}
  >
    {/* 工具提示 div */}
    <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#2a261f] text-[#f4e8c1] text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap border border-[#534741] pointer-events-none">
      {tts.getState(message.id).isGenerating ? (
        `生成中... ${Math.round(tts.getState(message.id).progress)}%`
      ) : tts.getState(message.id).isPlaying ? (
        "停止播放"
      ) : tts.getState(message.id).error ? (
        tts.getState(message.id).error
      ) : tts.isCached(message.id) ? (
        "播放语音"
      ) : (
        "生成并播放语音"
      )}
    </div>

    {/* 按钮图标 */}
    {tts.getState(message.id).isGenerating ? (
      // 加载动画
      <svg className="animate-spin h-3 w-3" /* ... */>
        {/* 旋转加载图标 */}
      </svg>
    ) : tts.getState(message.id).isPlaying ? (
      // 停止图标
      <svg /* ... */>
        <rect x="6" y="6" width="12" height="12" rx="1" />
      </svg>
    ) : (
      // 播放图标
      <svg /* ... */>
        <path d="M8 5v14l11-7z" />
      </svg>
    )}
  </button>
)}
```

**影响**：在每条 assistant 消息旁边添加 TTS 播放按钮，支持三种状态：
- 🔄 **生成中** - 显示进度百分比，禁用点击
- ⏸️ **播放中** - 显示停止图标，点击停止
- ▶️ **未播放** - 显示播放图标，点击生成或播放

---

### 2. `components/ModelSidebar.tsx`

#### 修改 A：导入 TTS 设置面板

**位置**：第 36 行
**原始代码**：
```typescript
// （无此导入）
```

**新代码**：
```typescript
import TTSSettingsPanel from "@/components/TTSSettingsPanel";
```

---

#### 修改 B：添加 TTS 设置区域

**位置**：第 1449 行（在桌面版侧边栏的最后）
**原始代码**：
```typescript
          {/* ...其他设置内容... */}
        </div>
      </div>
    </div>
  );
}
```

**新代码**：
```typescript
          {/* ...其他设置内容... */}

          {/* TTS Settings Panel */}
          <TTSSettingsPanel />
        </div>
      </div>
    </div>
  );
}
```

**影响**：在模型设置侧边栏底部添加 TTS 设置面板

---

## 🎯 功能说明

### 完整工作流程

```
用户发送消息
    ↓
角色回复（包含引号的对话）
    ↓
CharacterChatPanel 检测到新的 assistant 消息
    ↓
自动触发 TTS 生成（如果启用了自动播放）
    ↓
TTSService 提取引号内容
    ↓
调用 RunningHub API 创建 TTS 任务
    ↓
轮询查询任务状态（最多 30 次，每次 2 秒）
    ↓
获取音频 URL 并缓存
    ↓
HTML5 Audio 播放音频
    ↓
用户可以点击播放按钮重新播放或停止
```

### 核心技术实现

#### 1. 说话内容提取

**问题**：原始 `message.content` 没有 `<talk>` 标签
**解决**：在 `extractSpeechContent` 方法中先转换引号

```typescript
// Step 1: 将引号转换为 <talk> 标签
processedContent = processedContent.replace(/(<[^>]+>)|(["""][^"""]+["""])/g,
  (_match, tag, quote) => {
    if (tag) return tag;
    return `<talk>${quote}</talk>`;
  }
);

// Step 2: 提取 <talk> 标签内容
const talkRegex = /<talk[^>]*>(.*?)<\/talk>/gi;
```

#### 2. 任务去重

**问题**：useEffect 依赖导致重复创建任务
**解决**：检查状态 + 移除 tts 依赖

```typescript
// 检查是否已经生成、正在生成或正在播放
const state = tts.getState(lastMessage.id);
if (state.isGenerating || state.isPlaying || tts.isCached(lastMessage.id)) {
  return; // 跳过
}

// 移除 tts 依赖，避免无限循环
}, [messages, ttsEnabled, ttsApiKey, ttsAutoPlay, isSending]);
```

#### 3. 工作流 ID 自动迁移

**问题**：旧版本使用了错误的工作流 ID
**解决**：自动检测并更新

```typescript
if (savedTtsWorkflowId === "1983506334995914754") {
  const newWorkflowId = "1983711725981769729";
  setTtsWorkflowId(newWorkflowId);
  localStorage.setItem("tts_workflow_id", newWorkflowId);
}
```

---

## ⚙️ 配置说明

### localStorage 键值

| 键名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `tts_enabled` | string | `"false"` | 是否启用 TTS |
| `tts_api_key` | string | `""` | RunningHub API Key |
| `tts_auto_play` | string | `"true"` | 是否自动播放 |
| `tts_workflow_id` | string | `"1983711725981769729"` | 工作流 ID |

### 工作流配置

**工作流文件**：`docs/workflow/index TTS2情绪控制_api_1013.json`

**关键节点**：
- **节点 101** (`LoadAudio`) - 加载参考音频
- **节点 102** (`MultiLinePromptIndex`) - 文本输入
- **节点 103** (`IndexTTS2Run`) - TTS 执行
- **节点 173** (`SaveAudioMP3`) - 保存音频

**API 配置**：
- **创建任务**：`POST /task/openapi/create`
- **查询结果**：`POST /task/openapi/outputs`
- **上传音频**：`POST /task/openapi/upload`

---

## 📊 代码统计

### 文件变更统计

| 类型 | 数量 | 说明 |
|------|------|------|
| 新增文件 | 5 | 3 个代码文件 + 2 个文档 |
| 修改文件 | 2 | CharacterChatPanel + ModelSidebar |
| 总新增行数 | ~850 行 | 包括注释和空行 |
| 总修改行数 | ~150 行 | 在现有文件中 |

### 功能模块统计

| 模块 | 代码行数 | 复杂度 |
|------|---------|--------|
| TTS Service | ~300 行 | 中 |
| TTS Hook | ~285 行 | 中 |
| TTS Settings UI | ~220 行 | 低 |
| 聊天面板集成 | ~150 行 | 低 |
| **总计** | **~955 行** | - |

---

## 🔧 技术栈

- **前端框架**：React 19 + TypeScript
- **状态管理**：React Hooks (useState, useEffect, useRef, useCallback)
- **音频播放**：HTML5 Audio API
- **数据存储**：localStorage
- **API 调用**：Fetch API
- **TTS 服务**：RunningHub API
- **工作流**：TTS2 情绪控制工作流

---

## 📝 使用示例

### 基础使用

1. **配置 API Key**
   - 打开模型设置（右侧齿轮图标）
   - 滚动到 "🎙️ TTS 语音合成设置"
   - 输入 RunningHub API Key
   - 启用 TTS
   - 保存设置

2. **自动播放**
   - 与角色对话
   - 角色回复带引号的内容会自动生成并播放语音

3. **手动播放**
   - 点击消息旁边的播放按钮
   - 第一次点击会生成音频
   - 后续点击直接播放缓存的音频

### 高级配置

**自定义工作流 ID**：
```typescript
// 在 TTS 设置的"高级设置"中修改
workflowId: "你的工作流ID"
```

**禁用自动播放**：
```typescript
// 在 TTS 设置中关闭"自动播放"开关
autoPlay: false
```

**上传参考音频**（代码示例）：
```typescript
const audioFile = new File([blob], "reference.mp3");
const fileName = await tts.uploadReferenceAudio(audioFile);
tts.setReferenceAudio(fileName);
```

---

## 🐛 已知问题

### 当前限制

1. **参考音频**：当前使用工作流默认音频，未实现动态上传
2. **长文本**：建议每次不超过 500 字
3. **网络依赖**：需要稳定的网络连接
4. **API 配额**：受 RunningHub 配额限制

### 待优化

1. **错误重试**：当前没有自动重试机制
2. **队列管理**：多条消息同时生成时的队列处理
3. **音频预加载**：可以预生成下一条消息的语音
4. **批量操作**：批量清除缓存、批量生成等

---

**文档版本**：1.0
**最后更新**：2025-10-30
**维护者**：Claude Code
