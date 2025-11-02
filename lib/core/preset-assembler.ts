import { PresetPrompt } from "@/lib/models/preset-model";
import { adaptText } from "@/lib/adapter/tagReplacer";
import { PromptLibrary, PromptKey } from "@/lib/prompts/preset-prompts";

export class PresetAssembler {
  // 波多野结衣的角色ID
  private static readonly YUI_HATANO_ID = "char_1762053255236_l24zgaof0";

  static assemblePrompts(
    prompts: PresetPrompt[],
    language: "zh" | "en" = "zh",
    fastModel: boolean,
    contextData: { username?: string; charName?: string; number?: number } = {},
    systemPresetType: PromptKey = "mirror_realm",
    characterId?: string, // 添加 characterId 参数
  ): { systemMessage: string; userMessage: string } {
    // 检测是否是波多野结衣,强制使用日语输出格式
    const isYuiHatano = characterId === PresetAssembler.YUI_HATANO_ID;
    const outputLanguage: "zh" | "en" | "ja" = isYuiHatano ? "ja" : language;

    if (isYuiHatano) {
      console.log("🇯🇵 [PresetAssembler] 检测到波多野结衣,强制使用日语提示词");
    }

    if (prompts.length === 0 || fastModel) {
      console.group("PresetAssembler", prompts.length, fastModel);
      return PresetAssembler._getDefaultFramework(language, outputLanguage, contextData, systemPresetType);
    }

    const orderedSystemIdentifiers = [
      "main",
      "worldInfoBefore",
      "charDescription",
      "charPersonality",
      "scenario",
      "worldInfoAfter",
    ];

    const orderedUserIdentifiers = [
      "dialogueExamples",
      "enhanceDefinitions",
      "jailbreak",
      "chatHistory",
      "userInput",
    ];

    const systemSectionContents: { [key: string]: string[] } = {};
    orderedSystemIdentifiers.forEach(id => systemSectionContents[id] = []);

    const userSectionContents: { [key: string]: string[] } = {};
    orderedUserIdentifiers.forEach(id => userSectionContents[id] = []);

    let currentSystemSection: string | null = null;
    let currentUserSection: string | null = null;

    for (const prompt of prompts) {
      if (prompt.enabled === false) continue;

      const isSystemSection = orderedSystemIdentifiers.includes(prompt.identifier);
      const isUserSection = orderedUserIdentifiers.includes(prompt.identifier);

      const formattedContent = PresetAssembler._formatPromptContent(prompt, language, contextData);

      if (isSystemSection) {
        currentSystemSection = prompt.identifier;
        currentUserSection = null;
        if (formattedContent) {
          systemSectionContents[currentSystemSection].push(formattedContent);
        }
      } else if (isUserSection) {
        currentUserSection = prompt.identifier;
        currentSystemSection = null;
        if (formattedContent) {
          userSectionContents[currentUserSection].push(formattedContent);
        }
      } else {
        if (currentSystemSection) {
          if (formattedContent) {
            systemSectionContents[currentSystemSection].push(formattedContent);
          }
        } else if (currentUserSection) {
          if (formattedContent) {
            userSectionContents[currentUserSection].push(formattedContent);
          }
        }
      }
    }

    let finalSystemMessageParts: string[] = [];
    for (const id of orderedSystemIdentifiers) {
      const sectionContent = systemSectionContents[id].filter(Boolean).join("\n\n");
      
      finalSystemMessageParts.push(`<${id}>`);

      if (sectionContent) {
        finalSystemMessageParts.push(sectionContent);
      } else if (id === "worldInfoBefore" || id === "worldInfoAfter") {
        finalSystemMessageParts.push(`{{${id}}}`);
      }
      finalSystemMessageParts.push(`</${id}>`);
    }

    let finalUserMessageParts: string[] = [];
    let hasUserInputSection = false;
    
    for (const id of orderedUserIdentifiers) {
      const sectionContent = userSectionContents[id].filter(Boolean).join("\n\n");
      
      finalUserMessageParts.push(`<${id}>`);

      if (sectionContent) {
        finalUserMessageParts.push(sectionContent);
        if (id === "userInput") {
          hasUserInputSection = true;
        }
      } else if (id === "chatHistory") {
        finalUserMessageParts.push(`{{${id}}}`);
      } else if (id === "userInput") {
        finalUserMessageParts.push(`{{${id}}}`);
        hasUserInputSection = true;
      }
      finalUserMessageParts.push(`</${id}>`);
    }

    if (!hasUserInputSection) {
      finalUserMessageParts.push("<userInput>");
      finalUserMessageParts.push("{{userInput}}");
      finalUserMessageParts.push("</userInput>");
    }
    
    // Add memory section after userInput
    finalUserMessageParts.push("");
    finalUserMessageParts.push("<memory>");
    finalUserMessageParts.push("{{memory}}");
    finalUserMessageParts.push("</memory>");

    finalUserMessageParts.push(PromptLibrary.get(systemPresetType, language, "structure"));
    finalUserMessageParts.push("");
    finalUserMessageParts.push("<outputFormat>");
    if (outputLanguage === "ja") {
      // 日语输出格式（专为波多野结衣等日本角色设计）
      finalUserMessageParts.push("【出力形式の要求】");
      finalUserMessageParts.push(`以下の形式に厳格に従って返信してください。返信内容は${contextData.number}文字程度を目安とし（適宜増減可）、日本語で出力してください。`);
      finalUserMessageParts.push("");
      finalUserMessageParts.push("【出力言語の要求】");
      finalUserMessageParts.push("必ず日本語で出力してください。セリフ、地の文、心理描写、すべて日本語で表現してください。中国語や英語は絶対に使用しないでください。");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("<output>");
      finalUserMessageParts.push("ここにキャラクターの会話、行動、心理描写などを含む主な応答内容を日本語で出力してください。");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("<next_prompts>");
      finalUserMessageParts.push("- [プレイヤーの現在の状態に基づいて重大な決断を下し、メインストーリーの進行またはサイドクエストの開始を引き起こす、三人称の叙述、15文字以内]");
      finalUserMessageParts.push("- [未知または新しい領域に誘導し、重要なアイテム/キャラクター/真実の出現を引き起こす、三人称の叙述、15文字以内]");
      finalUserMessageParts.push("- [重要な感情の選択や人間関係の変化を表現し、将来の方向性に影響を与える、三人称の叙述、15文字以内]");
      finalUserMessageParts.push("</next_prompts>");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("<events>");
      finalUserMessageParts.push("[核心イベント1、簡潔な記述] ——> [核心イベント2、簡潔な記述] ——> [核心イベント3、簡潔な記述] ——> [核心イベント4、簡潔な記述] ——> [...]");
      finalUserMessageParts.push("</events>");
      finalUserMessageParts.push("</output>");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("注意：上記のXMLタグ形式に厳格に従う必要があります。すべての内容はoutputタグ内に含める必要があります。");
      finalUserMessageParts.push("**重要：すべての出力を日本語で行ってください。**");
    } else if (outputLanguage === "zh") {
      finalUserMessageParts.push("【输出格式要求】");
      finalUserMessageParts.push(`请严格按照以下格式输出回复，回复内容建议控制在${contextData.number}字符左右（可适当增减），并使用中文输出。`);
      finalUserMessageParts.push("");
      finalUserMessageParts.push("<output>");
      finalUserMessageParts.push("在这里输出你的主要回应内容，包括角色的对话、行动、心理描述等。");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("<next_prompts>");
      finalUserMessageParts.push("- [根据玩家当前状态做出重大决断，引发主线推进或支线开启，第三方人称叙事，不超过15字]");
      finalUserMessageParts.push("- [引导进入未知或新领域，引发关键物品/人物/真相出现，第三方人称叙事，不超过15字]");
      finalUserMessageParts.push("- [表达重要情感抉择或人际关系变化，影响未来走向，第三方人称叙事，不超过15字]");
      finalUserMessageParts.push("</next_prompts>");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("<events>");
      finalUserMessageParts.push("[核心事件1，简洁陈述] ——> [核心事件2，简洁陈述] ——> [核心事件3，简洁陈述] ——> [核心事件4，简洁陈述] ——> [...]");
      finalUserMessageParts.push("</events>");
      finalUserMessageParts.push("</output>");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("注意：必须严格遵循上述XML标签格式，所有内容都必须包含在output标签内。");
    } else {
      finalUserMessageParts.push("【Output Format Requirements】");
      finalUserMessageParts.push(`Please strictly follow the format below for your response. The response length should be approximately ${contextData.number} characters (can be adjusted as needed), and output in English.`);
      finalUserMessageParts.push("");
      finalUserMessageParts.push("<output>");
      finalUserMessageParts.push("Output your main response content here, including character dialogue, actions, psychological descriptions, etc.");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("<next_prompts>");
      finalUserMessageParts.push("- [Make a major decision based on the player\'s current state, triggering main plot advancement or side-quest initiation, third-person narrative, within 15 words]");
      finalUserMessageParts.push("- [Guide into unknown or new areas, triggering the appearance of key items/characters/truths, third-person narrative, within 15 words]");
      finalUserMessageParts.push("- [Express important emotional choices or changes in interpersonal relationships, influencing future direction, third-person narrative, within 15 words]");
      finalUserMessageParts.push("</next_prompts>");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("<events>");
      finalUserMessageParts.push("[Core Event 1, concise statement] --> [Core Event 2, concise statement] --> [Core Event 3, concise statement] --> [Core Event 4, concise statement] --> [...]");
      finalUserMessageParts.push("</events>");
      finalUserMessageParts.push("</output>");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("Note: You must strictly adhere to the XML tag format above. All content must be contained within the output tag.");
    }
    finalUserMessageParts.push("</outputFormat>");

    return {
      systemMessage: finalSystemMessageParts.filter(Boolean).join("\n\n"),
      userMessage: finalUserMessageParts.filter(Boolean).join("\n\n"),
    };
  }

