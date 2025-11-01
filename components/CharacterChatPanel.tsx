/**
 * Character Chat Panel Component
 *
 * This component implements the main chat interface for character interactions, featuring:
 * - Real-time message display with HTML formatting
 * - Character avatar and name display
 * - Message regeneration and truncation capabilities
 * - Suggested input system
 * - Auto-scrolling chat history
 * - Fantasy-themed UI elements
 *
 * The component handles both user and character messages, with special formatting
 * and interactive features for each message type.
 *
 * Dependencies:
 * - ChatHtmlBubble: For rendering formatted chat messages
 * - CharacterAvatarBackground: For character avatar display
 * - Google Analytics: For tracking user interactions
 */

"use client";

import { useEffect, useRef, useState } from "react";
import ChatHtmlBubble from "@/components/ChatHtmlBubble";
import ThinkBubble from "@/components/ThinkBubble";
import { CharacterAvatarBackground } from "@/components/CharacterAvatarBackground";
import UserNameSettingModal from "@/components/UserNameSettingModal";
import { getDisplayUsername, setDisplayUsername } from "@/utils/username-helper";
import { trackButtonClick, trackFormSubmit } from "@/utils/google-analytics";
import { useTTS } from "@/hooks/useTTS";
import { TTSService } from "@/lib/api/tts-service";
import { useSceneImage } from "@/hooks/useSceneImage";
import { SceneImageConfig } from "@/lib/api/scene-image-service";
import { ComfyUIVideoService } from "@/lib/api/comfyui-video-service";
import { getTTSConfig, getSceneImageConfig, getVideoGenerationConfig, getChatLLMConfig } from "@/lib/config/features-config";

/**
 * Interface definitions for the component's data structures
 */
interface Character {
  id: string;
  name: string;
  description?: string;
  personality?: string;
  avatar_path?: string;
}

interface Message {
  id: string;
  role: string;
  thinkingContent?: string;
  content: string;
  timestamp?: string;
  isUser?: boolean;
  sceneImage?: {
    url: string;
    prompt: string;
    timestamp: number;
    characterRef?: string;
  };
  sceneVideo?: {
    url: string;
    imagePrompt: string;
    videoPrompt: string;
    ttsText: string;
    duration: number;
    timestamp: number;
    status: "generating" | "completed" | "failed";
  };
}

interface Props {
  character: Character;
  messages: Message[];
  userInput: string;
  setUserInput: (val: string) => void;
  isSending: boolean;
  suggestedInputs: string[];
  onSubmit: (e: React.FormEvent) => void;
  onSuggestedInput: (input: string) => void;
  onTruncate: (id: string) => void;
  onRegenerate: (id: string) => void;
  fontClass: string;
  serifFontClass: string;
  t: (key: string) => string;
  activeModes: Record<string, any>;
  setActiveModes: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}

/**
 * Main chat panel component that handles character interactions
 *
 * @param {Props} props - Component properties including character data, messages, and callbacks
 * @returns {JSX.Element} The complete chat interface with message history and input controls
 */
