# 场景视频生成功能 - 详细实施计划

## 项目概述

实现基于对话内容的场景视频自动生成功能，通过本地 ComfyUI 工作流执行 TTS → 文生图 → 图生视频的完整流程。

---

## 功能需求

### 核心流程

1. 用户在对话中点击"生成视频"按钮
2. 系统提取对话的高亮文本（说话内容）
3. 调用 LLM 分析对话上下文，生成：
   - 文生图提示词（英文）
   - 图生视频提示词（英文）
4. 将提示词和 TTS 文本提交到 ComfyUI 工作流
5. 实时显示生成进度（通过 WebSocket）
6. 生成完成后，在消息下方显示视频播放器

### 技术约束

- ComfyUI 地址：固定 `http://localhost:9000`
- 参考音频：手动上传到 ComfyUI，工作流中硬编码路径
- LoRA 模型：在工作流中配置，程序不管理
- LLM 配置：复用现有场景图片的 LLM 配置
- 工作流模板：`/docs/workflow/tts+文生图+图生视频-api-1101.json`
- 生成策略：每次重新生成，不缓存

---

## 技术架构

### 1. 服务层 (lib/api/comfyui-video-service.ts)

**职责：**
- 封装 ComfyUI REST API 调用
- 管理 WebSocket 连接和消息处理
- 构建和修改工作流 JSON
- 进度追踪和状态管理
- 结果轮询和视频 URL 获取

**核心类：**

```typescript
export class ComfyUIVideoService {
  private config: VideoConfig;
  private workflowTemplate: any;
  private ws: WebSocket | null = null;
  private readonly BASE_URL = "http://localhost:9000";

  constructor(config: VideoConfig) {}

  // 生成提示词（调用 LLM）
  async generatePrompts(
    character: Character,
    recentMessages: Message[],
    ttsText: string
  ): Promise<{ imagePrompt: string; videoPrompt: string }> {}

  // 构建工作流 JSON
  buildWorkflow(
    ttsText: string,
    imagePrompt: string,
    videoPrompt: string
  ): any {}

  // 提交工作流到 ComfyUI
  async submitWorkflow(
    workflow: any,
    onProgress?: (progress: number, status: string) => void
  ): Promise<string> {} // 返回 prompt_id

  // 建立 WebSocket 连接
  connectWebSocket(
    clientId: string,
    onProgress: (node: string, progress: number) => void,
    onComplete: () => void,
    onError: (error: string) => void
  ): void {}

  // 轮询获取结果
  async pollResult(promptId: string): Promise<VideoResult> {}

  // 获取视频 URL
  getVideoUrl(filename: string, subfolder: string, type: string): string {}

  // 取消生成
  cancelGeneration(promptId: string): void {}
}
```

**关键方法实现：**

1. **generatePrompts()**
   ```typescript
   // 使用配置的 LLM（OpenAI/Ollama）生成提示词
   // System Prompt: 专业的视频生成提示词专家
   // User Prompt: 包含角色信息、对话上下文、TTS文本
   // 返回 JSON: { imagePrompt, videoPrompt }
   ```

2. **buildWorkflow()**
   ```typescript
   // 加载工作流模板 JSON
   // 修改关键节点：
   //   - 节点 60: inputs.text = ttsText
   //   - 节点 8: inputs.text = imagePrompt + 角色LoRA触发词
   //   - 节点 31: inputs.positive_prompt = videoPrompt
   // 返回修改后的工作流 JSON
   ```

3. **submitWorkflow()**
   ```typescript
   // 生成 client_id (UUID)
   // 建立 WebSocket 连接
   // POST /prompt with { prompt: workflow, client_id }
   // 返回 prompt_id
   ```

4. **connectWebSocket()**
   ```typescript
   // 连接 ws://localhost:9000/ws?clientId=${clientId}
   // 监听消息类型：
   //   - executing: 更新当前节点进度
   //   - execution_cached: 跳过缓存节点
   //   - executing (data=null): 完成
   //   - error: 错误处理
   ```

5. **pollResult()**
   ```typescript
   // 轮询 GET /history/{prompt_id}
   // 检查 status.completed
   // 从 outputs['50'].videos[0] 获取视频信息
   // 返回 { videoUrl, duration, filename }
   ```

**进度映射表：**