  private static _getDefaultFramework(
    language: "zh" | "en" = "zh",
    outputLanguage: "zh" | "en" | "ja" = "zh",
    contextData: { username?: string; charName?: string; number?: number },
    systemPresetType: PromptKey = "mirror_realm",
  ): { systemMessage: string; userMessage: string } {
    const orderedSystemIdentifiers = [
      "main",
      "worldInfoBefore",
      "charDescription",
      "charPersonality",
      "scenario",
      "worldInfoAfter",
    ];
  
    const orderedUserIdentifiers = [
      "dialogueExamples",
      "enhanceDefinitions",
      "jailbreak",
      "chatHistory",
      "userInput",
    ];
  
    let finalSystemMessageParts: string[] = [];
    for (const id of orderedSystemIdentifiers) {
      finalSystemMessageParts.push(`<${id}>`);

      if (id === "main") {
        finalSystemMessageParts.push(PromptLibrary.get(systemPresetType, language, "prompt"));
      } else if (id === "worldInfoBefore" || id === "worldInfoAfter") {
        finalSystemMessageParts.push(`{{${id}}}`);
      }
  
      finalSystemMessageParts.push(`</${id}>`);
    }
  
    let finalUserMessageParts: string[] = [];
    let hasUserInputSection = false;
  
    for (const id of orderedUserIdentifiers) {
      finalUserMessageParts.push(`<${id}>`);
      
      if (id === "enhanceDefinitions") {
        finalUserMessageParts.push(PromptLibrary.get(systemPresetType, language, "cot"));
        finalUserMessageParts.push("\n\n");
        finalUserMessageParts.push(PromptLibrary.get(systemPresetType, language, "structure"));
      } else if (id === "chatHistory" || id === "userInput") {
        finalUserMessageParts.push(`{{${id}}}`);
        if (id === "userInput") {
          hasUserInputSection = true;
        }
      }
  
      finalUserMessageParts.push(`</${id}>`);
    }
    if (!hasUserInputSection) {
      finalUserMessageParts.push("<userInput>");
      finalUserMessageParts.push("{{userInput}}");
      finalUserMessageParts.push("</userInput>");
    }
    
    // Add memory section after userInput
    finalUserMessageParts.push("");
    finalUserMessageParts.push("<memory>");
    finalUserMessageParts.push("{{memory}}");
    finalUserMessageParts.push("</memory>");
  
    finalUserMessageParts.push("");
    finalUserMessageParts.push("<outputFormat>");
    if (outputLanguage === "ja") {
      // 日语输出格式
      finalUserMessageParts.push("【出力形式の要求】");
      finalUserMessageParts.push(`以下の形式に厳格に従って返信してください。返信内容は${contextData.number}文字程度を目安とし（適宜増減可）`);
      finalUserMessageParts.push("");
      finalUserMessageParts.push("【出力言語の要求】");
      finalUserMessageParts.push("必ず日本語で出力してください。テキスト内容、ステータスバーの内容、すべて日本語で出力してください。以前に英語で出力していても、日本語で出力してください。");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("<output>");
      finalUserMessageParts.push("ここにキャラクターの会話、行動、心理描写などを含む主な応答内容を日本語で出力してください。");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("<next_prompts>");
      finalUserMessageParts.push("- [プレイヤーの現在の状態に基づいて重大な決断を下し、メインストーリーの進行またはサイドクエストの開始を引き起こす、三人称の叙述、15文字以内]");
      finalUserMessageParts.push("- [未知または新しい領域に誘導し、重要なアイテム/キャラクター/真実の出現を引き起こす、三人称の叙述、15文字以内]");
      finalUserMessageParts.push("- [重要な感情の選択や人間関係の変化を表現し、将来の方向性に影響を与える、三人称の叙述、15文字以内]");
      finalUserMessageParts.push("</next_prompts>");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("<events>");
      finalUserMessageParts.push("[核心イベント1、簡潔な記述] ——> [核心イベント2、簡潔な記述] ——> [核心イベント3、簡潔な記述] ——> [核心イベント4、簡潔な記述] ——> [...]");
      finalUserMessageParts.push("</events>");
      finalUserMessageParts.push("</output>");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("注意：上記のXMLタグ形式に厳格に従う必要があります。すべての内容はoutputタグ内に含める必要があります。");
      finalUserMessageParts.push("**重要：すべての出力を日本語で行ってください。**");
    } else if (outputLanguage === "zh") {
      finalUserMessageParts.push("【输出格式要求】");
      finalUserMessageParts.push(`请严格按照以下格式输出回复，回复内容建议控制在${contextData.number}字符左右（可适当增减）`);
      finalUserMessageParts.push("");
      finalUserMessageParts.push("【输出语言要求】");
      finalUserMessageParts.push("使用中文输出，文本内容、状态栏内容都使用中文输出,如果先前使用英文输出，也依然使用中文输出。");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("<output>");
      finalUserMessageParts.push("在这里输出你的主要回应内容，包括角色的对话、行动、心理描述等。");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("<next_prompts>");
      finalUserMessageParts.push("- [根据玩家当前状态做出重大决断，引发主线推进或支线开启，第三方人称叙事，不超过15字]");
      finalUserMessageParts.push("- [引导进入未知或新领域，引发关键物品/人物/真相出现，第三方人称叙事，不超过15字]");
      finalUserMessageParts.push("- [表达重要情感抉择或人际关系变化，影响未来走向，第三方人称叙事，不超过15字]");
      finalUserMessageParts.push("</next_prompts>");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("<events>");
      finalUserMessageParts.push("[核心事件1，简洁陈述] ——> [核心事件2，简洁陈述] ——> [核心事件3，简洁陈述] ——> [核心事件4，简洁陈述] ——> [...]");
      finalUserMessageParts.push("</events>");
      finalUserMessageParts.push("</output>");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("注意：必须严格遵循上述XML标签格式，所有内容都必须包含在output标签内。");
    } else {
      finalUserMessageParts.push("【Output Format Requirements】");
      finalUserMessageParts.push(`Please strictly follow the format below for your response. The response length should be approximately ${contextData.number} characters (can be adjusted as needed)`);
      finalUserMessageParts.push("");
      finalUserMessageParts.push("【Output Language Requirements】");
      finalUserMessageParts.push("Output in English, text content, status bar content, and previous English output should still be output in English.");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("<output>");
      finalUserMessageParts.push("Output your main response content here, including character dialogue, actions, psychological descriptions, etc.");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("<next_prompts>");
      finalUserMessageParts.push("- [Make a major decision based on the player\'s current state, triggering main plot advancement or side-quest initiation, third-person narrative, within 15 words]");
      finalUserMessageParts.push("- [Guide into unknown or new areas, triggering the appearance of key items/characters/truths, third-person narrative, within 15 words]");
      finalUserMessageParts.push("- [Express important emotional choices or changes in interpersonal relationships, influencing future direction, third-person narrative, within 15 words]");
      finalUserMessageParts.push("</next_prompts>");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("<events>");
      finalUserMessageParts.push("[Core Event 1, concise statement] --> [Core Event 2, concise statement] --> [Core Event 3, concise statement] --> [Core Event 4, concise statement] --> [...]");
      finalUserMessageParts.push("</events>");
      finalUserMessageParts.push("</output>");
      finalUserMessageParts.push("");
      finalUserMessageParts.push("Note: You must strictly adhere to the XML tag format above. All content must be contained within the output tag.");
    }
    finalUserMessageParts.push("</outputFormat>");
    return {
      systemMessage: finalSystemMessageParts.filter(Boolean).join("\n\n"),
      userMessage: finalUserMessageParts.filter(Boolean).join("\n\n"),
    };
  }

  private static _formatPromptContent(
    prompt: PresetPrompt,
    language: "zh" | "en",
    contextData: { username?: string; charName?: string; number?: number },
  ): string {
    let contentToAppend = "";

    const isAlwaysMarked = (prompt.identifier === "worldInfoBefore" || prompt.identifier === "worldInfoAfter" || prompt.identifier === "chatHistory" || prompt.identifier === "userInput" || prompt.identifier === "memory");

    if (isAlwaysMarked) {
      contentToAppend += `{{${prompt.identifier}}}`;
    }

    if (prompt.content) {
      let adaptedPromptContent = adaptText(
        prompt.content,
        language,
        contextData.username,
        contextData.charName,
      );
      if (prompt.name) {
        adaptedPromptContent = `【${prompt.name}】\n${adaptedPromptContent}`;
      }

      if (contentToAppend) {
        contentToAppend += `\n\n${adaptedPromptContent}`;
      } else {
        contentToAppend = adaptedPromptContent;
      }
    }
    return contentToAppend;
  }
} 
