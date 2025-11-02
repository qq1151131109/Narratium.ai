import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { ParsedResponse } from "@/lib/models/parsed-response";
import { DialogueWorkflow, DialogueWorkflowParams } from "@/lib/workflow/examples/DialogueWorkflow";
import { getCurrentSystemPresetType } from "@/function/preset/download";

export async function handleCharacterChatRequest(payload: {
  username?: string;
  characterId: string;
  message: string;
  modelName: string;
  baseUrl: string;
  apiKey: string;
  llmType?: string;
  streaming?: boolean;
  language?: "zh" | "en";
  number?: number;
  nodeId: string;
  fastModel: boolean;
}): Promise<Response> {
  try {
    const {
      username,
      characterId,
      message,
      modelName,
      baseUrl,
      apiKey,
      llmType = "openai",
      language = "zh",
      number = 2000,
      nodeId,
      fastModel = false,
    } = payload;

    console.log(`📝 [Chat Handler] Received number: ${number}, will set maxTokens: ${Math.ceil(number * 2)}`);

    if (!characterId || !message) {
      return new Response(JSON.stringify({ error: "Missing required parameters" }), { status: 400 });
    }

    try {
      const workflow = new DialogueWorkflow();
      const workflowParams: DialogueWorkflowParams = {
        characterId,
        userInput: message,
        language,
        username,
        modelName,
        apiKey,
        baseUrl,
        llmType: llmType as "openai" | "ollama",
        temperature: 0.7,
        streaming: false,
        streamUsage: true, // 确保token usage追踪
        number,
        maxTokens: Math.ceil((number || 2000) * 2), // 设置max_tokens为字符数的2倍（中文约1字符=2tokens）
        fastModel,
        systemPresetType: getCurrentSystemPresetType(),
      };
      const workflowResult = await workflow.execute(workflowParams);
      
      if (!workflowResult || !workflowResult.outputData) {
        throw new Error("No response returned from workflow");
      }

      const {
        thinkingContent,
        screenContent,
        fullResponse,
        nextPrompts,
        event,
      } = workflowResult.outputData;

      await processPostResponseAsync({ characterId, message, thinkingContent, fullResponse, screenContent, event, nextPrompts, nodeId })
        .catch((e) => console.error("Post-processing error:", e));

      return new Response(JSON.stringify({
        type: "complete",
        success: true,
        thinkingContent,
        content: screenContent,
        parsedContent: { nextPrompts },
        isRegexProcessed: true,
      }), {
        headers: {
          "Content-Type": "application/json",
        },
      });

    } catch (error: any) {
      console.error("Processing error:", error);
      return new Response(JSON.stringify({
        type: "error",
        message: error.message || "Unknown error",
        success: false,
      }), { 
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

  } catch (error: any) {
    console.error("Fatal error:", error);
    return new Response(JSON.stringify({ error: `Failed to process request: ${error.message}`, success: false }), { 
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

async function processPostResponseAsync({
  characterId,
  message,
  thinkingContent,
  fullResponse,
  screenContent,
  event,
  nextPrompts,
  nodeId,
}: {
  characterId: string;
  message: string;
  thinkingContent: string;
  fullResponse: string;
  screenContent: string;
  event: string;
  nextPrompts: string[];
  nodeId: string;
}) {
  try {
    const parsed: ParsedResponse = {
      regexResult: screenContent,
      nextPrompts,
    };
    const dialogueTree = await LocalCharacterDialogueOperations.getDialogueTreeById(characterId);
    const parentNodeId = dialogueTree ? dialogueTree.current_nodeId : "root";
    await LocalCharacterDialogueOperations.addNodeToDialogueTree(
      characterId,
      parentNodeId,
      message,
      screenContent,
      fullResponse,
      thinkingContent,
      parsed,
      nodeId,
    );

    if (event) {
      const updatedDialogueTree = await LocalCharacterDialogueOperations.getDialogueTreeById(characterId);
      if (updatedDialogueTree) {
        await LocalCharacterDialogueOperations.updateNodeInDialogueTree(
          characterId,
          nodeId,
          {
            parsedContent: {
              ...parsed,
              compressedContent: event,
            },
          },
        );
      }
    }
  } catch (e) {
    console.error("Error in processPostResponseAsync:", e);
  }
}