```typescript
const NODE_PROGRESS_MAP: Record<string, number> = {
  '60': 10,   // Fish-Speech TTS
  '8': 20,    // CLIP Text Encode (文生图提示词)
  '15': 35,   // FLUX 采样
  '16': 40,   // VAE Decode (图片生成完成)
  '31': 50,   // WanVideo Text Encode
  '53': 80,   // WanVideo 采样 (视频生成主体)
  '33': 85,   // WanVideo Decode
  '51': 92,   // GIMM-VFI 插帧
  '50': 98,   // 视频合成
};

const NODE_STATUS_MAP: Record<string, string> = {
  '60': '正在生成语音...',
  '8': '正在准备图像提示词...',
  '15': '正在生成图像...',
  '16': '图像生成完成',
  '31': '正在准备视频提示词...',
  '53': '正在生成视频（需要1-2分钟）...',
  '33': '正在处理视频...',
  '51': '正在优化帧率...',
  '50': '正在合成最终视频...',
};
```

---

### 2. 状态管理层 (hooks/useVideoGeneration.ts)

**职责：**
- 管理视频生成的状态和生命周期
- 提供统一的状态接口给组件使用
- 处理错误和重试逻辑

**接口定义：**

```typescript
export interface UseVideoGenerationReturn {
  // 状态
  status: 'idle' | 'generating-prompts' | 'generating-video' | 'completed' | 'error';
  progress: number; // 0-100
  currentStep: string; // 当前步骤描述
  error: string | null;

  // 生成结果
  videoUrl: string | null;
  imagePrompt: string | null;
  videoPrompt: string | null;

  // 控制函数
  generateVideo: (
    character: Character,
    messages: Message[],
    ttsText: string
  ) => Promise<void>;

  cancelGeneration: () => void;
  reset: () => void;
}
```

**实现要点：**

```typescript
export function useVideoGeneration(config: VideoConfig): UseVideoGenerationReturn {
  const [status, setStatus] = useState<VideoStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string | null>(null);
  const [videoPrompt, setVideoPrompt] = useState<string | null>(null);

  const serviceRef = useRef<ComfyUIVideoService | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const promptIdRef = useRef<string | null>(null);

  const generateVideo = useCallback(async (
    character: Character,
    messages: Message[],
    ttsText: string
  ) => {
    // 1. 重置状态
    setStatus('generating-prompts');
    setProgress(0);
    setError(null);
    setVideoUrl(null);

    try {
      const service = getService();

      // 2. 生成提示词 (0-5%)
      setCurrentStep('正在分析对话内容...');
      const prompts = await service.generatePrompts(character, messages, ttsText);
      setImagePrompt(prompts.imagePrompt);
      setVideoPrompt(prompts.videoPrompt);
      setProgress(5);

      // 3. 构建工作流 (5-10%)
      setCurrentStep('正在准备工作流...');
      const workflow = service.buildWorkflow(ttsText, prompts.imagePrompt, prompts.videoPrompt);
      setProgress(10);

      // 4. 提交工作流并建立 WebSocket (10-98%)
      setStatus('generating-video');
      setCurrentStep('正在生成视频...');

      const promptId = await service.submitWorkflow(workflow, (prog, step) => {
        setProgress(prog);
        setCurrentStep(step);
      });

      promptIdRef.current = promptId;

      // 5. 轮询获取结果 (98-100%)
      setCurrentStep('正在获取视频...');
      const result = await service.pollResult(promptId);

      setVideoUrl(result.videoUrl);
      setProgress(100);
      setStatus('completed');
      setCurrentStep('视频生成完成！');

    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
      setStatus('error');
    }
  }, [config]);

  const cancelGeneration = useCallback(() => {
    if (promptIdRef.current) {
      serviceRef.current?.cancelGeneration(promptIdRef.current);
      setStatus('idle');
      setProgress(0);
    }
  }, []);

  return {
    status,
    progress,
    currentStep,
    error,
    videoUrl,
    imagePrompt,
    videoPrompt,
    generateVideo,
    cancelGeneration,
    reset,
  };
}
```

---

### 3. 设置面板组件 (components/VideoGenerationSettingsPanel.tsx)

**职责：**
- 提供视频生成功能的配置界面
- 复用场景图片的 LLM 配置
- 提供启用/禁用开关

**UI 结构：**

