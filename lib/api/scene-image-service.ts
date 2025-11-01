/**
 * Scene Image Generation Service Module
 *
 * This module provides scene image generation functionality using RunningHub API.
 * It handles:
 * - Generating image prompts from conversation context using LLM
 * - Creating image generation tasks via RunningHub API
 * - Polling task results
 * - Caching generated image URLs
 */

export interface SceneImageConfig {
  apiKey: string;
  workflowId: string;
  llmConfig?: {
    type: "openai" | "ollama";
    baseUrl: string;
    model: string;
    apiKey?: string;
  };
}

export interface SceneImageTaskResult {
  taskId: string;
  imageUrl?: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  error?: string;
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

export class SceneImageService {
  private config: SceneImageConfig;
  private imageCache: Map<string, string> = new Map(); // messageId -> imageUrl
  private readonly API_BASE_URL = "https://www.runninghub.cn";
  private readonly DEFAULT_WORKFLOW_ID = "1978370860388126722";
  private readonly MAX_POLL_ATTEMPTS = 60; // 最多轮询 60 次
  private readonly POLL_INTERVAL = 2000; // 每 2 秒轮询一次

  constructor(config: SceneImageConfig) {
    this.config = {
      ...config,
      workflowId: config.workflowId || this.DEFAULT_WORKFLOW_ID,
    };
  }