export default function CharacterChatPanel({
  character,
  messages,
  userInput,
  setUserInput,
  isSending,
  suggestedInputs,
  onSubmit,
  onSuggestedInput,
  onTruncate,
  onRegenerate,
  fontClass,
  serifFontClass,
  t,
  activeModes,
  setActiveModes,
}: Props) {
  const [streamingTarget, setStreamingTarget] = useState<number>(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Username setting states
  const [showUserNameModal, setShowUserNameModal] = useState(false);
  const [currentDisplayName, setCurrentDisplayName] = useState("");
  
  // Toggle buttons expansion state
  const [isButtonsExpanded, setIsButtonsExpanded] = useState(false);
  // Control panel expansion state
  const [isControlPanelExpanded, setIsControlPanelExpanded] = useState(false);

  // Load feature configurations from environment variables
  const ttsConfig = getTTSConfig();
  const sceneImageConfig = getSceneImageConfig();
  const videoGenConfig = getVideoGenerationConfig();
  const chatLLMConfig = getChatLLMConfig();

  // Scene image generation states for each message
  const [generatingImages, setGeneratingImages] = useState<Map<string, boolean>>(new Map());
  const [generatedImages, setGeneratedImages] = useState<Map<string, string>>(new Map());
  const [imageProgress, setImageProgress] = useState<Map<string, number>>(new Map());
  const [imageErrors, setImageErrors] = useState<Map<string, string>>(new Map());

  // Video generation states for each message
  const [generatingVideos, setGeneratingVideos] = useState<Map<string, boolean>>(new Map());
  const [generatedVideos, setGeneratedVideos] = useState<Map<string, string>>(new Map());
  const [videoProgress, setVideoProgress] = useState<Map<string, number>>(new Map());
  const [videoStatus, setVideoStatus] = useState<Map<string, string>>(new Map());
  const [videoErrors, setVideoErrors] = useState<Map<string, string>>(new Map());

  // Initialize TTS hook
  const tts = useTTS({
    apiKey: ttsConfig.apiKey,
    autoPlay: ttsConfig.autoPlay,
    workflowId: ttsConfig.workflowId,
  });

  // Initialize Scene Image hook
  const sceneImageHookConfig: SceneImageConfig = {
    apiKey: sceneImageConfig.apiKey,
    workflowId: sceneImageConfig.workflowId,
    llmConfig: sceneImageConfig.enabled ? {
      type: sceneImageConfig.llmType,
      baseUrl: sceneImageConfig.llmBaseUrl,
      model: sceneImageConfig.llmModel,
      apiKey: sceneImageConfig.llmApiKey,
    } : undefined,
  };
  const sceneImage = useSceneImage(sceneImageHookConfig);

  useEffect(() => {
    const savedStreaming = localStorage.getItem("streamingEnabled");
    if (savedStreaming !== null) {
      const isStreamingEnabled = savedStreaming === "true";
      if (isStreamingEnabled && messages.length > 0) {
        setActiveModes((prev) => ({
          ...prev,
          streaming: true,
        }));
        setStreamingTarget(messages.length);
      } else {
        setActiveModes((prev) => ({
          ...prev,
          streaming: false,
        }));
        setStreamingTarget(-1);
      }
    } else {
      // 默认开启流式传输
      setActiveModes((prev) => ({
        ...prev,
        streaming: true,
      }));
      localStorage.setItem("streamingEnabled", "true");
    }

    // Load display username using helper function
    setCurrentDisplayName(getDisplayUsername());
  }, []);

  // Auto-generate TTS for new assistant messages
  useEffect(() => {
    if (!ttsConfig.enabled || !ttsConfig.apiKey || messages.length === 0 || isSending) {
      return;
    }

    const lastMessage = messages[messages.length - 1];

    // Only auto-generate for assistant messages
    if (lastMessage.role === "assistant" && ttsConfig.autoPlay) {
      // Check if already generated or generating
      const state = tts.getState(lastMessage.id);
      if (state.isGenerating || state.isPlaying || tts.isCached(lastMessage.id)) {
        console.log("TTS: Skipping generation - already generated or in progress");
        return;
      }

      // Delay to ensure content is fully rendered
      const timer = setTimeout(() => {
        console.log("TTS: Auto-generating for message:", lastMessage.id);
        tts.generateAndPlay(lastMessage.id, lastMessage.content).catch((error) => {
          console.error("Auto TTS generation failed:", error);
        });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [messages, ttsConfig.enabled, ttsConfig.apiKey, ttsConfig.autoPlay, isSending, tts]);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  const maybeScrollToBottom = (threshold = 120) => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance < threshold) {
      scrollToBottom();
    }
  };

  const [suggestionsCollapsed, setSuggestionsCollapsed] = useState(false);

  const shouldShowRegenerateButton = (message: Message, index: number) => {
    if (isSending) return false;
    if (message.role !== "assistant") return false;
    if (index !== messages.length - 1) return false;

    return true;
  };

  // Handle scene image generation
  const handleGenerateSceneImage = async (messageId: string, messageIndex: number) => {
    if (!sceneImageConfig.enabled || !sceneImageConfig.apiKey || !sceneImageConfig.llmApiKey) {
      console.error("Scene image generation is not properly configured");
      return;
    }

    // Check if already generating
    if (generatingImages.get(messageId)) {
      console.log("Scene image already generating for message:", messageId);
      return;
    }

    // Mark as generating
    setGeneratingImages(new Map(generatingImages.set(messageId, true)));
    setImageProgress(new Map(imageProgress.set(messageId, 0)));
    setImageErrors(new Map(imageErrors.set(messageId, "")));

    try {
      // Get recent messages for context (last 3-5 messages before current)
      const recentMessages = messages
        .slice(Math.max(0, messageIndex - 4), messageIndex)
        .map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

      const currentMessage = {
        role: messages[messageIndex].role,
        content: messages[messageIndex].content,
      };

      // Generate scene image
      await sceneImage.generateSceneImage(
        {
          name: character.name,
          description: character.description,
          personality: character.personality,
        },
        recentMessages,
        undefined, // TODO: Add reference image support
      );

      // Check if generation succeeded
      if (sceneImage.status === "completed" && sceneImage.imageUrl) {
        setGeneratedImages(new Map(generatedImages.set(messageId, sceneImage.imageUrl)));
        console.log("Scene image generated successfully:", sceneImage.imageUrl);
      } else if (sceneImage.status === "error") {
        setImageErrors(new Map(imageErrors.set(messageId, sceneImage.error || "Generation failed")));
        console.error("Scene image generation failed:", sceneImage.error);
      }
    } catch (error) {
      console.error("Error generating scene image:", error);
      setImageErrors(new Map(imageErrors.set(messageId, error instanceof Error ? error.message : "Unknown error")));
    } finally {
      setGeneratingImages(new Map(generatingImages.set(messageId, false)));
    }
  };

  // Handle scene video generation
  const handleGenerateVideo = async (messageId: string, messageIndex: number) => {
    if (!videoGenConfig.enabled || !videoGenConfig.llmApiKey) {
      console.error("Video generation is not properly configured");
      return;
    }

    // Check if already generating
    if (generatingVideos.get(messageId)) {
      console.log("Video already generating for message:", messageId);
      return;
    }

    const message = messages[messageIndex];

    // Extract TTS text (highlighted/quoted text)
    const ttsService = new TTSService({ apiKey: "", workflowId: "" });
    const speeches = ttsService.extractSpeechContent(message.content);

    if (speeches.length === 0) {
      setVideoErrors(new Map(videoErrors.set(messageId, "未找到说话内容")));
      console.error("No speech content found in message");
      return;
    }

    const ttsText = speeches.join(" ");
    console.log("=== Starting video generation ===");
    console.log("Message ID:", messageId);
    console.log("TTS text:", ttsText);

    // Mark as generating
    setGeneratingVideos(new Map(generatingVideos.set(messageId, true)));
    setVideoProgress(new Map(videoProgress.set(messageId, 0)));
    setVideoStatus(new Map(videoStatus.set(messageId, "正在准备...")));
    setVideoErrors(new Map(videoErrors.set(messageId, "")));

    try {
      // Get recent messages for context (last 3-5 messages)
      const recentMessages = messages
        .slice(Math.max(0, messageIndex - 4), messageIndex + 1)
        .map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

      console.log("Recent messages:", recentMessages.length);

      // Create service instance
      const service = new ComfyUIVideoService({
        llmConfig: {
          type: videoGenConfig.llmType,
          baseUrl: videoGenConfig.llmBaseUrl,
          model: videoGenConfig.llmModel,
          apiKey: videoGenConfig.llmApiKey,
        },
      });

      // Step 1: Generate prompts
      setVideoStatus(new Map(videoStatus.set(messageId, "正在分析对话...")));
      console.log("Step 1: Generating prompts...");

      const prompts = await service.generatePrompts(
        {
          name: character.name,
          description: character.description,
          personality: character.personality,
        },
        recentMessages,
        ttsText,
      );

      console.log("Prompts generated:");
      console.log("- Image prompt:", prompts.imagePrompt);
      console.log("- Video prompt:", prompts.videoPrompt);

      setVideoProgress(new Map(videoProgress.set(messageId, 5)));

      // Step 2: Build workflow
      setVideoStatus(new Map(videoStatus.set(messageId, "正在准备工作流...")));
      console.log("Step 2: Building workflow...");

      const workflow = service.buildWorkflow(ttsText, prompts.imagePrompt, prompts.videoPrompt);
      setVideoProgress(new Map(videoProgress.set(messageId, 10)));

      // Step 3: Submit workflow
      setVideoStatus(new Map(videoStatus.set(messageId, "正在提交工作流...")));
      console.log("Step 3: Submitting workflow...");

      const promptId = await service.submitWorkflow(workflow, (progress, status) => {
        setVideoProgress(new Map(videoProgress.set(messageId, progress)));
        setVideoStatus(new Map(videoStatus.set(messageId, status)));
        console.log(`Progress: ${progress}% - ${status}`);
      });

      console.log("Workflow submitted, prompt_id:", promptId);

      // Step 4: Poll for results
      setVideoStatus(new Map(videoStatus.set(messageId, "正在获取视频...")));
      setVideoProgress(new Map(videoProgress.set(messageId, 98)));
      console.log("Step 4: Polling for results...");

      const result = await service.pollResult(promptId);

      console.log("Video generated successfully:", result.videoUrl);

      // Save result
      setGeneratedVideos(new Map(generatedVideos.set(messageId, result.videoUrl)));
      setVideoProgress(new Map(videoProgress.set(messageId, 100)));
      setVideoStatus(new Map(videoStatus.set(messageId, "视频生成完成！")));

      console.log("=== Video generation completed ===");
    } catch (error) {
      console.error("Video generation failed:", error);
      const errorMessage = error instanceof Error ? error.message : "视频生成失败";
      setVideoErrors(new Map(videoErrors.set(messageId, errorMessage)));
      setVideoStatus(new Map(videoStatus.set(messageId, "生成失败")));
      console.log("=== Video generation failed ===");
    } finally {
      setGeneratingVideos(new Map(generatingVideos.set(messageId, false)));
    }
  };

  // Username setting helper functions
  const handleUserNameSave = (newDisplayName: string) => {
    setCurrentDisplayName(newDisplayName);
    // Use helper function to set username, which also triggers the event
    setDisplayUsername(newDisplayName);
  };

  useEffect(() => {
    const id = setTimeout(() => scrollToBottom(), 300);
    return () => clearTimeout(id);
  }, [messages]);

  useEffect(() => {
    // On mount, restore fastModel state from localStorage
    const fastModelEnabled = localStorage.getItem("fastModelEnabled");
    if (fastModelEnabled !== null) {
      setActiveModes((prev) => ({
        ...prev,
        fastModel: fastModelEnabled === "true",
      }));
    } else {
      // 默认开启快速回复
      setActiveModes((prev) => ({
        ...prev,
        fastModel: true,
      }));
      localStorage.setItem("fastModelEnabled", "true");
    }
  }, []);

  return (
    <div className="flex flex-col h-full max-h-screen">
      <div
        className="flex-grow overflow-y-auto p-6 fantasy-scrollbar"
        ref={scrollRef}
      >
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 opacity-60">
                <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                    stroke="#f9c86d"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className={`text-[#c0a480] ${serifFontClass}`}>
                {t("characterChat.startConversation")}
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {messages.map((message, index) => {
                if (message.role === "sample") return null;

                return message.role === "user" ? (
                  <div key={index} className="flex justify-end mb-4">
                    <div className="max-w-md lg:max-w-2xl break-words whitespace-pre-line text-[#f4e8c1] story-text leading-relaxed magical-text">
                      <p
                        className={`${serifFontClass}`}
                        dangerouslySetInnerHTML={{
                          __html: (
                            message.content.match(
                              /<input_message>([\s\S]*?)<\/input_message>/,
                            )?.[1] || ""
                          ).replace(
                            /^[\s\n\r]*((<[^>]+>\s*)*)?(玩家输入指令|Player Input)[:：]\s*/i,
                            "",
                          ),
                        }}
                      ></p>
                    </div>
                  </div>
                ) : (
                  <div key={index} className="mb-6">
                    <div className="flex items-center mb-2">
                      <div className="w-8 h-8 rounded-full overflow-hidden mr-2">
                        {character.avatar_path ? (
                          <CharacterAvatarBackground
                            avatarPath={character.avatar_path}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#1a1816]">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4 text-[#534741]"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center">
                        <span
                          className={`text-sm font-medium text-[#f4e8c1] ${serifFontClass}`}
                        >
                          {character.name}
                        </span>
                        {message.role === "assistant" &&
                          shouldShowRegenerateButton(message, index) && (
                          <>
                            <button
                              onClick={() => {
                                setActiveModes((prev) => {
                                  const newStreaming = !prev.streaming;
                                  return { ...prev, streaming: newStreaming };
                                });
                                const newStreaming = !activeModes.streaming;
                                setStreamingTarget(
                                  newStreaming ? messages.length : -1,
                                );
                                localStorage.setItem(
                                  "streamingEnabled",
                                  String(newStreaming),
                                );
                                trackButtonClick(
                                  "toggle_streaming",
                                  "流式输出切换",
                                );
                              }}
                              className={`mx-1 w-6 h-6 flex items-center justify-center bg-[#1c1c1c] rounded-lg border shadow-inner transition-all duration-300 group relative ${
                                activeModes.streaming
                                  ? "text-amber-400 hover:text-amber-300 border-amber-400/60 hover:border-amber-300/70 hover:shadow-[0_0_8px_rgba(252,211,77,0.4)]"
                                  : "text-[#a18d6f] hover:text-[#c0a480] border-[#333333] hover:border-[#444444]"
                              }`}
                              data-tooltip={
                                activeModes.streaming
                                  ? t("characterChat.disableStreaming")
                                  : t("characterChat.enableStreaming")
                              }
                            >
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#2a261f] text-[#f4e8c1] text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap border border-[#534741]">
                                {activeModes.streaming
                                  ? t("characterChat.disableStreaming")
                                  : t("characterChat.enableStreaming")}
                              </div>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                {/* Stream/Flow icon - horizontal flowing lines */}
                                <path
                                  d="M3 6h18M3 12h18M3 18h18"
                                  stroke={
                                    activeModes.streaming
                                      ? "#FFC107"
                                      : "currentColor"
                                  }
                                  strokeLinecap="round"
                                  strokeDasharray={
                                    activeModes.streaming ? "4,2" : "none"
                                  }
                                >
                                  {activeModes.streaming && (
                                    <animate
                                      attributeName="stroke-dashoffset"
                                      values="0;6"
                                      dur="1s"
                                      repeatCount="indefinite"
                                    />
                                  )}
                                </path>
                              </svg>
                            </button>
                            <button
                              onClick={() => {
                                setActiveModes((prev) => {
                                  const newFastModel = !prev.fastModel;
                                  // Store fastModel state in localStorage
                                  localStorage.setItem(
                                    "fastModelEnabled",
                                    String(newFastModel),
                                  );
                                  return { ...prev, fastModel: newFastModel };
                                });
                                trackButtonClick(
                                  "toggle_fastmodel",
                                  "快速模式切换",
                                );
                              }}
                              className={`mx-1 w-6 h-6 flex items-center justify-center bg-[#1c1c1c] rounded-lg border shadow-inner transition-all duration-300 group relative ${
                                activeModes.fastModel
                                  ? "text-blue-500 hover:text-blue-400 border-blue-500/60 hover:border-blue-400/70 hover:shadow-[0_0_8px_rgba(59,130,246,0.4)]"
                                  : "text-[#a18d6f] hover:text-[#c0a480] border-[#333333] hover:border-[#444444]"
                              }`}
                              data-tooltip={
                                activeModes.fastModel
                                  ? t("characterChat.disableFastModel")
                                  : t("characterChat.enableFastModel")
                              }
                            >
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#2a261f] text-[#f4e8c1] text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap border border-[#534741]">
                                {activeModes.fastModel
                                  ? t("characterChat.disableFastModel")
                                  : t("characterChat.enableFastModel")}
                              </div>
                              {/* Lightning bolt SVG for fastmodel, blue when active - mirrored */}
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ transform: "scaleX(-1)" }}
                              >
                                <path
                                  d="M7 2L17 14h-7v8l-8-12h7z"
                                  fill={
                                    activeModes.fastModel ? "#3B82F6" : "none"
                                  }
                                  stroke={
                                    activeModes.fastModel
                                      ? "#3B82F6"
                                      : "currentColor"
                                  }
                                />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                      <div className="flex items-center">
                        <button
                          onClick={() => {
                            trackButtonClick("page", "跳转到此消息");
                            onTruncate(message.id);
                          }}
                          className="ml-1 w-6 h-6 flex items-center justify-center text-[#a18d6f] hover:text-green-400 bg-[#1c1c1c] rounded-lg border border-[#333333] shadow-inner transition-all duration-300 hover:border-[#444444] hover:shadow-[0_0_8px_rgba(34,197,94,0.4)] group relative"
                          data-tooltip={t("characterChat.jumpToMessage")}
                        >
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#2a261f] text-[#f4e8c1] text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap border border-[#534741]">
                            {t("characterChat.jumpToMessage")}
                          </div>
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
                            <path d="M12 19V5"></path>
                            <polyline points="5 12 12 5 19 12"></polyline>
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            trackButtonClick("page", "重新生成消息");
                            onRegenerate(message.id);
                          }}
                          className={`ml-1 w-6 h-6 flex items-center justify-center text-[#a18d6f] hover:text-orange-400 bg-[#1c1c1c] rounded-lg border border-[#333333] shadow-inner transition-all duration-300 hover:border-[#444444] hover:shadow-[0_0_8px_rgba(249,115,22,0.4)] group relative ${
                            shouldShowRegenerateButton(message, index)
                              ? ""
                              : "hidden"
                          }`}
                          data-tooltip={t("characterChat.regenerateMessage")}
                        >
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#2a261f] text-[#f4e8c1] text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap border border-[#534741]">
                            {t("characterChat.regenerateMessage")}
                          </div>
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
                            <polyline points="17 1 21 5 17 9"></polyline>
                            <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                            <polyline points="7 23 3 19 7 15"></polyline>
                            <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                          </svg>
                        </button>
                        {/* TTS Play Button - Show for assistant messages when TTS is enabled */}
                        {message.role === "assistant" && ttsConfig.enabled && ttsConfig.apiKey && (
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
                            data-tooltip={
                              tts.getState(message.id).isGenerating
                                ? "生成语音中..."
                                : tts.getState(message.id).isPlaying
                                  ? "停止播放"
                                  : tts.getState(message.id).error
                                    ? tts.getState(message.id).error
                                    : tts.isCached(message.id)
                                      ? "播放语音"
                                      : "生成并播放语音"
                            }
                          >
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
                            {tts.getState(message.id).isGenerating ? (
                              // Loading animation
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
                            ) : tts.getState(message.id).isPlaying ? (
                              // Stop icon
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <rect x="6" y="6" width="12" height="12" rx="1" />
                              </svg>
                            ) : (
                              // Play icon
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            )}
                          </button>
                        )}
                        {/* Scene Image Generation Button - Show for assistant messages when enabled */}
                        {message.role === "assistant" && sceneImageConfig.enabled && sceneImageConfig.apiKey && (
                          <button
                            onClick={() => {
                              handleGenerateSceneImage(message.id, index);
                              trackButtonClick("page", "生成场景图片");
                            }}
                            disabled={generatingImages.get(message.id) || false}
                            className={`ml-1 w-6 h-6 flex items-center justify-center bg-[#1c1c1c] rounded-lg border shadow-inner transition-all duration-300 group relative ${
                              generatedImages.has(message.id)
                                ? "text-purple-400 hover:text-purple-300 border-purple-400/60 hover:border-purple-300/70 hover:shadow-[0_0_8px_rgba(168,85,247,0.4)]"
                                : generatingImages.get(message.id)
                                  ? "text-[#8a8a8a] border-[#333333] cursor-not-allowed"
                                  : "text-[#a18d6f] hover:text-[#a78bfa] border-[#333333] hover:border-[#444444] hover:shadow-[0_0_8px_rgba(167,139,250,0.4)]"
                            }`}
                            data-tooltip={
                              generatingImages.get(message.id)
                                ? `生成场景图片中... ${Math.round(imageProgress.get(message.id) || 0)}%`
                                : imageErrors.get(message.id)
                                  ? imageErrors.get(message.id)
                                  : generatedImages.has(message.id)
                                    ? "重新生成场景图片"
                                    : "生成场景图片"
                            }
                          >
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#2a261f] text-[#f4e8c1] text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap border border-[#534741] pointer-events-none">
                              {generatingImages.get(message.id) ? (
                                `生成中... ${Math.round(imageProgress.get(message.id) || 0)}%`
                              ) : imageErrors.get(message.id) ? (
                                imageErrors.get(message.id)
                              ) : generatedImages.has(message.id) ? (
                                "重新生成场景图片"
                              ) : (
                                "生成场景图片"
                              )}
                            </div>
                            {generatingImages.get(message.id) ? (
                              // Loading animation
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
                            ) : (
                              // Image icon
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
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21 15 16 10 5 21"></polyline>
                              </svg>
                            )}
                          </button>
                        )}
                        {/* Scene Video Generation Button - Show for assistant messages when enabled */}
                        {message.role === "assistant" && videoGenConfig.enabled && videoGenConfig.llmApiKey && (
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
                                  {videoStatus.get(message.id) || "生成中..."}
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
                      </div>
                    </div>

                    {/* Think Bubble - Show thinking content if available */}
                    <ThinkBubble
                      thinkingContent={message.thinkingContent || ""}
                      characterName={character.name}
                      fontClass={fontClass}
                      serifFontClass={serifFontClass}
                      t={t}
                    />

                    <ChatHtmlBubble
                      key={message.id}
                      html={message.content}
                      isLoading={
                        isSending &&
                        index === messages.length - 1 &&
                        message.content.trim() === ""
                      }
                      enableStreaming={
                        activeModes.streaming &&
                        message.role === "assistant" &&
                        index >= streamingTarget
                      }
                      onContentChange={
                        index === messages.length - 1
                          ? () => maybeScrollToBottom()
                          : undefined
                      }
                    />

                    {/* Scene Image Display - Show generated image if available */}
                    {message.role === "assistant" && generatedImages.has(message.id) && (
                      <div className="mt-4 rounded-lg overflow-hidden border border-[#534741] bg-[#1e1a15] p-2">
                        <img
                          src={generatedImages.get(message.id)}
                          alt="Generated scene"
                          className="w-full h-auto rounded-md"
                          loading="lazy"
                          onError={(e) => {
                            console.error("Failed to load scene image");
                            // Remove from generated images if failed to load
                            const newMap = new Map(generatedImages);
                            newMap.delete(message.id);
                            setGeneratedImages(newMap);
                          }}
                        />
                      </div>
                    )}

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
                            setVideoErrors(new Map(videoErrors.set(message.id, "视频加载失败")));
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
                            {videoStatus.get(message.id) || "生成中..."}
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
                        <div className="mt-2 text-xs text-[#8a8a8a]">
                          ℹ️ 视频生成需要 30-90 秒，请耐心等待...
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {isSending && (
                <div className="flex items-center space-x-2 text-[#c0a480] mb-8 pb-4 pt-2 min-h-[40px]">
                  <div className="relative w-6 h-6 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-2 border-t-[#f9c86d] border-r-[#c0a480] border-b-[#a18d6f] border-l-transparent animate-spin"></div>
                    <div className="absolute inset-1 rounded-full border-2 border-t-[#a18d6f] border-r-[#f9c86d] border-b-[#c0a480] border-l-transparent animate-spin-slow"></div>
                  </div>
                  <span className={`text-sm ${serifFontClass}`}>
                    {character.name}{" "}
                    {t("characterChat.isTyping") || "is typing..."}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 bg-[#1a1816] border-t border-[#534741] pt-6 pb-6 px-5 z-5 mt-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.2)]">
        {suggestedInputs.length > 0 && !isSending && (
          <div className="relative max-w-4xl mx-auto">
            <button
              onClick={() => setSuggestionsCollapsed(!suggestionsCollapsed)}
              className="absolute -top-10 right-0 bg-[#2a261f] hover:bg-[#342f25] text-[#c0a480] hover:text-[#f4e8c1] p-1.5 rounded-md border border-[#534741] hover:border-[#a18d6f] transition-all duration-300 shadow-sm hover:shadow z-10"
              aria-label={suggestionsCollapsed ? "展开建议" : "收起建议"}
            >
              {suggestionsCollapsed ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>

            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden ${
                suggestionsCollapsed
                  ? "max-h-0 opacity-0 mb-0"
                  : "max-h-40 opacity-100 mb-6"
              }`}
            >
              <div className="flex flex-wrap gap-2.5">
                {suggestedInputs.map((input, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      trackButtonClick("page", "建议输入");
                      onSuggestedInput(input);
                    }}
                    disabled={isSending}
                    className={`bg-[#2a261f] hover:bg-[#342f25] text-[#c0a480] hover:text-[#f4e8c1] py-1.5 px-4 rounded-md text-xs border border-[#534741] hover:border-[#a18d6f] transition-all duration-300 shadow-sm hover:shadow menu-item ${
                      isSending ? "opacity-50 cursor-not-allowed" : ""
                    } ${fontClass}`}
                  >
                    {input}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <form
          onSubmit={(event) => {
            trackFormSubmit("page", "提交表单");
            onSubmit(event);
          }}
          className="max-w-4xl mx-auto"
        >
          <div className="flex gap-2 sm:gap-3">
            <div className="flex-grow magical-input relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-400/20 via-amber-500/5 to-amber-400/10 rounded-lg blur opacity-0 group-hover:opacity-100 transition duration-300"></div>
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={
                  t("characterChat.typeMessage") || "Type a message..."
                }
                data-tour="chat-input"
                className="w-full bg-[#2a261f] border border-[#534741] rounded-lg py-2 sm:py-2.5 px-3 sm:px-4 text-[#f4e8c1] text-sm leading-tight focus:outline-none focus:border-[#c0a480] shadow-inner relative z-1 transition-all duration-300 group-hover:border-[#a18d6f]"
                disabled={isSending}
              />
            </div>
            {isSending ? (
              <div className="relative w-8 h-8 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-t-[#f9c86d] border-r-[#c0a480] border-b-[#a18d6f] border-l-transparent animate-spin"></div>
                <div className="absolute inset-1 rounded-full border-2 border-t-[#a18d6f] border-r-[#f9c86d] border-b-[#c0a480] border-l-transparent animate-spin-slow"></div>
              </div>
            ) : (
              <button
                type="submit"
                disabled={!userInput.trim()}
                className={`portal-button relative overflow-hidden bg-[#2a261f] hover:bg-[#342f25] text-[#c0a480] hover:text-[#f4e8c1] py-2 px-3 sm:px-4 rounded-lg text-sm border border-[#534741] hover:border-[#a18d6f] shadow-md transition-all duration-300 ${
                  !userInput.trim() ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {t("characterChat.send") || "Send"}
              </button>
            )}
          </div>

          <div className="mt-3 sm:mt-5 flex justify-start gap-1.5 sm:gap-2 md:gap-3 max-w-4xl mx-auto relative">
            {/* Expandable Control Panel */}
            <div className="relative">
              {/* Expanded Control Buttons */}
              <div
                className={`absolute bottom-full left-0 mb-2 z-50 transition-all duration-300 ease-in-out ${
                  isControlPanelExpanded
                    ? "opacity-100 translate-y-0 pointer-events-auto"
                    : "opacity-0 translate-y-2 pointer-events-none"
                }`}
              >
                <div className="flex flex-col gap-2 bg-[#1a1a1a]/95 backdrop-blur-sm rounded-lg p-2 border border-[#534741]/50 shadow-lg">
                  {/* 剧情推进 */}
                  <button
                    type="button"
                    onClick={() => {
                      trackButtonClick("page", "切换故事进度");
                      setActiveModes((prev) => ({
                        ...prev,
                        "story-progress": !prev["story-progress"],
                      }));
                    }}
                    className={`px-1.5 sm:px-2 md:px-4 py-1.5 text-xs rounded-full border transition-all duration-300 whitespace-nowrap min-w-fit ${
                      activeModes["story-progress"]
                        ? "bg-[#d1a35c] text-[#2a261f] border-[#d1a35c] shadow-[0_0_8px_rgba(209,163,92,0.5)]"
                        : "bg-[#2a261f] text-[#d1a35c] border-[#534741] hover:border-[#d1a35c] shadow-sm hover:shadow-md"
                    }`}
                  >
                    <span className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mr-1 sm:mr-1"
                      >
                        <path d="M5 12h14"></path>
                        <path d="m12 5 7 7-7 7"></path>
                      </svg>
                      <span className="text-[10px] sm:text-xs">
                        {t("characterChat.storyProgress") || "剧情推进"}
                      </span>
                    </span>
                  </button>

                  {/* 视角设计 */}
                  <button
                    type="button"
                    onClick={() => {
                      trackButtonClick("page", "切换视角");
                      setActiveModes((prev) => {
                        const perspective = prev["perspective"];

                        if (!perspective.active) {
                          return {
                            ...prev,
                            perspective: {
                              active: true,
                              mode: "novel",
                            },
                          };
                        }

                        if (perspective.mode === "novel") {
                          return {
                            ...prev,
                            perspective: {
                              active: true,
                              mode: "protagonist",
                            },
                          };
                        }

                        return {
                          ...prev,
                          perspective: {
                            active: false,
                            mode: "novel",
                          },
                        };
                      });
                    }}
                    className={`px-1.5 sm:px-2 md:px-4 py-1.5 text-xs rounded-full border transition-all duration-300 whitespace-nowrap min-w-fit ${
                      !activeModes["perspective"].active
                        ? "bg-[#2a261f] text-[#56b3b4] border-[#534741] hover:border-[#56b3b4] shadow-sm hover:shadow-md"
                        : activeModes["perspective"].mode === "novel"
                          ? "bg-[#56b3b4] text-[#2a261f] border-[#56b3b4] shadow-[0_0_8px_rgba(86,179,180,0.5)]"
                          : "bg-[#378384] text-[#2a261f] border-[#378384] shadow-[0_0_8px_rgba(55,131,132,0.5)]"
                    }`}
                  >
                    <span className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mr-1 sm:mr-1"
                      >
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                      </svg>
                      <span className="text-[10px] sm:text-xs">
                        {!activeModes["perspective"].active
                          ? t("characterChat.perspective") || "视角设计"
                          : activeModes["perspective"].mode === "novel"
                            ? t("characterChat.novelPerspective") || "小说视角"
                            : t("characterChat.protagonistPerspective") || "主角视角"}
                      </span>
                    </span>
                  </button>

                  {/* 场景过渡 */}
                  <button
                    type="button"
                    onClick={() => {
                      trackButtonClick("page", "切换场景设置");
                      setActiveModes((prev) => ({
                        ...prev,
                        "scene-setting": !prev["scene-setting"],
                      }));
                    }}
                    className={`px-1.5 sm:px-2 md:px-4 py-1.5 text-xs rounded-full border transition-all duration-300 whitespace-nowrap min-w-fit ${
                      activeModes["scene-setting"]
                        ? "bg-[#c093ff] text-[#2a261f] border-[#c093ff] shadow-[0_0_8px_rgba(192,147,255,0.5)]"
                        : "bg-[#2a261f] text-[#c093ff] border-[#534741] hover:border-[#c093ff] shadow-sm hover:shadow-md"
                    }`}
                  >
                    <span className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mr-1 sm:mr-1"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="3" y1="9" x2="21" y2="9"></line>
                        <line x1="3" y1="15" x2="21" y2="15"></line>
                        <line x1="9" y1="3" x2="9" y2="21"></line>
                        <line x1="15" y1="3" x2="15" y2="21"></line>
                      </svg>
                      <span className="text-[10px] sm:text-xs">
                        {t("characterChat.sceneTransition")}
                      </span>
                    </span>
                  </button>

                  {/* 用户名称 */}
                  <button
                    type="button"
                    onClick={() => {
                      trackButtonClick("page", "设置用户名称");
                      setShowUserNameModal(true);
                    }}
                    className={"px-1.5 sm:px-2 md:px-4 py-1.5 text-xs rounded-full border transition-all duration-300 whitespace-nowrap min-w-fit bg-[#2a261f] text-[#f9c86d] border-[#534741] hover:border-[#f9c86d] shadow-sm hover:shadow-md"}
                  >
                    <span className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mr-1 sm:mr-1"
                      >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                      <span className="text-[10px] sm:text-xs">
                        {t("characterChat.userNameSetting")}
                      </span>
                    </span>
                  </button>
                </div>
              </div>

              {/* Main Control Button */}
              <button
                type="button"
                onClick={() => {
                  setIsControlPanelExpanded(!isControlPanelExpanded);
                  trackButtonClick("page", "切换控制面板");
                }}
                className={`px-1.5 sm:px-2 md:px-4 py-1.5 text-xs rounded-full border transition-all duration-300 ${
                  isControlPanelExpanded
                    ? "bg-[#d1a35c] text-[#2a261f] border-[#d1a35c] shadow-[0_0_8px_rgba(209,163,92,0.5)]"
                    : "bg-[#2a261f] text-[#d1a35c] border-[#534741] hover:border-[#d1a35c] shadow-sm hover:shadow-md"
                }`}
              >
                <span className="flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`mr-1 sm:mr-1 transition-transform duration-300 ${
                      isControlPanelExpanded ? "rotate-180" : ""
                    }`}
                  >
                    <path d="M18 15l-6-6-6 6"></path>
                  </svg>
                  <span className="text-[10px] sm:text-xs">
                    {isControlPanelExpanded ? "收起控制" : "展开控制"}
                  </span>
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Username Setting Modal */}
      <UserNameSettingModal
        isOpen={showUserNameModal}
        onClose={() => setShowUserNameModal(false)}
        currentDisplayName={currentDisplayName}
        onSave={handleUserNameSave}
      />
    </div>
  );
}