```
┌─ 🎬 场景视频生成设置 ─────────────────┐
│                                        │
│  [✓] 启用场景视频生成                  │
│                                        │
│  LLM 配置 (用于提示词生成)             │
│  ├─ 类型: [OpenAI ▼] [Ollama]        │
│  ├─ API 地址: [https://api.openai.com]│
│  ├─ 模型: [gpt-3.5-turbo]            │
│  └─ API Key: [••••••••] [👁]         │
│                                        │
│  ComfyUI 配置                         │
│  └─ 地址: http://localhost:9000 (固定)│
│                                        │
│  提示词模板 (高级)                     │
│  ├─ 图像提示词前缀: [可选]            │
│  └─ 视频提示词前缀: [可选]            │
│                                        │
│  [保存设置]                            │
└────────────────────────────────────────┘
```

**LocalStorage 键：**

```typescript
const STORAGE_KEYS = {
  ENABLED: 'video_generation_enabled',
  LLM_TYPE: 'scene_image_llm_type',        // 复用场景图片配置
  LLM_BASE_URL: 'scene_image_llm_base_url',
  LLM_MODEL: 'scene_image_llm_model',
  LLM_API_KEY: 'scene_image_llm_api_key',
  IMAGE_PROMPT_PREFIX: 'video_gen_image_prompt_prefix',
  VIDEO_PROMPT_PREFIX: 'video_gen_video_prompt_prefix',
};
```

**事件派发：**

```typescript
// 设置变更时派发全局事件
window.dispatchEvent(new CustomEvent('videoGenerationSettingsChanged', {
  detail: {
    enabled,
    llmType,
    llmBaseUrl,
    llmModel,
    llmApiKey,
    imagePromptPrefix,
    videoPromptPrefix,
  }
}));
```

---

### 4. UI 集成 (components/CharacterChatPanel.tsx)

**修改点：**

#### 4.1 导入和类型定义

```typescript
import { useVideoGeneration } from "@/hooks/useVideoGeneration";
import { ComfyUIVideoService } from "@/lib/api/comfyui-video-service";

interface Message {
  // ... 现有字段
  sceneVideo?: {
    url: string;
    imagePrompt: string;
    videoPrompt: string;
    ttsText: string;
    duration: number;
    timestamp: number;
    status: 'generating' | 'completed' | 'failed';
  };
}
```

#### 4.2 状态管理

```typescript
// 视频生成配置状态
const [videoGenEnabled, setVideoGenEnabled] = useState(false);
const [videoGenLlmConfig, setVideoGenLlmConfig] = useState({
  type: 'openai' as 'openai' | 'ollama',
  baseUrl: 'https://api.openai.com',
  model: 'gpt-3.5-turbo',
  apiKey: '',
});

// 每条消息的视频生成状态
const [generatingVideos, setGeneratingVideos] = useState<Map<string, boolean>>(new Map());
const [videoProgress, setVideoProgress] = useState<Map<string, number>>(new Map());
const [videoStatus, setVideoStatus] = useState<Map<string, string>>(new Map());
const [videoErrors, setVideoErrors] = useState<Map<string, string>>(new Map());
const [generatedVideos, setGeneratedVideos] = useState<Map<string, string>>(new Map());

// 初始化视频生成 hook
const videoGenConfig = {
  llmConfig: videoGenEnabled ? videoGenLlmConfig : undefined,
};
const videoGen = useVideoGeneration(videoGenConfig);
```

#### 4.3 配置加载 (useEffect)

```typescript
useEffect(() => {
  // 加载视频生成配置
  const savedVideoGenEnabled = localStorage.getItem('video_generation_enabled');
  const savedLlmType = localStorage.getItem('scene_image_llm_type');
  const savedLlmBaseUrl = localStorage.getItem('scene_image_llm_base_url');
  const savedLlmModel = localStorage.getItem('scene_image_llm_model');
  const savedLlmApiKey = localStorage.getItem('scene_image_llm_api_key');

  if (savedVideoGenEnabled === 'true') {
    setVideoGenEnabled(true);
  }

  setVideoGenLlmConfig({
    type: (savedLlmType as 'openai' | 'ollama') || 'openai',
    baseUrl: savedLlmBaseUrl || 'https://api.openai.com',
    model: savedLlmModel || 'gpt-3.5-turbo',
    apiKey: savedLlmApiKey || '',
  });

  // 监听设置变更事件
  const handleVideoGenSettingsChanged = (event: Event) => {
    const customEvent = event as CustomEvent;
    const { enabled, llmType, llmBaseUrl, llmModel, llmApiKey } = customEvent.detail;
    setVideoGenEnabled(enabled);
    setVideoGenLlmConfig({
      type: llmType,
      baseUrl: llmBaseUrl,
      model: llmModel,
      apiKey: llmApiKey,
    });
  };

  window.addEventListener('videoGenerationSettingsChanged', handleVideoGenSettingsChanged);

  return () => {
    window.removeEventListener('videoGenerationSettingsChanged', handleVideoGenSettingsChanged);
  };
}, []);
```

