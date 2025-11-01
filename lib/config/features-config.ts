/**
 * Features Configuration
 *
 * Centralized configuration for TTS, Scene Image, Video Generation, and Chat LLM features
 * All configurations are read from environment variables (.env file)
 */

export interface ChatLLMConfig {
  type: "openai" | "ollama";
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface TTSConfig {
  enabled: boolean;
  apiKey: string;
  workflowId: string;
  autoPlay: boolean;
}

export interface SceneImageConfig {
  enabled: boolean;
  apiKey: string;
  workflowId: string;
  llmType: "openai" | "ollama";
  llmBaseUrl: string;
  llmModel: string;
  llmApiKey: string;
}

export interface VideoGenerationConfig {
  enabled: boolean;
  comfyuiUrl: string;
  llmType: "openai" | "ollama";
  llmBaseUrl: string;
  llmModel: string;
  llmApiKey: string;
}

/**
 * Get Chat LLM configuration from environment variables
 * Falls back to legacy NEXT_PUBLIC_API_* variables if new ones are not set
 */
export function getChatLLMConfig(): ChatLLMConfig {
  const llmType = process.env.NEXT_PUBLIC_CHAT_LLM_TYPE;
  const baseUrl = process.env.NEXT_PUBLIC_CHAT_LLM_BASE_URL
    || process.env.NEXT_PUBLIC_API_URL
    || "https://api.openai.com/v1";
  const model = process.env.NEXT_PUBLIC_CHAT_LLM_MODEL
    || "gpt-4-turbo";
  const apiKey = process.env.NEXT_PUBLIC_CHAT_LLM_API_KEY
    || process.env.NEXT_PUBLIC_API_KEY
    || "";

  return {
    type: (llmType === "ollama" ? "ollama" : "openai") as "openai" | "ollama",
    baseUrl,
    model,
    apiKey,
  };
}

/**
 * Get TTS configuration from environment variables
 */
export function getTTSConfig(): TTSConfig {
  return {
    enabled: process.env.NEXT_PUBLIC_TTS_ENABLED === "true",
    apiKey: process.env.NEXT_PUBLIC_TTS_API_KEY || "",
    workflowId: process.env.NEXT_PUBLIC_TTS_WORKFLOW_ID || "1983711725981769729",
    autoPlay: process.env.NEXT_PUBLIC_TTS_AUTO_PLAY !== "false", // Default true
  };
}

/**
 * Get Scene Image configuration from environment variables
 * Uses Chat LLM configuration for prompt generation
 */
export function getSceneImageConfig(): SceneImageConfig {
  // Use Chat LLM configuration for prompt generation
  const chatLLM = getChatLLMConfig();

  return {
    enabled: process.env.NEXT_PUBLIC_SCENE_IMAGE_ENABLED === "true",
    apiKey: process.env.NEXT_PUBLIC_SCENE_IMAGE_API_KEY || "",
    workflowId: process.env.NEXT_PUBLIC_SCENE_IMAGE_WORKFLOW_ID || "1978370860388126722",
    // Use Chat LLM configuration
    llmType: chatLLM.type,
    llmBaseUrl: chatLLM.baseUrl,
    llmModel: chatLLM.model,
    llmApiKey: chatLLM.apiKey,
  };
}

/**
 * Get Video Generation configuration from environment variables
 * Uses Chat LLM configuration for prompt generation
 */
export function getVideoGenerationConfig(): VideoGenerationConfig {
  // Use Chat LLM configuration for prompt generation
  const chatLLM = getChatLLMConfig();

  return {
    enabled: process.env.NEXT_PUBLIC_VIDEO_GEN_ENABLED === "true",
    comfyuiUrl: process.env.NEXT_PUBLIC_VIDEO_GEN_COMFYUI_URL || "http://localhost:9000",
    // Use Chat LLM configuration
    llmType: chatLLM.type,
    llmBaseUrl: chatLLM.baseUrl,
    llmModel: chatLLM.model,
    llmApiKey: chatLLM.apiKey,
  };
}

/**
 * Validate Chat LLM configuration
 */
export function validateChatLLMConfig(config: ChatLLMConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.baseUrl) {
    errors.push("Chat LLM Base URL is required");
  }
  if (!config.model) {
    errors.push("Chat LLM Model is required");
  }
  if (config.type === "openai" && !config.apiKey) {
    errors.push("Chat LLM API Key is required for OpenAI type");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate TTS configuration
 */
export function validateTTSConfig(config: TTSConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.enabled) {
    if (!config.apiKey) {
      errors.push("TTS API Key is required when TTS is enabled");
    }
    if (!config.workflowId) {
      errors.push("TTS Workflow ID is required");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate Scene Image configuration
 */
export function validateSceneImageConfig(config: SceneImageConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.enabled) {
    if (!config.apiKey) {
      errors.push("Scene Image API Key is required when Scene Image is enabled");
    }
    if (!config.workflowId) {
      errors.push("Scene Image Workflow ID is required");
    }
    if (!config.llmApiKey) {
      errors.push("LLM API Key is required for prompt generation");
    }
    if (!config.llmModel) {
      errors.push("LLM Model is required");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate Video Generation configuration
 */
export function validateVideoGenerationConfig(config: VideoGenerationConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.enabled) {
    if (!config.comfyuiUrl) {
      errors.push("ComfyUI URL is required when Video Generation is enabled");
    }
    if (!config.llmApiKey) {
      errors.push("LLM API Key is required for prompt generation");
    }
    if (!config.llmModel) {
      errors.push("LLM Model is required");
    }
  }

  return { valid: errors.length === 0, errors };
}
