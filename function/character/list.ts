import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";
import { ServerCharacterOperations } from "@/lib/data/roleplay/server-character-operation";
import { adaptCharacterData } from "@/lib/adapter/tagReplacer";

// 环境变量控制是否使用服务器存储
const USE_SERVER_STORAGE = process.env.NEXT_PUBLIC_USE_SERVER_STORAGE === 'true';

export async function getAllCharacters(language: "en" | "zh", username?: string) {
  try {
    let serverCharacters = [];
    let localCharacters = [];

    // 尝试从服务器获取
    try {
      if (USE_SERVER_STORAGE || typeof window !== 'undefined') {
        serverCharacters = await ServerCharacterOperations.getAllCharacters();
        console.log('✅ 从服务器加载角色卡:', serverCharacters.length);
      }
    } catch (serverError) {
      console.warn('⚠️ 服务器加载失败:', serverError);
    }

    // 同时从浏览器获取
    try {
      localCharacters = await LocalCharacterRecordOperations.getAllCharacters();
      console.log('📱 从浏览器加载角色卡:', localCharacters.length);
    } catch (localError) {
      console.warn('⚠️ 浏览器加载失败:', localError);
    }

    // 合并两个数据源，去重（优先使用服务器的）
    const characterMap = new Map();

    // 先添加服务器的角色
    serverCharacters.forEach(char => {
      characterMap.set(char.id, char);
    });

    // 再添加浏览器的角色（如果ID不重复）
    localCharacters.forEach(char => {
      if (!characterMap.has(char.id)) {
        characterMap.set(char.id, char);
      }
    });

    const allCharacters = Array.from(characterMap.values());
    console.log('🎯 合并后总计:', allCharacters.length, '个角色卡');

    const formattedCharacters = [...allCharacters]
      .reverse()
      .map(character => {
        const characterData = {
          id: character.id,
          name: character.data.data?.name || character.data.name,
          description: character.data.data?.description || character.data.description,
          personality: character.data.data?.personality || character.data.personality,
          scenario: character.data.data?.scenario || character.data.scenario,
          first_mes: character.data.data?.first_mes || character.data.first_mes,
          mes_example: character.data.data?.mes_example || character.data.mes_example,
          creatorcomment: character.data.creatorcomment || character.data.data?.creator_notes,
          created_at: character.created_at,
          updated_at: character.updated_at,
          avatar_path: character.imagePath,
        };
        const processedData = adaptCharacterData(characterData, language, username);

        return processedData;
      });

    return formattedCharacters;
  } catch (error: any) {
    console.error("Failed to get characters:", error);
    throw new Error(`Failed to get characters: ${error.message}`);
  }
}