#### 4.4 生成处理函数

```typescript
const handleGenerateVideo = async (messageId: string, messageIndex: number) => {
  if (!videoGenEnabled || !videoGenLlmConfig.apiKey) {
    console.error('Video generation is not properly configured');
    return;
  }

  // 检查是否已在生成
  if (generatingVideos.get(messageId)) {
    console.log('Video already generating for message:', messageId);
    return;
  }

  const message = messages[messageIndex];

  // 提取 TTS 文本（高亮文本）
  const ttsService = new TTSService({ apiKey: '', workflowId: '' });
  const speeches = ttsService.extractSpeechContent(message.content);

  if (speeches.length === 0) {
    setVideoErrors(new Map(videoErrors.set(messageId, '未找到说话内容')));
    return;
  }

  const ttsText = speeches.join(' ');

  // 标记为生成中
  setGeneratingVideos(new Map(generatingVideos.set(messageId, true)));
  setVideoProgress(new Map(videoProgress.set(messageId, 0)));
  setVideoStatus(new Map(videoStatus.set(messageId, '正在准备...')));
  setVideoErrors(new Map(videoErrors.set(messageId, '')));

  try {
    // 获取对话上下文（最近 3-5 条消息）
    const recentMessages = messages
      .slice(Math.max(0, messageIndex - 4), messageIndex + 1)
      .map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

    // 创建服务实例
    const service = new ComfyUIVideoService({
      llmConfig: videoGenLlmConfig,
    });

    // 1. 生成提示词
    setVideoStatus(new Map(videoStatus.set(messageId, '正在分析对话...')));
    const prompts = await service.generatePrompts(
      {
        name: character.name,
        description: character.description,
        personality: character.personality,
      },
      recentMessages,
      ttsText
    );

    setVideoProgress(new Map(videoProgress.set(messageId, 5)));

    // 2. 构建工作流
    setVideoStatus(new Map(videoStatus.set(messageId, '正在准备工作流...')));
    const workflow = service.buildWorkflow(ttsText, prompts.imagePrompt, prompts.videoPrompt);

    setVideoProgress(new Map(videoProgress.set(messageId, 10)));

    // 3. 提交并生成
    setVideoStatus(new Map(videoStatus.set(messageId, '正在生成视频...')));

    const promptId = await service.submitWorkflow(workflow, (progress, status) => {
      setVideoProgress(new Map(videoProgress.set(messageId, progress)));
      setVideoStatus(new Map(videoStatus.set(messageId, status)));
    });

    // 4. 获取结果
    const result = await service.pollResult(promptId);

    // 5. 保存结果
    setGeneratedVideos(new Map(generatedVideos.set(messageId, result.videoUrl)));
    setVideoProgress(new Map(videoProgress.set(messageId, 100)));
    setVideoStatus(new Map(videoStatus.set(messageId, '生成完成！')));

    console.log('Video generated successfully:', result.videoUrl);

  } catch (error) {
    console.error('Error generating video:', error);
    setVideoErrors(new Map(videoErrors.set(messageId,
      error instanceof Error ? error.message : '生成失败'
    )));
  } finally {
    setGeneratingVideos(new Map(generatingVideos.set(messageId, false)));
  }
};
```

#### 4.5 UI 渲染 - 生成按钮

在 TTS 按钮后添加视频生成按钮：

