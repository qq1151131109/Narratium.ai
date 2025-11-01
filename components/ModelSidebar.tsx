/**
 * Model Sidebar Component (Read-Only)
 *
 * This component displays the current LLM configuration from environment variables.
 * All configuration is done through .env file, not through UI.
 *
 * Key Features:
 * - Display current LLM type (OpenAI/Ollama)
 * - Display base URL (masked for security)
 * - Display current model name
 * - Display API key status (configured/not configured)
 * - Test model connection
 *
 * Configuration is read from environment variables via getChatLLMConfig()
 */

"use client";

import { useState, useEffect } from "react";
import "@/app/styles/fantasy-ui.css";
import { useLanguage } from "@/app/i18n";
import { trackButtonClick } from "@/utils/google-analytics";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import { getChatLLMConfig, validateChatLLMConfig } from "@/lib/config/features-config";

/**
 * Props interface for the ModelSidebar component
 * @property {boolean} isOpen - Controls the visibility of the sidebar
 * @property {() => void} toggleSidebar - Function to toggle the sidebar state
 */
interface ModelSidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

export default function ModelSidebar({ isOpen, toggleSidebar }: ModelSidebarProps) {
  const { t, fontClass, serifFontClass } = useLanguage();

  const [testModelSuccess, setTestModelSuccess] = useState(false);
  const [testModelError, setTestModelError] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [configErrors, setConfigErrors] = useState<string[]>([]);

  // Load configuration from environment variables
  const config = getChatLLMConfig();

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Validate configuration on mount
  useEffect(() => {
    const validation = validateChatLLMConfig(config);
    if (!validation.valid) {
      setConfigErrors(validation.errors);
      console.error("LLM Configuration validation failed:", validation.errors);
    } else {
      setConfigErrors([]);
    }
  }, []);

  /**
   * Mask sensitive URL information for display
   * @param {string} url - The URL to mask
   * @returns {string} Masked URL
   */
  const maskUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      // If not a valid URL, just return as is
      return url;
    }
  };

  /**
   * Tests the current model configuration using LangChain
   * Sends a test request to verify the configuration works
   */
  const handleTestModel = async () => {
    if (!config.baseUrl || !config.model) {
      setTestModelError(true);
      setTimeout(() => setTestModelError(false), 2000);
      return;
    }

    setIsTesting(true);
    setTestModelSuccess(false);
    setTestModelError(false);

    try {
      // For Ollama on Windows, ensure proper URL formatting
      let finalBaseUrl = config.baseUrl;
      if (config.type === "ollama") {
        // Handle Windows-specific URL issues
        if (finalBaseUrl === "localhost:11434" || finalBaseUrl === "11434") {
          finalBaseUrl = "http://localhost:11434";
        } else if (finalBaseUrl.startsWith("localhost:") && !finalBaseUrl.startsWith("http://")) {
          finalBaseUrl = "http://" + finalBaseUrl;
        } else if (!finalBaseUrl.startsWith("http://") && !finalBaseUrl.startsWith("https://")) {
          finalBaseUrl = "http://" + finalBaseUrl;
        }

        // Remove trailing slash if present
        if (finalBaseUrl.endsWith("/")) {
          finalBaseUrl = finalBaseUrl.slice(0, -1);
        }

        console.log(`Testing Ollama connection to: ${finalBaseUrl}`);
      }

      // Initialize the appropriate LangChain client based on LLM type
      const chatModel = config.type === "openai"
        ? new ChatOpenAI({
          modelName: config.model,
          openAIApiKey: config.apiKey,
          configuration: {
            baseURL: config.baseUrl,
          },
          timeout: 30000, // 30 second timeout
        })
        : new ChatOllama({
          baseUrl: finalBaseUrl,
          model: config.model,
          temperature: 0.1, // Lower temperature for more consistent test responses
        });

      // Send test message using LangChain with simpler format for better compatibility
      const testMessage = config.type === "ollama"
        ? "Hi"  // Very simple message for Ollama to avoid prompt issues
        : "Hello, this is a test message. Please respond with 'Test successful' if you can read this.";

      const messages = config.type === "ollama"
        ? [{ role: "user", content: testMessage }]
        : [
          { role: "system", content: "You are a helpful AI assistant." },
          { role: "user", content: testMessage },
        ];

      console.log(`Sending test message to ${config.type}:`, testMessage);

      const response = await chatModel.invoke(messages);
      const responseContent = response.content.toString().trim();

      console.log(`Received response from ${config.type}:`, responseContent);

      // More flexible response validation - just check if we got any meaningful response
      if (responseContent && responseContent.length > 0) {
        console.log("Model test successful. Response:", responseContent);
        setTestModelSuccess(true);
        setTimeout(() => setTestModelSuccess(false), 2000);
      } else {
        throw new Error("Empty or invalid response from model");
      }
    } catch (error) {
      console.error("Model test failed:", error);

      // Provide more specific error information for Ollama
      if (config.type === "ollama") {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("fetch failed")) {
          console.error("Ollama connection failed. Please ensure:");
          console.error("1. Ollama is running on Windows");
          console.error("2. The model is downloaded: ollama pull " + config.model);
          console.error("3. Try: ollama serve");
          console.error("4. Check if Windows Firewall is blocking the connection");
        } else if (errorMessage.includes("model") && errorMessage.includes("not found")) {
          console.error(`Model '${config.model}' not found. Please run: ollama pull ${config.model}`);
        } else if (errorMessage.includes("timeout")) {
          console.error("Request timeout. The model might be loading or the server is slow.");
        }
      }

      setTestModelError(true);
      setTimeout(() => setTestModelError(false), 2000);
    } finally {
      setIsTesting(false);
    }
  };

  // Mobile full-screen modal
  if (isMobile && isOpen) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm">
        <div className="relative w-full h-full bg-[#181818] breathing-bg text-[#d0d0d0] flex flex-col">
          {/* Header with close button */}
          <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-[#534741] bg-gradient-to-r from-[#1a1a1a] to-[#2a2a2a]">
            <h1 className={`text-lg magical-text ${serifFontClass}`}>{t("modelSettings.title")}</h1>
            <button
              onClick={() => {trackButtonClick("ModelSidebar", "关闭模型设置"); toggleSidebar();}}
              className="w-8 h-8 flex items-center justify-center text-[#f4e8c1] bg-[#1c1c1c] rounded-full border border-[#333333] shadow-inner transition-all duration-300 hover:bg-[#252525] hover:border-[#444444] hover:text-amber-400 hover:shadow-[0_0_8px_rgba(251,146,60,0.4)]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content with proper scrolling and padding */}
          <div className="flex-1 overflow-y-auto fantasy-scrollbar">
            <div className="p-4 pb-20">
              {/* Configuration Errors */}
              {configErrors.length > 0 && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
                  <div className="flex items-center mb-2">
                    <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-red-400 font-medium text-sm">配置错误</span>
                  </div>
                  <ul className="text-xs text-red-300 list-disc list-inside">
                    {configErrors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-[#8a8a8a] mt-2">
                    请在 .env 文件中配置 NEXT_PUBLIC_CHAT_LLM_* 环境变量
                  </p>
                </div>
              )}

              {/* Current Configuration Display */}
              <div className="border border-[#534741] rounded-md p-4 mb-4 bg-[#1c1c1c] bg-opacity-50 backdrop-blur-sm">
                <h2 className={`text-sm font-medium text-[#f4e8c1] mb-3 ${fontClass}`}>当前 LLM 配置</h2>

                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-[#8a8a8a]">类型:</span>
                    <span className="ml-2 text-sm text-[#f4e8c1]">{config.type === "openai" ? "OpenAI API" : "Ollama API"}</span>
                  </div>

                  <div>
                    <span className="text-sm text-[#8a8a8a]">API 地址:</span>
                    <span className="ml-2 text-sm text-[#f4e8c1] break-all">{maskUrl(config.baseUrl)}</span>
                  </div>

                  {config.type === "openai" && (
                    <div>
                      <span className="text-sm text-[#8a8a8a]">API Key:</span>
                      <span className="ml-2 text-sm text-[#f4e8c1]">
                        {config.apiKey ? "•".repeat(Math.min(10, config.apiKey.length)) : "未配置"}
                      </span>
                    </div>
                  )}

                  <div>
                    <span className="text-sm text-[#8a8a8a]">模型:</span>
                    <span className="ml-2 text-sm text-[#f4e8c1]">{config.model || "未配置"}</span>
                  </div>
                </div>
              </div>

              {/* Configuration Guide */}
              <div className="border border-[#534741]/50 rounded-md p-4 bg-[#2a261f]/30">
                <h3 className={`text-sm font-medium text-[#d1a35c] mb-2 ${fontClass}`}>配置说明</h3>
                <p className="text-xs text-[#8a8a8a] mb-2">
                  所有 LLM 配置现在通过 .env 文件进行，不再支持前端界面配置。
                </p>
                <p className="text-xs text-[#8a8a8a]">
                  如需修改配置，请编辑项目根目录的 .env 文件，然后重启开发服务器。
                </p>
                <p className="text-xs text-[#d1a35c] mt-2">
                  详细配置说明请查看: docs/ENV_CONFIGURATION_GUIDE.md
                </p>
              </div>

              {/* Test Model Button */}
              <div className="mt-4">
                <div className="relative">
                  <button
                    onClick={(e) => {trackButtonClick("ModelSidebar", "测试模型"); e.stopPropagation(); handleTestModel();}}
                    disabled={isTesting || !config.baseUrl || !config.model}
                    className={`bg-[#3e3a3a] hover:bg-[#534741] text-[#f4e8c1] font-normal py-3 px-4 text-sm rounded-md border border-[#d1a35c] w-full transition-all duration-200 hover:shadow-[0_0_8px_rgba(209,163,92,0.2)] ${fontClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isTesting ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-[#f4e8c1]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t("modelSettings.testing") || "测试中..."}
                      </span>
                    ) : (
                      t("modelSettings.testModel") || "测试模型"
                    )}
                  </button>

                  {testModelSuccess && (
                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-[#333333] bg-opacity-80 rounded transition-opacity backdrop-blur-sm">
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className={`text-white text-sm ${fontClass}`}>
                          {t("modelSettings.testSuccess") || "测试成功"}
                        </span>
                      </div>
                    </div>
                  )}

                  {testModelError && (
                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-[#333333] bg-opacity-80 rounded transition-opacity backdrop-blur-sm">
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        <span className={`text-white text-sm ${fontClass}`}>
                          {t("modelSettings.testError") || "测试失败"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop sidebar
  return (
    <div
      className={`h-full magic-border border-l border-[#534741] breathing-bg text-[#d0d0d0] transition-all duration-300 overflow-hidden ${isOpen ? "w-64" : "w-0"
      }`}
    >
      <div className={`w-64 h-full ${isOpen ? "opacity-100" : "opacity-0"} transition-opacity duration-300 overflow-y-auto fantasy-scrollbar`}>
        <div className="flex justify-between items-center p-3 border-b border-[#534741] bg-gradient-to-r from-[#1a1a1a] to-[#2a2a2a]">
          <h1 className={`text-base magical-text ${serifFontClass}`}>{t("modelSettings.title")}</h1>
          <button
            onClick={() => {trackButtonClick("ModelSidebar", "关闭模型设置"); toggleSidebar();}}
            className="w-6 h-6 flex items-center justify-center text-[#f4e8c1] bg-[#1c1c1c] rounded-md border border-[#333333] shadow-inner transition-all duration-300 hover:bg-[#252525] hover:border-[#444444] hover:text-amber-400 hover:shadow-[0_0_8px_rgba(251,146,60,0.4)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
        <div className="p-3">
          {/* Configuration Errors */}
          {configErrors.length > 0 && (
            <div className="mb-3 p-2 bg-red-900/20 border border-red-500/50 rounded-lg">
              <div className="flex items-center mb-1">
                <svg className="w-4 h-4 text-red-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-400 font-medium text-xs">配置错误</span>
              </div>
              <ul className="text-[10px] text-red-300 list-disc list-inside">
                {configErrors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
              <p className="text-[10px] text-[#8a8a8a] mt-1">
                请配置 .env 文件
              </p>
            </div>
          )}

          {/* Current Configuration Display */}
          <div className="border border-[#534741] rounded-md p-2.5 mb-3 bg-[#1c1c1c] bg-opacity-50 backdrop-blur-sm">
            <h2 className={`text-xs font-medium text-[#f4e8c1] mb-2 ${fontClass}`}>当前 LLM 配置</h2>

            <div className="space-y-1.5">
              <div>
                <span className="text-[10px] text-[#8a8a8a]">类型:</span>
                <span className="ml-2 text-[10px] text-[#f4e8c1]">{config.type === "openai" ? "OpenAI" : "Ollama"}</span>
              </div>

              <div>
                <span className="text-[10px] text-[#8a8a8a]">API 地址:</span>
                <span className="ml-2 text-[10px] text-[#f4e8c1] break-all">{maskUrl(config.baseUrl)}</span>
              </div>

              {config.type === "openai" && (
                <div>
                  <span className="text-[10px] text-[#8a8a8a]">API Key:</span>
                  <span className="ml-2 text-[10px] text-[#f4e8c1]">
                    {config.apiKey ? "•".repeat(Math.min(10, config.apiKey.length)) : "未配置"}
                  </span>
                </div>
              )}

              <div>
                <span className="text-[10px] text-[#8a8a8a]">模型:</span>
                <span className="ml-2 text-[10px] text-[#f4e8c1]">{config.model || "未配置"}</span>
              </div>
            </div>
          </div>

          {/* Configuration Guide */}
          <div className="border border-[#534741]/50 rounded-md p-2 mb-3 bg-[#2a261f]/30">
            <h3 className={`text-xs font-medium text-[#d1a35c] mb-1 ${fontClass}`}>配置说明</h3>
            <p className="text-[10px] text-[#8a8a8a] mb-1">
              LLM 配置通过 .env 文件进行。
            </p>
            <p className="text-[10px] text-[#8a8a8a]">
              修改后需重启服务器。
            </p>
            <p className="text-[10px] text-[#d1a35c] mt-1">
              查看: docs/ENV_CONFIGURATION_GUIDE.md
            </p>
          </div>

          {/* Test Model Button */}
          <div className="relative">
            <button
              onClick={(e) => {trackButtonClick("ModelSidebar", "测试模型"); e.stopPropagation(); handleTestModel();}}
              disabled={isTesting || !config.baseUrl || !config.model}
              className={`bg-[#3e3a3a] hover:bg-[#534741] text-[#f4e8c1] font-normal py-1.5 px-2 text-xs rounded-md border border-[#d1a35c] w-full transition-all duration-200 hover:shadow-[0_0_8px_rgba(209,163,92,0.2)] ${fontClass} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isTesting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-[#f4e8c1]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  测试中...
                </span>
              ) : (
                "测试模型"
              )}
            </button>

            {testModelSuccess && (
              <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-[#333333] bg-opacity-80 rounded transition-opacity backdrop-blur-sm">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className={`text-white text-xs ${fontClass}`}>测试成功</span>
                </div>
              </div>
            )}

            {testModelError && (
              <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-[#333333] bg-opacity-80 rounded transition-opacity backdrop-blur-sm">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span className={`text-white text-xs ${fontClass}`}>测试失败</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