  /**
   * Generate image prompt from conversation context using LLM
   * @param character Character information
   * @param recentMessages Recent conversation messages (3-5 messages)
   * @param lastMessage The most important last message
   * @returns Generated prompt in English
   */
  async generatePrompt(
    character: Character,
    recentMessages: Message[],
    lastMessage: Message,
  ): Promise<string> {
    if (!this.config.llmConfig) {
      throw new Error("LLM configuration is required for prompt generation");
    }

    const { type, baseUrl, model, apiKey } = this.config.llmConfig;

    // Build context from recent messages
    const contextMessages = recentMessages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    // Build prompt template
    const systemPrompt = `你是一个专业的场景描述生成器。根据角色信息和对话内容，生成详细的英文图像生成提示词。

要求：
1. 描述当前场景的环境、氛围、光线
2. 描述角色的动作、表情、服装
3. 使用具体的视觉细节（颜色、材质、构图）
4. 输出格式：纯英文，逗号分隔的关键词
5. 重点关注最后一条消息中的场景描述

示例输出：a young woman in casual clothes, sitting in a cozy coffee shop, warm afternoon sunlight, soft focus, cinematic lighting, detailed background, photorealistic`;

    const userPrompt = `角色信息：
- 名字：${character.name || "Unknown"}
- 描述：${character.description || "No description"}
${character.personality ? `- 性格：${character.personality}` : ""}

最近对话：
${contextMessages}

最重要的当前场景（最后一条消息）：
${lastMessage.role}: ${lastMessage.content}

请生成图像提示词：`;

    try {
      if (type === "openai") {
        return await this.generatePromptOpenAI(
          baseUrl,
          model,
          apiKey || "",
          systemPrompt,
          userPrompt,
        );
      } else if (type === "ollama") {
        return await this.generatePromptOllama(
          baseUrl,
          model,
          systemPrompt,
          userPrompt,
        );
      } else {
        throw new Error(`Unsupported LLM type: ${type}`);
      }
    } catch (error) {
      console.error("Failed to generate prompt:", error);
      throw new Error(
        `Failed to generate image prompt: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Generate prompt using OpenAI-compatible API
   */
  private async generatePromptOpenAI(
    baseUrl: string,
    model: string,
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
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
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || "";
  }

  /**
   * Generate prompt using Ollama API
   */
  private async generatePromptOllama(
    baseUrl: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    const response = await fetch(`${baseUrl}/api/chat`, {
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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.message?.content?.trim() || "";
  }

  /**
   * Create scene image generation task
   * @param prompt Image generation prompt
   * @param referenceImage Optional reference image (character portrait)
   * @param onProgress Progress callback (0-100)
   * @returns Task result with image URL
   */
  async generateSceneImage(
    prompt: string,
    referenceImage?: string,
    onProgress?: (progress: number) => void,
  ): Promise<SceneImageTaskResult> {
    try {
      // Step 1: Create task
      const taskId = await this.createTask(prompt, referenceImage);

      if (onProgress) {
        onProgress(10);
      }

      // Step 2: Poll for result
      const result = await this.pollTaskResult(taskId, onProgress);

      return result;
    } catch (error) {
      console.error("Failed to generate scene image:", error);
      return {
        taskId: "",
        status: "failed",
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Create image generation task via RunningHub API
   */
  private async createTask(
    prompt: string,
    referenceImage?: string,
  ): Promise<string> {
    const { apiKey, workflowId } = this.config;

    if (!apiKey) {
      throw new Error("API Key is required");
    }

    // Build workflow prompt based on whether reference image is provided
    let workflowPrompt: Record<string, unknown>;

    if (referenceImage) {
      // Use Image2Image workflow with reference image
      workflowPrompt = {
        "34": {
          inputs: {
            prompt: prompt,
            seed: Math.floor(Math.random() * 1000000000),
            aspectRatio: "auto",
            image1: ["35", 0],
          },
          class_type: "RH_Nano_Banana_Image2Image",
        },
        "35": {
          inputs: {
            image: referenceImage, // Reference image URL or path
          },
          class_type: "LoadImage",
        },
        "32": {
          inputs: {
            filename_prefix: "SceneImage",
            images: ["34", 0],
          },
          class_type: "SaveImage",
        },
      };
    } else {
      // Use Text2Image workflow with empty image
      workflowPrompt = {
        "4": {
          inputs: {
            width: 768,
            height: 1024,
            batch_size: 1,
            color: 0,
          },
          class_type: "EmptyImage",
        },
        "12": {
          inputs: {
            prompt: prompt,
            seed: Math.floor(Math.random() * 1000000000),
            aspectRatio: "auto",
            images: ["4", 0],
          },
          class_type: "RH_Nano_Banana_Image2Image",
        },
        "3": {
          inputs: {
            filename_prefix: "SceneImage",
            images: ["12", 0],
          },
          class_type: "SaveImage",
        },
      };
    }

    console.log("[SceneImageService] Creating task with prompt:", prompt);
    console.log(
      "[SceneImageService] Using reference image:",
      referenceImage || "None",
    );

    const response = await fetch(
      `${this.API_BASE_URL}/api/hub/workflow/openApiRun?workflowId=${workflowId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: apiKey,
        },
        body: JSON.stringify({
          prompt: workflowPrompt,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[SceneImageService] API error response:", errorText);
      throw new Error(`RunningHub API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log("[SceneImageService] Task created:", data);

    if (!data.data?.taskId) {
      throw new Error("Invalid API response: missing taskId");
    }

    return data.data.taskId;
  }

  /**
   * Poll task result until completion
   */
  private async pollTaskResult(
    taskId: string,
    onProgress?: (progress: number) => void,
  ): Promise<SceneImageTaskResult> {
    const { apiKey } = this.config;

    for (let attempt = 0; attempt < this.MAX_POLL_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, this.POLL_INTERVAL));

      try {
        const response = await fetch(
          `${this.API_BASE_URL}/api/hub/workflow/taskResult?taskId=${taskId}`,
          {
            headers: {
              Authorization: apiKey,
            },
          },
        );

        if (!response.ok) {
          console.error(
            `[SceneImageService] Poll error: ${response.status}`,
          );
          continue;
        }

        const data = await response.json();
        console.log(`[SceneImageService] Poll result (attempt ${attempt + 1}):`, data);

        // Calculate progress (10% already done from task creation)
        const progress = Math.min(90, 10 + (attempt / this.MAX_POLL_ATTEMPTS) * 80);
        if (onProgress) {
          onProgress(progress);
        }

        // Check task status
        if (data.data?.status === "SUCCESS") {
          // Extract image URL from result
          const imageUrl = this.extractImageUrl(data.data);
          if (imageUrl) {
            if (onProgress) {
              onProgress(100);
            }
            return {
              taskId,
              imageUrl,
              status: "completed",
              progress: 100,
            };
          }
        } else if (data.data?.status === "FAILED") {
          return {
            taskId,
            status: "failed",
            error: "Task failed on server",
          };
        }
      } catch (error) {
        console.error(`[SceneImageService] Poll attempt ${attempt + 1} failed:`, error);
      }
    }

    // Timeout
    return {
      taskId,
      status: "failed",
      error: "Task polling timeout",
    };
  }

  /**
   * Extract image URL from task result
   */
  private extractImageUrl(resultData: any): string | null {
    try {
      // Try to extract from various possible structures
      if (resultData.outputs) {
        // Look for SaveImage node outputs
        for (const nodeId of Object.keys(resultData.outputs)) {
          const output = resultData.outputs[nodeId];
          if (output.images && output.images.length > 0) {
            const image = output.images[0];
            if (image.url) {
              return image.url;
            }
            // Construct URL from filename
            if (image.filename) {
              return `${this.API_BASE_URL}/view?filename=${encodeURIComponent(image.filename)}`;
            }
          }
        }
      }

      // Alternative structure
      if (resultData.result?.images && resultData.result.images.length > 0) {
        return resultData.result.images[0].url || resultData.result.images[0];
      }

      console.error("[SceneImageService] Could not extract image URL from result:", resultData);
      return null;
    } catch (error) {
      console.error("[SceneImageService] Error extracting image URL:", error);
      return null;
    }
  }

  /**
   * Check if image is already cached
   */
  getCachedImage(messageId: string): string | undefined {
    return this.imageCache.get(messageId);
  }

  /**
   * Cache generated image
   */
  cacheImage(messageId: string, imageUrl: string): void {
    this.imageCache.set(messageId, imageUrl);
  }

  /**
   * Clear image cache
   */
  clearCache(): void {
    this.imageCache.clear();
  }
}