```tsx
{/* Scene Video Generation Button - Show for assistant messages when enabled */}
{message.role === "assistant" && videoGenEnabled && videoGenLlmConfig.apiKey && (
  <button
    onClick={() => {
      handleGenerateVideo(message.id, index);
      trackButtonClick("page", "生成场景视频");
    }}
    disabled={generatingVideos.get(message.id) || false}
    className={`ml-1 w-6 h-6 flex items-center justify-center bg-[#1c1c1c] rounded-lg border shadow-inner transition-all duration-300 group relative ${
      generatedVideos.has(message.id)
        ? "text-green-400 hover:text-green-300 border-green-400/60 hover:border-green-300/70 hover:shadow-[0_0_8px_rgba(74,222,128,0.4)]"
        : generatingVideos.get(message.id)
          ? "text-[#8a8a8a] border-[#333333] cursor-not-allowed"
          : "text-[#6b9bd1] hover:text-[#60a5fa] border-[#333333] hover:border-[#444444] hover:shadow-[0_0_8px_rgba(96,165,250,0.4)]"
    }`}
  >
    {/* Tooltip */}
    <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#2a261f] text-[#f4e8c1] text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap border border-[#534741] pointer-events-none z-50">
      {generatingVideos.get(message.id) ? (
        <>
          {videoStatus.get(message.id) || '生成中...'}
          <br />
          {Math.round(videoProgress.get(message.id) || 0)}%
        </>
      ) : videoErrors.get(message.id) ? (
        videoErrors.get(message.id)
      ) : generatedVideos.has(message.id) ? (
        "重新生成视频"
      ) : (
        "生成场景视频"
      )}
    </div>

    {generatingVideos.get(message.id) ? (
      // Loading animation with progress
      <div className="relative">
        <svg
          className="animate-spin h-3 w-3"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>
    ) : (
      // Video icon
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="23 7 16 12 23 17 23 7"></polygon>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
      </svg>
    )}
  </button>
)}
```

#### 4.6 UI 渲染 - 视频播放器

在消息内容下方添加视频播放器：

```tsx
{/* Scene Video Display - Show generated video if available */}
{message.role === "assistant" && generatedVideos.has(message.id) && (
  <div className="mt-4 rounded-lg overflow-hidden border border-[#534741] bg-[#1e1a15] p-2">
    <video
      src={generatedVideos.get(message.id)}
      controls
      className="w-full h-auto rounded-md"
      preload="metadata"
      onError={(e) => {
        console.error("Failed to load scene video:", e);
        setVideoErrors(new Map(videoErrors.set(message.id, '视频加载失败')));
        const newMap = new Map(generatedVideos);
        newMap.delete(message.id);
        setGeneratedVideos(newMap);
      }}
    >
      您的浏览器不支持视频播放
    </video>

    {/* Video info */}
    <div className="mt-2 text-xs text-[#8a8a8a] flex items-center justify-between">
      <span>场景视频</span>
      <a
        href={generatedVideos.get(message.id)}
        download={`scene-video-${message.id}.mp4`}
        className="text-[#6b9bd1] hover:text-[#60a5fa] hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        下载视频
      </a>
    </div>
  </div>
)}

{/* Video generation progress bar */}
{message.role === "assistant" && generatingVideos.get(message.id) && (
  <div className="mt-4 rounded-lg border border-[#534741] bg-[#1e1a15] p-3">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm text-[#f4e8c1]">
        {videoStatus.get(message.id) || '生成中...'}
      </span>
      <span className="text-sm text-[#8a8a8a]">
        {Math.round(videoProgress.get(message.id) || 0)}%
      </span>
    </div>
    <div className="w-full h-2 bg-[#2a261f] rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-[#6b9bd1] to-[#60a5fa] transition-all duration-300"
        style={{ width: `${videoProgress.get(message.id) || 0}%` }}
      ></div>
    </div>
  </div>
)}
```

---

### 5. 侧边栏集成 (components/ModelSidebar.tsx)

**修改点：**

```tsx
import VideoGenerationSettingsPanel from "@/components/VideoGenerationSettingsPanel";

// 在 TTSSettingsPanel 后添加
<TTSSettingsPanel />

{/* Scene Video Generation Settings Panel */}
<VideoGenerationSettingsPanel />
```

---

## 实施步骤

### Phase 1: 基础架构搭建 (2-3 小时)

**Step 1.1: 创建 ComfyUI 服务类**
- [ ] 创建 `lib/api/comfyui-video-service.ts`
- [ ] 实现基础类结构和类型定义
- [ ] 实现 LLM 提示词生成逻辑
- [ ] 实现工作流 JSON 构建逻辑
- [ ] 添加详细的注释和文档

**Step 1.2: 实现 API 调用**
- [ ] 实现 POST /prompt 提交逻辑
- [ ] 实现 WebSocket 连接和消息处理
- [ ] 实现进度映射逻辑
- [ ] 实现结果轮询逻辑
- [ ] 实现视频 URL 获取

**Step 1.3: 错误处理**
- [ ] 添加完整的错误处理机制
- [ ] 添加超时处理（5 分钟）
- [ ] 添加取消生成功能
- [ ] 添加调试日志

### Phase 2: 状态管理 Hook (1 小时)

