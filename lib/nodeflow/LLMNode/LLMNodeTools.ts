import { NodeTool } from "@/lib/nodeflow/NodeTool";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnablePassthrough } from "@langchain/core/runnables";

// 为window对象添加lastTokenUsage属性的类型声明
declare global {
  interface Window {
    lastTokenUsage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  }
}

export interface LLMConfig {
  modelName: string;
  apiKey: string;
  baseUrl?: string;
  llmType: "openai" | "ollama";
  temperature?: number;
  maxTokens?:number;
  maxRetries?: number,
  topP?: number,
  frequencyPenalty?: number,
  presencePenalty?: number,
  topK?: number,
  repeatPenalty?: number,
  streaming?: boolean;
  streamUsage?: boolean;
  language?: "zh" | "en";
}
export class LLMNodeTools extends NodeTool {
  protected static readonly toolType: string = "llm";
  protected static readonly version: string = "1.0.0";

  static getToolType(): string {
    return this.toolType;
  }

  static async executeMethod(methodName: string, ...params: any[]): Promise<any> {
    const method = (this as any)[methodName];
    
    if (typeof method !== "function") {
      console.error(`Method lookup failed: ${methodName} not found in LLMNodeTools`);
      console.log("Available methods:", Object.getOwnPropertyNames(this).filter(name => 
        typeof (this as any)[name] === "function" && !name.startsWith("_"),
      ));
      throw new Error(`Method ${methodName} not found in ${this.getToolType()}Tool`);
    }

    try {
      this.logExecution(methodName, params);
      return await (method as Function).apply(this, params);
    } catch (error) {
      console.error(`Method execution failed: ${methodName}`, error);
      throw error;
    }
  }

  static async invokeLLM(
    systemMessage: string,
    userMessage: string,
    config: LLMConfig,
  ): Promise<string> {
    try {
      console.log("invokeLLM");
      console.log("🔧 [LLM Config] maxTokens:", config.maxTokens, "modelName:", config.modelName);

      // 为了获取真实的token usage，我们需要直接调用LLM而不是使用chain
      if (config.llmType === "openai") {
        const openaiLlm = this.createLLM(config) as ChatOpenAI;
        console.log("📤 [LLM] Invoking OpenAI with maxTokens:", config.maxTokens);
        
        // 直接调用LLM获取完整的AIMessage响应
        const aiMessage = await openaiLlm.invoke([
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage },
        ]);
        
        // 提取token usage信息
        let tokenUsage = null;
        if (aiMessage.usage_metadata) {
          tokenUsage = {
            prompt_tokens: aiMessage.usage_metadata.input_tokens,
            completion_tokens: aiMessage.usage_metadata.output_tokens,
            total_tokens: aiMessage.usage_metadata.total_tokens,
          };
        } else if (aiMessage.response_metadata?.tokenUsage) {
          // 兼容旧版本格式
          tokenUsage = aiMessage.response_metadata.tokenUsage;
        } else if (aiMessage.response_metadata?.usage) {
          // 兼容另一种格式
          tokenUsage = aiMessage.response_metadata.usage;
        }
        
        // 如果没有从响应中获取到token usage，尝试从流式响应中获取
        if (!tokenUsage && config.streaming && config.streamUsage) {
          console.log("📊 Token usage not found in response, this may be due to streaming mode");
        }
        
        // 将token usage信息存储到全局变量供插件使用
        if (tokenUsage) {
          if (typeof window !== "undefined") {
            window.lastTokenUsage = tokenUsage;
            console.log("📊 Token usage stored for plugins:", tokenUsage);
            
            // 触发自定义事件通知插件
            const event = new CustomEvent("llm-token-usage", {
              detail: { tokenUsage },
            });
            window.dispatchEvent(event);
          }
        }
        
        return aiMessage.content as string;
      } else {
        // 对于其他LLM类型，使用原来的chain方式
        const llm = this.createLLM(config);
        const dialogueChain = this.createDialogueChain(llm);
        const response = await dialogueChain.invoke({
          system_message: systemMessage,
          user_message: userMessage,
        });
        
        if (!response || typeof response !== "string") {
          throw new Error("Invalid response from LLM");
        }

        return response;
      }
    } catch (error) {
      this.handleError(error as Error, "invokeLLM");
    }
  }

  private static createLLM(config: LLMConfig): ChatOpenAI | ChatOllama {
    const safeModel = config.modelName?.trim() || "";
    const defaultSettings = {
      temperature: 0.7,
      maxTokens: 4000, // 默认4000 tokens，约2000字符
      timeout: 1000000000,
      maxRetries: 0,
      topP: 0.7,
      frequencyPenalty: 0,
      presencePenalty: 0,
      topK: 40,
      repeatPenalty: 1.1,
      streaming: false,
      streamUsage: true, // 默认启用token usage追踪
    };

    if (config.llmType === "openai") {
      return new ChatOpenAI({
        modelName: safeModel,
        openAIApiKey: config.apiKey,
        configuration: {
          baseURL: config.baseUrl?.trim() || undefined,
        },
        temperature: config.temperature ?? defaultSettings.temperature,
        maxTokens: config.maxTokens ?? defaultSettings.maxTokens,
        maxRetries: config.maxRetries ?? defaultSettings.maxRetries,
        topP: config.topP ?? defaultSettings.topP,
        frequencyPenalty: config.frequencyPenalty ?? defaultSettings.frequencyPenalty,
        presencePenalty: config.presencePenalty ?? defaultSettings.presencePenalty,
        streaming: config.streaming ?? defaultSettings.streaming,
        streamUsage: config.streamUsage ?? defaultSettings.streamUsage,
      });
    } else if (config.llmType === "ollama") {
      return new ChatOllama({
        model: safeModel,
        baseUrl: config.baseUrl?.trim() || "http://localhost:11434",
        temperature: config.temperature ?? defaultSettings.temperature,
        numPredict: config.maxTokens ?? defaultSettings.maxTokens,
        topK: config.topK ?? defaultSettings.topK,
        topP: config.topP ?? defaultSettings.topP,
        frequencyPenalty: config.frequencyPenalty ?? defaultSettings.frequencyPenalty,
        presencePenalty: config.presencePenalty ?? defaultSettings.presencePenalty,
        repeatPenalty: config.repeatPenalty ?? defaultSettings.repeatPenalty,
        streaming: config.streaming ?? defaultSettings.streaming,
      });
    } else {
      throw new Error(`Unsupported LLM type: ${config.llmType}`);
    }
  }

  private static createDialogueChain(llm: ChatOpenAI | ChatOllama): any {
    const dialoguePrompt = ChatPromptTemplate.fromMessages([
      ["system", "{system_message}"],
      ["human", "{user_message}"],
    ]);

    return RunnablePassthrough.assign({
      system_message: (input: any) => input.system_message,
      user_message: (input: any) => input.user_message,
    })
      .pipe(dialoguePrompt)
      .pipe(llm)
      .pipe(new StringOutputParser());
  }
} 
