/**
 * Video Generation Hook
 *
 * This hook manages the state and lifecycle of scene video generation.
 * It integrates with ComfyUIVideoService to:
 * - Generate prompts using LLM
 * - Submit and monitor workflow execution
 * - Track progress and handle errors
 * - Provide clean state management for UI components
 *
 * Usage:
 * ```tsx
 * const videoGen = useVideoGeneration({
 *   llmConfig: {
 *     type: 'openai',
 *     baseUrl: 'https://api.openai.com',
 *     model: 'gpt-3.5-turbo',
 *     apiKey: 'sk-...',
 *   },
 * });
 *
 * // Generate video
 * await videoGen.generateVideo(character, messages, ttsText);
 *
 * // Monitor progress
 * console.log(videoGen.progress, videoGen.currentStep);
 *
 * // Cancel if needed
 * videoGen.cancelGeneration();
 * ```
 */

import { useState, useCallback, useRef } from "react";
import {
  ComfyUIVideoService,
  VideoConfig,
  VideoResult,
} from "@/lib/api/comfyui-video-service";

// ============================================================================
// Type Definitions
// ============================================================================

export type VideoStatus =
  | "idle"
  | "generating-prompts"
  | "generating-video"
  | "completed"
  | "error";

interface Message {
  role: string;
  content: string;
}

interface Character {
  name?: string;
  description?: string;
  personality?: string;
}

export interface UseVideoGenerationReturn {
  // Current state
  status: VideoStatus;
  progress: number; // 0-100
  currentStep: string;
  error: string | null;

  // Generation results
  videoUrl: string | null;
  imagePrompt: string | null;
  videoPrompt: string | null;

  // Control functions
  generateVideo: (
    character: Character,
    messages: Message[],
    ttsText: string,
  ) => Promise<void>;
  cancelGeneration: () => void;
  reset: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing scene video generation
 *
 * @param config - Video generation configuration
 * @returns Video generation state and control functions
 */
export function useVideoGeneration(
  config: VideoConfig,
): UseVideoGenerationReturn {
  // State management
  const [status, setStatus] = useState<VideoStatus>("idle");
  const [progress, setProgress] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string | null>(null);
  const [videoPrompt, setVideoPrompt] = useState<string | null>(null);

  // Service instance (persisted across renders)
  const serviceRef = useRef<ComfyUIVideoService | null>(null);
  const promptIdRef = useRef<string | null>(null);

  /**
   * Get or create service instance
   */
  const getService = useCallback(() => {
    if (!serviceRef.current || serviceRef.current !== serviceRef.current) {
      serviceRef.current = new ComfyUIVideoService(config);
    }
    return serviceRef.current;
  }, [config]);

  /**
   * Main generation function
   *
   * Orchestrates the entire video generation process:
   * 1. Generate prompts via LLM (0-5%)
   * 2. Build workflow JSON (5-10%)
   * 3. Submit to ComfyUI and monitor (10-98%)
   * 4. Poll for results (98-100%)
   */
  const generateVideo = useCallback(
    async (character: Character, messages: Message[], ttsText: string) => {
      console.log("=== Starting video generation ===");
      console.log("Character:", character.name);
      console.log("Messages:", messages.length);
      console.log("TTS text:", ttsText);

      // Reset state
      setStatus("generating-prompts");
      setProgress(0);
      setCurrentStep("正在准备...");
      setError(null);
      setVideoUrl(null);
      setImagePrompt(null);
      setVideoPrompt(null);
      promptIdRef.current = null;

      try {
        const service = getService();

        // Step 1: Generate prompts (0-5%)
        setCurrentStep("正在分析对话内容...");
        console.log("Step 1: Generating prompts...");

        const prompts = await service.generatePrompts(
          character,
          messages,
          ttsText,
        );

        setImagePrompt(prompts.imagePrompt);
        setVideoPrompt(prompts.videoPrompt);
        setProgress(5);

        console.log("Prompts generated:");
        console.log("- Image prompt:", prompts.imagePrompt);
        console.log("- Video prompt:", prompts.videoPrompt);

        // Step 2: Build workflow (5-10%)
        setCurrentStep("正在准备工作流...");
        console.log("Step 2: Building workflow...");

        const workflow = service.buildWorkflow(
          ttsText,
          prompts.imagePrompt,
          prompts.videoPrompt,
        );

        setProgress(10);
        console.log("Workflow built successfully");

        // Step 3: Submit workflow and monitor progress (10-98%)
        setStatus("generating-video");
        setCurrentStep("正在提交工作流...");
        console.log("Step 3: Submitting workflow...");

        const promptId = await service.submitWorkflow(workflow, (prog, step) => {
          setProgress(prog);
          setCurrentStep(step);
          console.log(`Progress: ${prog}% - ${step}`);
        });

        promptIdRef.current = promptId;
        console.log("Workflow submitted, prompt_id:", promptId);

        // Step 4: Poll for results (98-100%)
        setCurrentStep("正在获取视频...");
        setProgress(98);
        console.log("Step 4: Polling for results...");

        const result: VideoResult = await service.pollResult(promptId);

        console.log("Video generated successfully:", result.videoUrl);

        // Update final state
        setVideoUrl(result.videoUrl);
        setProgress(100);
        setStatus("completed");
        setCurrentStep("视频生成完成！");

        console.log("=== Video generation completed ===");
      } catch (err) {
        console.error("Video generation failed:", err);

        const errorMessage =
          err instanceof Error ? err.message : "视频生成失败";
        setError(errorMessage);
        setStatus("error");
        setCurrentStep("生成失败");

        console.log("=== Video generation failed ===");
      }
    },
    [config, getService],
  );

  /**
   * Cancel ongoing generation
   *
   * Note: This only stops monitoring on the client side.
   * The ComfyUI workflow will continue running on the server.
   */
  const cancelGeneration = useCallback(() => {
    console.log("Canceling video generation...");

    if (promptIdRef.current && serviceRef.current) {
      serviceRef.current.cancelGeneration(promptIdRef.current);
    }

    setStatus("idle");
    setProgress(0);
    setCurrentStep("");
    promptIdRef.current = null;
  }, []);

  /**
   * Reset all state to initial values
   */
  const reset = useCallback(() => {
    console.log("Resetting video generation state...");

    setStatus("idle");
    setProgress(0);
    setCurrentStep("");
    setError(null);
    setVideoUrl(null);
    setImagePrompt(null);
    setVideoPrompt(null);
    promptIdRef.current = null;
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