**Step 2.1: 创建 Hook**
- [ ] 创建 `hooks/useVideoGeneration.ts`
- [ ] 实现状态管理逻辑
- [ ] 实现生成流程控制
- [ ] 实现错误处理和重试

**Step 2.2: 测试 Hook**
- [ ] 验证状态转换逻辑
- [ ] 验证错误处理
- [ ] 验证取消功能

### Phase 3: 设置面板组件 (1-2 小时)

**Step 3.1: 创建设置面板**
- [ ] 创建 `components/VideoGenerationSettingsPanel.tsx`
- [ ] 实现 UI 布局
- [ ] 实现表单状态管理
- [ ] 实现 LocalStorage 持久化

**Step 3.2: 事件系统**
- [ ] 实现设置变更事件派发
- [ ] 测试事件监听

### Phase 4: UI 集成 (2-3 小时)

**Step 4.1: CharacterChatPanel 改动**
- [ ] 添加导入和类型定义
- [ ] 添加状态管理代码
- [ ] 实现配置加载逻辑
- [ ] 实现生成处理函数

**Step 4.2: 按钮集成**
- [ ] 在 TTS 按钮后添加视频生成按钮
- [ ] 实现按钮样式和动画
- [ ] 实现进度提示

**Step 4.3: 视频播放器**
- [ ] 添加视频播放器组件
- [ ] 添加进度条显示
- [ ] 添加下载链接
- [ ] 实现错误处理

**Step 4.4: 侧边栏集成**
- [ ] 在 ModelSidebar 中添加设置面板

### Phase 5: 测试和优化 (1-2 小时)

**Step 5.1: 功能测试**
- [ ] 测试完整的生成流程
- [ ] 测试 WebSocket 实时进度
- [ ] 测试错误场景
- [ ] 测试取消功能

**Step 5.2: 性能优化**
- [ ] 优化 WebSocket 连接管理
- [ ] 优化轮询频率
- [ ] 优化视频加载

**Step 5.3: 用户体验**
- [ ] 优化进度提示文案
- [ ] 优化错误提示
- [ ] 添加使用说明

**Step 5.4: 代码质量**
- [ ] ESLint 检查
- [ ] TypeScript 类型检查
- [ ] 代码注释完善

### Phase 6: 文档编写 (30 分钟)

**Step 6.1: 使用文档**
- [ ] 编写功能使用说明
- [ ] 编写配置指南
- [ ] 编写故障排查指南

**Step 6.2: 技术文档**
- [ ] 编写 API 调用文档
- [ ] 编写工作流配置说明
- [ ] 编写架构说明

---

## 关键技术细节

### 1. LLM 提示词生成

**System Prompt:**

```
你是一个专业的视频生成提示词专家。根据角色对话内容，生成两个英文提示词：

1. **文生图提示词（Image Prompt）**：
   - 描述场景的环境、氛围、光线
   - 描述角色的外观、动作、表情、服装
   - 使用摄影术语（如 cinematic lighting, bokeh, soft focus）
   - 使用具体的视觉细节（颜色、材质、构图）
   - 格式：逗号分隔的关键词短语
   - 长度：50-100 个单词

2. **图生视频提示词（Video Prompt）**：
   - 描述角色的动态动作和表情变化
   - 强调"说话"、"对镜头讲话"等动态元素
   - 描述头部和面部的细微运动
   - 保持简洁，聚焦核心动作
   - 格式：简短的英文描述
   - 长度：10-30 个单词

输出格式（JSON）：
{
  "imagePrompt": "英文图像提示词",
  "videoPrompt": "英文视频提示词"
}

要求：
- 只输出 JSON，不要其他内容
- 图像提示词要详细、具体、富有视觉感
- 视频提示词要简洁、动态、强调说话动作
- 保持风格一致性和真实感
```

**User Prompt 模板:**

```
角色信息：
- 名字：${character.name}
- 描述：${character.description}
${character.personality ? `- 性格：${character.personality}` : ''}

最近对话上下文：
${recentMessages.map((m, i) => `${i+1}. ${m.role}: ${m.content}`).join('\n')}

当前说话内容（最重要）：
"${ttsText}"

请根据以上信息生成适合的图像提示词和视频提示词。
注意：
- 图像提示词应该描绘说话时的场景
- 视频提示词应该强调说话的动作和表情
```

### 2. 工作流 JSON 修改逻辑

