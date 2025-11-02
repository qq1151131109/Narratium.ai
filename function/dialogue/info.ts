import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";
import { ServerCharacterOperations } from "@/lib/data/roleplay/server-character-operation";
import { Character } from "@/lib/core/character";

export async function getCharacterDialogue(characterId: string, language: "en" | "zh" = "zh", username?: string) {
  if (!characterId) {
    throw new Error("Character ID is required");
  }

  try {
    // 先尝试从服务器加载角色数据
    let characterRecord;
    try {
      const serverCharacter = await ServerCharacterOperations.getCharacterById(characterId);
      if (serverCharacter) {
        characterRecord = serverCharacter;
        console.log('✅ 从服务器加载角色:', characterId, serverCharacter);
      }
    } catch (serverError) {
      console.warn('⚠️ 服务器加载角色失败，尝试从浏览器加载:', serverError);
    }

    // 如果服务器没有，从浏览器 IndexedDB 加载
    if (!characterRecord) {
      characterRecord = await LocalCharacterRecordOperations.getCharacterById(characterId);
      console.log('📱 从浏览器加载角色:', characterId);
    }

    if (!characterRecord) {
      throw new Error(`Character not found: ${characterId}`);
    }

    console.log('🔍 准备构造Character对象，数据:', {
      id: characterRecord.id,
      hasData: !!characterRecord.data,
      dataKeys: characterRecord.data ? Object.keys(characterRecord.data).slice(0, 5) : [],
      imagePath: characterRecord.imagePath
    });

    const character = new Character(characterRecord);
    console.log('✅ Character对象构造成功:', character.id, character.characterData.name);
    const dialogueTree = await LocalCharacterDialogueOperations.getDialogueTreeById(characterId);
    let processedDialogue = null;

    if (dialogueTree) {
      const currentPath = dialogueTree.current_nodeId !== "root"
        ? await LocalCharacterDialogueOperations.getDialoguePathToNode(characterId, dialogueTree.current_nodeId)
        : [];

      const messages = [];

      for (const node of currentPath) {
        if (node.userInput) {
          messages.push({
            id: node.nodeId,
            role: "user",
            thinkingContent: node.thinkingContent || "",
            content: node.userInput,
            parsedContent: null,
          });
        }

        if (node.assistantResponse) {
          if (node.parsedContent?.regexResult) {
            messages.push({
              id: node.nodeId,
              role: "assistant",
              thinkingContent: node.thinkingContent || "",
              content: node.parsedContent.regexResult,
              parsedContent: node.parsedContent,
            });
          }
          else {
            messages.push({
              id: node.nodeId,
              role: "assistant",
              thinkingContent: node.thinkingContent || "",
              content: node.assistantResponse,
              parsedContent: node.parsedContent,
            });
          }
        }
      }

      processedDialogue = {
        id: dialogueTree.id,
        character_id: dialogueTree.character_id,
        current_nodeId: dialogueTree.current_nodeId,
        messages,
        tree: {
          nodes: dialogueTree.nodes,
          currentNodeId: dialogueTree.current_nodeId,
        },
      };
    }

    return {
      success: true,
      character: {
        id: character.id,
        data: character.getData(language, username),
        imagePath: character.imagePath,
      },
      dialogue: processedDialogue,
    };
  } catch (error: any) {
    console.error("Failed to get character information:", error);
    throw new Error(`Failed to get character information: ${error.message}`);
  }
}
