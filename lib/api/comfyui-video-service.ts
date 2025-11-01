/**
 * ComfyUI Video Generation Service
 *
 * This service handles scene video generation using local ComfyUI workflow.
 * The workflow executes: TTS → Text-to-Image → Image-to-Video
 *
 * Core responsibilities:
 * - Generate image and video prompts using LLM
 * - Build and submit ComfyUI workflow JSON
 * - Monitor progress via WebSocket
 * - Poll for results and retrieve video URL
 *
 * Technical flow:
 * 1. User clicks "Generate Video" button
 * 2. Extract TTS text from conversation
 * 3. Generate prompts via LLM (OpenAI/Ollama)
 * 4. Modify workflow JSON with prompts and TTS text
 * 5. Submit to ComfyUI (POST /prompt)
 * 6. Monitor via WebSocket for real-time progress
 * 7. Poll /history/{prompt_id} for result
 * 8. Return video URL from /view endpoint
 */

import workflowTemplate from "@/docs/workflow/tts+文生图+图生视频-api-1101.json";

// ============================================================================
// Type Definitions
// ============================================================================

export interface VideoConfig {
  llmConfig?: {
    type: "openai" | "ollama";
    baseUrl: string;
    model: string;
    apiKey?: string; // Optional for Ollama
  };
  comfyuiUrl?: string; // Default: http://localhost:9000
}

export interface VideoResult {
  videoUrl: string;
  filename: string;
  duration: number;
}

export interface PromptResult {
  imagePrompt: string;
  videoPrompt: string;
}

interface Message {
  role: string;
  content: string;
}

interface Character {
  name?: string;
  description?: string;
  personality?: string;
}

interface ComfyUIHistoryResponse {
  [promptId: string]: {
    status?: {
      completed?: boolean;
      status_str?: string;
    };
    outputs?: {
      [nodeId: string]: {
        videos?: Array<{
          filename: string;
          subfolder?: string;
          type?: string;
        }>;
      };
    };
  };
}

// ============================================================================
// Node Progress Mapping
// ============================================================================

/**
 * Maps ComfyUI node IDs to progress percentages
 * Used for real-time progress display via WebSocket
 */
const NODE_PROGRESS_MAP: Record<string, number> = {
  "60": 10,   // Fish-Speech TTS
  "8": 20,    // CLIP Text Encode (Image prompt)
  "10": 22,   // LoRA Loader
  "15": 35,   // FLUX Sampling (Image generation core)
  "16": 40,   // VAE Decode (Image complete)
  "31": 50,   // WanVideo Text Encode (Video prompt)
  "37": 55,   // WanVideo Add S2V Embeds
  "53": 80,   // WanVideo Sampler (Video generation core - slowest)
  "33": 85,   // WanVideo Decode
  "51": 92,   // GIMM-VFI Interpolate (Frame interpolation)
  "50": 98,   // Video Combine (Final output)
};

/**
 * Maps node IDs to Chinese status descriptions
 */
const NODE_STATUS_MAP: Record<string, string> = {
  "60": "正在生成语音...",
  "8": "正在准备图像提示词...",
  "10": "正在加载角色模型...",
  "15": "正在生成图像（需要10-20秒）...",
  "16": "图像生成完成",
  "31": "正在准备视频提示词...",
  "37": "正在准备视频编码...",
  "53": "正在生成视频（需要30-60秒）...",
  "33": "正在处理视频帧...",
  "51": "正在优化帧率...",
  "50": "正在合成最终视频...",
};

// ============================================================================
// Main Service Class
// ============================================================================

export class ComfyUIVideoService {
  private config: VideoConfig;
  private readonly BASE_URL: string;
  private ws: WebSocket | null = null;
  private abortController: AbortController | null = null;

  constructor(config: VideoConfig) {
    this.config = config;
    this.BASE_URL = config.comfyuiUrl || "http://localhost:9000";
  }

  // ==========================================================================
  // LLM Prompt Generation
  // ==========================================================================