```typescript
function buildWorkflow(ttsText: string, imagePrompt: string, videoPrompt: string): any {
  // 加载模板
  const workflow = JSON.parse(JSON.stringify(workflowTemplate));

  // 修改 TTS 节点 (60)
  workflow['60'].inputs.text = ttsText;

  // 修改文生图节点 (8)
  // 保留角色 LoRA 触发词，追加场景描述
  const originalImagePrompt = workflow['8'].inputs.text;
  const characterTrigger = originalImagePrompt.split(',').slice(0, 3).join(','); // 前3个是角色触发词
  workflow['8'].inputs.text = `${characterTrigger}, ${imagePrompt}`;

  // 修改图生视频节点 (31)
  workflow['31'].inputs.positive_prompt = videoPrompt;

  // 可选：修改随机种子
  workflow['12'].inputs.noise_seed = Math.floor(Math.random() * 999999999999999);
  workflow['53'].inputs.seed = Math.floor(Math.random() * 999999999999999);
  workflow['51'].inputs.seed = Math.floor(Math.random() * 999999999999999);

  return workflow;
}
```

### 3. WebSocket 消息处理

```typescript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'status':
      // 队列状态更新
      console.log('Queue status:', data.data);
      break;

    case 'execution_start':
      // 开始执行
      console.log('Execution started:', data.data.prompt_id);
      break;

    case 'execution_cached':
      // 节点被缓存（跳过）
      console.log('Cached nodes:', data.data.nodes);
      break;

    case 'executing':
      // 当前执行的节点
      const nodeId = data.data?.node;
      if (nodeId === null) {
        // 执行完成
        onComplete();
      } else if (nodeId && NODE_PROGRESS_MAP[nodeId]) {
        // 更新进度
        const progress = NODE_PROGRESS_MAP[nodeId];
        const status = NODE_STATUS_MAP[nodeId] || `正在执行节点 ${nodeId}...`;
        onProgress(progress, status);
      }
      break;

    case 'progress':
      // K-Sampler 等节点的细粒度进度
      // data.data.value, data.data.max
      break;

    case 'executed':
      // 节点执行完成（包含输出数据）
      console.log('Node executed:', data.data.node);
      break;

    case 'execution_error':
      // 执行错误
      const error = data.data;
      onError(`节点 ${error.node_id} 执行失败: ${error.exception_message}`);
      break;
  }
};
```

### 4. 结果轮询逻辑

```typescript
async function pollResult(promptId: string, maxAttempts = 150, interval = 2000): Promise<VideoResult> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, interval));

    const response = await fetch(`${BASE_URL}/history/${promptId}`);
    const history = await response.json();

    const promptHistory = history[promptId];
    if (!promptHistory) continue;

    // 检查状态
    if (promptHistory.status?.completed) {
      // 获取视频输出（节点 50）
      const outputs = promptHistory.outputs;
      if (outputs['50'] && outputs['50'].videos && outputs['50'].videos.length > 0) {
        const videoInfo = outputs['50'].videos[0];
        const videoUrl = this.getVideoUrl(
          videoInfo.filename,
          videoInfo.subfolder || '',
          videoInfo.type || 'output'
        );

        return {
          videoUrl,
          filename: videoInfo.filename,
          duration: 0, // 可以从音频时长计算
        };
      }
    }

    // 检查错误
    if (promptHistory.status?.status_str === 'error') {
      throw new Error('ComfyUI workflow execution failed');
    }
  }

  throw new Error('Polling timeout: Video generation took too long');
}
```

---

## 数据流图

