/**
 * Scene Image Generation Hook
 *
 * This hook manages the state and logic for generating scene images from conversation context.
 * It integrates with the SceneImageService to:
 * - Generate image prompts using LLM
 * - Create image generation tasks
 * - Track generation progress
 * - Handle errors
 * - Cache generated images
 */

import { useState, useCallback, useRef } from "react";
import {
  SceneImageService,
  SceneImageConfig,
  SceneImageTaskResult,
} from "@/lib/api/scene-image-service";

export type SceneImageStatus = "idle" | "generating" | "completed" | "error";

interface Message {
  role: string;
  content: string;
}

interface Character {
  name?: string;
  description?: string;
  personality?: string;
}

export interface UseSceneImageReturn {
  status: SceneImageStatus;
  progress: number;
  error: string | null;
  imageUrl: string | null;
  generatedPrompt: string | null;
  generateSceneImage: (
    character: Character,
    messages: Message[],
    referenceImage?: string
  ) => Promise<void>;
  reset: () => void;
}

/**
 * Hook for managing scene image generation
 *
 * @param config Scene image configuration
 * @returns Scene image state and control functions
 */
export function useSceneImage(
  config: SceneImageConfig
): UseSceneImageReturn {
  const [status, setStatus] = useState<SceneImageStatus>("idle");
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);

  const serviceRef = useRef<SceneImageService | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize service
  const getService = useCallback(() => {
    if (!serviceRef.current) {
      serviceRef.current = new SceneImageService(config);
    }
    return serviceRef.current;
  }, [config]);

  /**
   * Generate scene image from conversation context
   *
   * @param character Character information
   * @param messages Recent conversation messages
   * @param referenceImage Optional reference image URL
   */
  const generateSceneImage = useCallback(
    async (
      character: Character,
      messages: Message[],
      referenceImage?: string
    ) => {
      // Reset state
      setStatus("generating");
      setProgress(0);
      setError(null);
      setImageUrl(null);
      setGeneratedPrompt(null);

      // Create abort controller
      abortControllerRef.current = new AbortController();

      try {
        const service = getService();

        // Validate input
        if (!messages || messages.length === 0) {
          throw new Error("No messages provided");
        }

        // Step 1: Generate prompt using LLM (0-30% progress)
        setProgress(5);

        // Get recent messages (last 3-5 messages, excluding the last one)
        const recentMessages = messages.slice(-5, -1);
        const lastMessage = messages[messages.length - 1];

        console.log("[useSceneImage] Generating prompt...");
        console.log("[useSceneImage] Recent messages:", recentMessages);
        console.log("[useSceneImage] Last message:", lastMessage);

        const prompt = await service.generatePrompt(
          character,
          recentMessages,
          lastMessage
        );

        console.log("[useSceneImage] Generated prompt:", prompt);
        setGeneratedPrompt(prompt);
        setProgress(30);

        // Check if aborted
        if (abortControllerRef.current?.signal.aborted) {
          console.log("[useSceneImage] Generation aborted");
          setStatus("idle");
          return;
        }

        // Step 2: Generate image (30-100% progress)
        console.log("[useSceneImage] Generating image...");
        const result: SceneImageTaskResult = await service.generateSceneImage(
          prompt,
          referenceImage,
          (imageProgress) => {
            // Map 30-100% progress
            const totalProgress = 30 + (imageProgress * 0.7);
            setProgress(totalProgress);
          }
        );

        // Check if aborted
        if (abortControllerRef.current?.signal.aborted) {
          console.log("[useSceneImage] Generation aborted");
          setStatus("idle");
          return;
        }

        // Handle result
        if (result.status === "completed" && result.imageUrl) {
          console.log("[useSceneImage] Image generated successfully:", result.imageUrl);
          setImageUrl(result.imageUrl);
          setProgress(100);
          setStatus("completed");
        } else if (result.status === "failed") {
          console.error("[useSceneImage] Image generation failed:", result.error);
          throw new Error(result.error || "Image generation failed");
        } else {
          throw new Error("Unexpected task result status");
        }
      } catch (err) {
        console.error("[useSceneImage] Error generating scene image:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(errorMessage);
        setStatus("error");
        setProgress(0);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [getService]
  );

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    // Abort ongoing generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setStatus("idle");
    setProgress(0);
    setError(null);
    setImageUrl(null);
    setGeneratedPrompt(null);
  }, []);

  return {
    status,
    progress,
    error,
    imageUrl,
    generatedPrompt,
    generateSceneImage,
    reset,
  };
}