  /**
   * Generate image and video prompts using LLM
   *
   * @param character - Character information
   * @param recentMessages - Recent conversation messages (3-5)
   * @param ttsText - Extracted speech text (from quotes)
   * @returns Prompts for image generation and video generation
   *
   * @throws Error if LLM configuration is missing or API call fails
   */
  async generatePrompts(
    character: Character,
    recentMessages: Message[],
    ttsText: string,
  ): Promise<PromptResult> {
    if (!this.config.llmConfig) {
      throw new Error("LLM configuration is required for prompt generation");
    }

    const { type, baseUrl, model, apiKey } = this.config.llmConfig;

    // Build system prompt
    const systemPrompt = `你是一个专业的视频生成提示词专家。根据角色对话内容，生成两个英文提示词：

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
- 保持风格一致性和真实感`;

    // Build user prompt
    const contextMessages = recentMessages
      .map((msg, i) => `${i + 1}. ${msg.role}: ${msg.content}`)
      .join("\n");

    const userPrompt = `角色信息：
- 名字：${character.name || "Unknown"}
- 描述：${character.description || "No description"}
${character.personality ? `- 性格：${character.personality}` : ""}

最近对话上下文：
${contextMessages}

当前说话内容（最重要）：
"${ttsText}"

请根据以上信息生成适合的图像提示词和视频提示词。
注意：
- 图像提示词应该描绘说话时的场景
- 视频提示词应该强调说话的动作和表情`;

    try {
      let response: Response;

      if (type === "openai") {
        // OpenAI API format
        response = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.7,
            response_format: { type: "json_object" },
          }),
        });
      } else {
        // Ollama API format
        response = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            stream: false,
            format: "json",
          }),
        });
      }

      if (!response.ok) {
        throw new Error(`LLM API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      // Parse response
      let content: string;
      if (type === "openai") {
        content = data.choices[0].message.content;
      } else {
        content = data.message.content;
      }

      // Parse JSON response
      const result = JSON.parse(content);

      if (!result.imagePrompt || !result.videoPrompt) {
        throw new Error("LLM response missing required fields");
      }

      console.log("Generated prompts:", result);

      return {
        imagePrompt: result.imagePrompt,
        videoPrompt: result.videoPrompt,
      };
    } catch (error) {
      console.error("Error generating prompts:", error);
      throw new Error(
        `Failed to generate prompts: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // ==========================================================================
  // Workflow Building
  // ==========================================================================

  /**
   * Build ComfyUI workflow JSON with dynamic parameters
   *
   * @param ttsText - Text for TTS generation
   * @param imagePrompt - Generated image prompt (English)
   * @param videoPrompt - Generated video prompt (English)
   * @returns Modified workflow JSON ready for submission
   *
   * Workflow modifications:
   * - Node 60: TTS text
   * - Node 8: Image prompt (preserves character LoRA trigger words)
   * - Node 31: Video prompt
   * - Nodes 12, 53, 51: Random seeds for variation
   */
  buildWorkflow(
    ttsText: string,
    imagePrompt: string,
    videoPrompt: string,
  ): any {
    // Deep clone template to avoid mutation
    const workflow = JSON.parse(JSON.stringify(workflowTemplate));

    // Modify TTS node (60)
    workflow["60"].inputs.text = ttsText;

    // Modify image generation node (8)
    // Preserve character LoRA trigger words (first 3 comma-separated items)
    const originalImagePrompt = workflow["8"].inputs.text;
    const characterTrigger = originalImagePrompt
      .split(",")
      .slice(0, 3)
      .join(",");
    workflow["8"].inputs.text = `${characterTrigger}, ${imagePrompt}`;

    console.log("Image prompt:", workflow["8"].inputs.text);

    // Modify video generation node (31)
    workflow["31"].inputs.positive_prompt = videoPrompt;

    console.log("Video prompt:", videoPrompt);

    // Randomize seeds for variation
    const randomSeed = () => Math.floor(Math.random() * 999999999999999);
    workflow["12"].inputs.noise_seed = randomSeed(); // FLUX noise
    workflow["53"].inputs.seed = randomSeed(); // WanVideo sampler
    workflow["51"].inputs.seed = randomSeed(); // GIMM-VFI interpolate
    workflow["60"].inputs.seed = randomSeed(); // Fish-Speech TTS

    return workflow;
  }

  // ==========================================================================
  // ComfyUI API Interaction
  // ==========================================================================

  /**
   * Submit workflow to ComfyUI and monitor progress
   *
   * @param workflow - Modified workflow JSON
   * @param onProgress - Progress callback (progress: 0-100, status: string)
   * @returns Promise resolving to prompt_id
   *
   * @throws Error if submission fails or ComfyUI is not running
   */
  async submitWorkflow(
    workflow: any,
    onProgress?: (progress: number, status: string) => void,
  ): Promise<string> {
    // Generate client ID
    const clientId = this.generateClientId();

    console.log("Submitting workflow to ComfyUI, client_id:", clientId);

    try {
      // Connect WebSocket for real-time progress
      if (onProgress) {
        this.connectWebSocket(
          clientId,
          (progress, status) => {
            onProgress(progress, status);
          },
          () => {
            console.log("Workflow execution completed");
          },
          (error) => {
            console.error("WebSocket error:", error);
          },
        );
      }

      // Submit workflow via REST API
      const response = await fetch(`${this.BASE_URL}/prompt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: workflow,
          client_id: clientId,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to submit workflow: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`ComfyUI error: ${data.error}`);
      }

      const promptId = data.prompt_id;
      console.log("Workflow submitted, prompt_id:", promptId);

      return promptId;
    } catch (error) {
      console.error("Error submitting workflow:", error);
      throw new Error(
        `Failed to submit workflow: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Connect to ComfyUI WebSocket for real-time progress updates
   */
  private connectWebSocket(
    clientId: string,
    onProgress: (progress: number, status: string) => void,
    onComplete: () => void,
    onError: (error: string) => void,
  ): void {
    const wsUrl = this.BASE_URL.replace("http://", "ws://").replace(
      "https://",
      "wss://",
    );
    const ws = new WebSocket(`${wsUrl}/ws?clientId=${clientId}`);

    ws.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
        case "status":
          // Queue status update
          console.log("Queue status:", data.data);
          break;

        case "execution_start":
          // Execution started
          console.log("Execution started:", data.data?.prompt_id);
          break;

        case "execution_cached":
          // Some nodes were cached (skipped)
          console.log("Cached nodes:", data.data?.nodes);
          break;

        case "executing":
          // Currently executing node
          const nodeId = data.data?.node;
          if (nodeId === null) {
            // Execution completed
            console.log("Execution completed");
            onComplete();
            ws.close();
          } else if (nodeId && NODE_PROGRESS_MAP[nodeId]) {
            // Update progress
            const progress = NODE_PROGRESS_MAP[nodeId];
            const status =
                NODE_STATUS_MAP[nodeId] || `正在执行节点 ${nodeId}...`;
            onProgress(progress, status);
          }
          break;

        case "progress":
          // Fine-grained progress (e.g., K-Sampler steps)
          // data.data.value, data.data.max
          if (data.data?.value && data.data?.max) {
            console.log(
              `Node progress: ${data.data.value}/${data.data.max}`,
            );
          }
          break;

        case "executed":
          // Node execution completed (includes output data)
          console.log("Node executed:", data.data?.node);
          break;

        case "execution_error":
          // Execution error
          const error = data.data;
          const errorMsg = `节点 ${error.node_id} 执行失败: ${error.exception_message}`;
          console.error("Execution error:", errorMsg);
          onError(errorMsg);
          ws.close();
          break;

        default:
          console.log("Unknown WebSocket message type:", data.type);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      onError("WebSocket connection failed");
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
      this.ws = null;
    };

    this.ws = ws;
  }

  /**
   * Poll ComfyUI history endpoint for workflow result
   *
   * @param promptId - Prompt ID from submission
   * @param maxAttempts - Maximum polling attempts (default: 150 = 5 minutes)
   * @param interval - Polling interval in ms (default: 2000)
   * @returns Video result with URL and metadata
   *
   * @throws Error if polling times out or execution fails
   */
  async pollResult(
    promptId: string,
    maxAttempts = 150,
    interval = 2000,
  ): Promise<VideoResult> {
    console.log(`Polling for result, prompt_id: ${promptId}`);

    for (let i = 0; i < maxAttempts; i++) {
      await this.sleep(interval);

      try {
        const response = await fetch(`${this.BASE_URL}/history/${promptId}`);

        if (!response.ok) {
          console.warn(
            `History request failed: ${response.status} ${response.statusText}`,
          );
          continue;
        }

        const history: ComfyUIHistoryResponse = await response.json();
        const promptHistory = history[promptId];

        if (!promptHistory) {
          console.log(`Attempt ${i + 1}/${maxAttempts}: No history yet`);
          continue;
        }

        // Check if completed
        if (promptHistory.status?.completed) {
          console.log("Workflow execution completed!");

          // Get video output from node 50 (VHS_VideoCombine)
          const outputs = promptHistory.outputs;
          if (
            outputs &&
            outputs["50"] &&
            outputs["50"].videos &&
            outputs["50"].videos.length > 0
          ) {
            const videoInfo = outputs["50"].videos[0];
            const videoUrl = this.getVideoUrl(
              videoInfo.filename,
              videoInfo.subfolder || "",
              videoInfo.type || "output",
            );

            console.log("Video generated successfully:", videoUrl);

            return {
              videoUrl,
              filename: videoInfo.filename,
              duration: 0, // Could calculate from audio duration if needed
            };
          } else {
            throw new Error("No video output found in results");
          }
        }

        // Check for errors
        if (promptHistory.status?.status_str === "error") {
          throw new Error("ComfyUI workflow execution failed");
        }

        console.log(
          `Attempt ${i + 1}/${maxAttempts}: Still processing...`,
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes("failed")) {
          throw error;
        }
        console.error("Error polling result:", error);
      }
    }

    throw new Error(
      `Polling timeout: Video generation took too long (>${(maxAttempts * interval) / 1000}s)`,
    );
  }

  /**
   * Get video URL from ComfyUI /view endpoint
   */
  getVideoUrl(filename: string, subfolder: string, type: string): string {
    const params = new URLSearchParams({
      filename,
      type,
      subfolder,
    });
    return `${this.BASE_URL}/view?${params.toString()}`;
  }

  /**
   * Cancel ongoing generation
   */
  cancelGeneration(promptId: string): void {
    console.log("Canceling generation:", promptId);

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Abort fetch requests
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // Note: ComfyUI doesn't have a direct "cancel" API
    // The workflow will continue running on the server
    // We just stop monitoring it
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