```
用户操作
    ↓
[点击生成视频按钮]
    ↓
CharacterChatPanel
    ↓
handleGenerateVideo()
    ├─ 提取 TTS 文本（复用 TTSService.extractSpeechContent）
    ├─ 获取对话上下文（最近 3-5 条消息）
    └─ 调用 ComfyUIVideoService
           ↓
    ┌──────┴──────────────────────────────┐
    │  ComfyUIVideoService                 │
    │                                      │
    │  1. generatePrompts()                │
    │     ├─ 调用 LLM API (OpenAI/Ollama) │
    │     ├─ System Prompt: 专家提示      │
    │     ├─ User Prompt: 角色+对话+TTS   │
    │     └─ 返回 { imagePrompt, videoPrompt } │
    │                                      │
    │  2. buildWorkflow()                  │
    │     ├─ 加载工作流模板 JSON           │
    │     ├─ 修改节点 60: TTS 文本        │
    │     ├─ 修改节点 8: 图像提示词       │
    │     ├─ 修改节点 31: 视频提示词      │
    │     └─ 返回修改后的工作流            │
    │                                      │
    │  3. submitWorkflow()                 │
    │     ├─ 生成 client_id               │
    │     ├─ 建立 WebSocket 连接          │
    │     ├─ POST /prompt                 │
    │     └─ 返回 prompt_id               │
    │                                      │
    │  4. WebSocket 监听                   │
    │     ├─ 'executing': 更新进度        │
    │     ├─ 'progress': K-Sampler 进度   │
    │     ├─ 'error': 错误处理            │
    │     └─ onProgress(progress, status) │
    │                                      │
    │  5. pollResult()                     │
    │     ├─ 轮询 GET /history/{prompt_id}│
    │     ├─ 检查 status.completed        │
    │     ├─ 获取 outputs['50'].videos[0] │
    │     └─ 返回 { videoUrl, filename }  │
    └──────┬──────────────────────────────┘
           ↓
    返回视频 URL
           ↓
CharacterChatPanel
    ├─ setGeneratedVideos(messageId, videoUrl)
    └─ 渲染视频播放器 <video src={videoUrl} />
```

---

## 测试计划

### 单元测试

1. **ComfyUIVideoService**
   - [ ] generatePrompts() - 验证 LLM 返回格式
   - [ ] buildWorkflow() - 验证 JSON 修改正确性
   - [ ] 节点进度映射 - 验证映射表完整性

2. **useVideoGeneration Hook**
   - [ ] 状态转换 - 验证状态机正确性
   - [ ] 错误处理 - 验证错误捕获
   - [ ] 取消功能 - 验证清理逻辑

### 集成测试

1. **完整流程测试**
   - [ ] 正常生成流程
   - [ ] 进度更新实时性
   - [ ] 视频播放正常

2. **错误场景测试**
   - [ ] LLM API 失败
   - [ ] ComfyUI 未启动
   - [ ] 工作流执行失败
   - [ ] 网络超时

3. **边界测试**
   - [ ] 空 TTS 文本
   - [ ] 超长对话上下文
   - [ ] 快速连续点击

### 性能测试

- [ ] WebSocket 连接稳定性
- [ ] 轮询频率合理性
- [ ] 内存泄漏检查

---

## 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| ComfyUI 工作流更新 | 高 | 中 | 版本化工作流模板，添加兼容性检查 |
| 生成时间过长 | 中 | 高 | 清晰的进度提示，支持取消 |
| 显存不足导致失败 | 高 | 中 | 友好的错误提示，建议用户检查 |
| 跨域问题 | 中 | 低 | 提供 API 代理方案 |
| LLM 提示词质量差 | 中 | 中 | 迭代优化 Prompt，提供手动编辑 |

---

## 后续优化方向

### 短期优化（1-2 周）

1. **提示词编辑功能**
   - 允许用户查看和编辑生成的提示词
   - 提供提示词模板和示例

2. **进度估算优化**
   - 根据历史数据动态调整时间估算
   - 显示剩余时间

3. **视频缓存**
   - 将生成的视频 URL 持久化到 localStorage
   - 避免刷新后丢失

### 中期优化（1 个月）

1. **批量生成**
   - 支持一次生成多条消息的视频
   - 队列管理

2. **参考音频管理**
   - 在角色编辑器中添加音频上传
   - 动态传递音频路径到工作流

3. **LoRA 管理**
   - 支持选择不同的 LoRA 模型
   - 角色与 LoRA 的关联

### 长期优化（3 个月）

1. **远程 ComfyUI 支持**
   - 支持连接远程 ComfyUI 服务器
   - API Key 认证

2. **工作流市场**
   - 支持导入/导出自定义工作流
   - 社区分享工作流

3. **高级编辑**
   - 视频裁剪和拼接
   - 添加字幕和特效

---

## 总结

本实施计划详细描述了场景视频生成功能的：

- ✅ 完整的技术架构（4 个核心模块）
- ✅ 详细的实施步骤（6 个 Phase）
- ✅ 关键技术细节（API 调用、WebSocket、提示词生成）
- ✅ 完整的数据流图
- ✅ 测试计划和风险评估
- ✅ 后续优化方向

**预计总开发时间：8-12 小时**

**核心优势：**
- 复用现有架构（TTS 服务、场景图片配置）
- 清晰的模块划分和职责分离
- 完善的错误处理和用户体验
- 详细的文档和注释

---

*文档版本：v1.0*
*创建日期：2025-11-01*
*最后更新：2025-11-01*
