# 角色卡导致网络错误的诊断指南

## 问题现象

**症状**：使用特定角色卡（如"魔法大陆"）时出现"请求失败 - 请检查网络连接或API配置"错误，但使用其他角色卡正常。

---

## 可能的原因

### 1. **Prompt 过长超出 Token 限制** ⭐ 最常见

不同的 LLM 模型有不同的 token 限制：

| 模型 | 输入 Token 上限 |
|------|----------------|
| GPT-3.5-turbo | 4,096 / 16,385 |
| GPT-4 | 8,192 / 32,768 |
| GPT-4-turbo | 128,000 |
| Claude 3 | 200,000 |
| Grok-4-fast | 131,072 |
| Llama 3 (8B) | 8,192 |

**如何计算 Token 数量：**
- 中文：约 1.5-2 个字符 = 1 token
- 英文：约 4 个字符 = 1 token
- 粗略估算：总字符数 / 2.5

**角色卡内容包括：**
1. **角色基本信息**：
   - personality (性格描述)
   - scenario (场景设定)
   - description (角色描述)
   - first_mes (首条消息)
   - mes_example (对话示例)

2. **世界书 (World Book)**：
   - 每个 entry 的 content 内容
   - 触发后会注入到 prompt 中
   - **多个条目同时触发会快速消耗 token**

3. **对话历史 (Chat History)**：
   - 默认保留最近 10 轮对话
   - 每轮包括用户消息 + 助手回复

4. **系统预设 (System Preset)**：
   - 系统提示词模板
   - 可能有数百到上千字符

**总 Prompt = 系统预设 + 角色信息 + 世界书 + 对话历史 + 当前输入**

---

### 2. **世界书条目触发过多**

世界书使用关键词触发机制，如果：
- 关键词过于宽泛（如"的", "是", "我"）
- 多个条目同时命中
- 单个条目内容过长（超过 1000 字符）

会导致 prompt 快速膨胀。

**示例问题配置：**
```json
{
  "keys": ["魔法", "法术", "施法", "咒语", "魔力"],
  "content": "（这里是 3000 字的详细魔法系统设定...）",
  "constant": true  // 始终激活！
}
```

如果有 5-10 个类似的 `constant: true` 条目，每个 2000-3000 字，就会导致：
- 世界书部分就占用 10,000-30,000 字符
- 约 4,000-12,000 tokens
- 几乎用完大部分模型的上限

---

### 3. **特殊字符导致解析错误**

某些特殊字符可能导致 API 调用失败：
- 未转义的引号：`"`, `'`
- 控制字符：`\x00`, `\x1F`
- 不完整的 Unicode 字符
- 过长的连续文本（无换行）

---

### 4. **JSON 格式错误**

角色卡数据可能存在：
- 嵌套层级过深
- 循环引用
- 无效的 JSON 结构

---

## 诊断步骤

### 步骤 1：检查角色卡数据

**在浏览器控制台（F12）运行以下脚本：**

```javascript
(async () => {
  const dbRequest = indexedDB.open('narratium-db', 1);

  dbRequest.onsuccess = (event) => {
    const db = event.target.result;
    const transaction = db.transaction(['character-records'], 'readonly');
    const objectStore = transaction.objectStore('character-records');
    const getAllRequest = objectStore.getAll();

    getAllRequest.onsuccess = () => {
      const characters = getAllRequest.result;
      console.log('=== 所有角色卡诊断 ===\n');

      characters.forEach((char, index) => {
        console.group(`角色 ${index + 1}: ${char.name}`);
        console.log('ID:', char.id);

        // 提取数据
        const data = char.parsedContent?.data || char;
        const personality = data.personality || '';
        const scenario = data.scenario || '';
        const firstMes = data.first_mes || '';
        const description = data.description || '';
        const mesExample = data.mes_example || '';

        // 计算长度
        console.log('\n📏 内容长度：');
        console.log('  性格描述:', personality.length, '字符');
        console.log('  场景设定:', scenario.length, '字符');
        console.log('  首条消息:', firstMes.length, '字符');
        console.log('  角色描述:', description.length, '字符');
        console.log('  对话示例:', mesExample.length, '字符');

        const baseContent = personality + scenario + firstMes + description + mesExample;
        console.log('  基础内容总计:', baseContent.length, '字符');

        // 检查世界书
        const worldBook = data.character_book?.entries || [];
        console.log('\n📚 世界书：');
        console.log('  条目数量:', worldBook.length);

        if (worldBook.length > 0) {
          let totalWorldBookLength = 0;
          let constantEntries = 0;
          let largeEntries = 0;

          worldBook.forEach((entry, idx) => {
            const content = entry.content || '';
            totalWorldBookLength += content.length;

            if (entry.constant) {
              constantEntries++;
              console.log(`  [始终激活] 条目 ${idx + 1}: ${content.length} 字符, keys:`, entry.keys);
            }

            if (content.length > 1000) {
              largeEntries++;
              console.warn(`  ⚠️ 条目 ${idx + 1} 过长: ${content.length} 字符`);
            }
          });

          console.log('  世界书总字数:', totalWorldBookLength);
          console.log('  始终激活条目:', constantEntries);
          console.log('  超长条目 (>1000字符):', largeEntries);

          // 计算最坏情况（所有条目都触发）
          const worstCase = baseContent.length + totalWorldBookLength;
          console.log('  最坏情况总字符:', worstCase);
        }

        // 估算 token
        const estimatedBaseTokens = Math.ceil(baseContent.length / 2.5);
        const estimatedWorldBookTokens = worldBook.reduce((sum, entry) =>
          sum + Math.ceil((entry.content || '').length / 2.5), 0
        );
        const estimatedTotalTokens = estimatedBaseTokens + estimatedWorldBookTokens;

        console.log('\n🔢 Token 估算：');
        console.log('  基础内容:', estimatedBaseTokens, 'tokens');
        console.log('  世界书（全部）:', estimatedWorldBookTokens, 'tokens');
        console.log('  总计:', estimatedTotalTokens, 'tokens');

        // 警告和建议
        console.log('\n💡 诊断结果：');
        if (estimatedTotalTokens > 8000) {
          console.error('  ❌ 严重: Token 数量过多，可能导致大部分模型失败！');
          console.log('  建议：');
          console.log('    1. 删除或缩短过长的世界书条目');
          console.log('    2. 将 constant: true 改为 false（按需触发）');
          console.log('    3. 使用更大上下文的模型（如 GPT-4-turbo, Claude 3）');
        } else if (estimatedTotalTokens > 4000) {
          console.warn('  ⚠️ 警告: Token 数量较多，可能在小模型上失败');
          console.log('  建议：使用 GPT-4 或更大的模型');
        } else {
          console.log('  ✅ 正常: Token 数量在合理范围内');
        }

        console.groupEnd();
        console.log('\n' + '='.repeat(60) + '\n');
      });
    };
  };

  dbRequest.onerror = () => {
    console.error('❌ 无法打开数据库');
  };
})();
```

### 步骤 2：查看实际发送的 Prompt

**在 `lib/nodeflow/LLMNode/LLMNodeTools.ts` 中添加调试日志：**

在第 72 行附近的 `invokeLLM` 方法中添加：

```typescript
static async invokeLLM(
  systemMessage: string,
  userMessage: string,
  config: LLMConfig,
): Promise<string> {
  try {
    // ====== 添加调试日志 ======
    console.group('🔍 LLM 调用诊断');
    console.log('System Message 长度:', systemMessage.length);
    console.log('User Message 长度:', userMessage.length);
    console.log('预估总 tokens:', Math.ceil((systemMessage.length + userMessage.length) / 2.5));
    console.log('\n--- System Message (前 500 字符) ---');
    console.log(systemMessage.substring(0, 500));
    console.log('\n--- User Message (前 500 字符) ---');
    console.log(userMessage.substring(0, 500));
    console.groupEnd();
    // ====== 调试日志结束 ======

    // ... 原有代码 ...
  }
}
```

### 步骤 3：检查 Network 请求

1. 打开开发者工具（F12）
2. 切换到 **Network** 标签
3. 发送消息给问题角色
4. 找到失败的请求（通常是红色的）
5. 查看：
   - **Payload** 标签：查看实际发送的数据大小
   - **Response** 标签：查看错误消息

**常见错误响应：**

```json
// Token 超限
{
  "error": {
    "message": "This model's maximum context length is 8192 tokens...",
    "type": "invalid_request_error",
    "code": "context_length_exceeded"
  }
}

// API Key 问题
{
  "error": {
    "message": "Incorrect API key provided",
    "type": "invalid_request_error"
  }
}

// 格式错误
{
  "error": {
    "message": "Invalid JSON in request",
    "type": "invalid_request_error"
  }
}
```

---

## 解决方案

### 解决方案 1：优化世界书 ⭐ 推荐

#### 1.1 缩短世界书条目

将过长的条目拆分成多个小条目：

**之前（不好）：**
```json
{
  "keys": ["魔法"],
  "content": "（3000 字的完整魔法系统设定...）",
  "constant": false
}
```

**之后（好）：**
```json
[
  {
    "keys": ["魔法", "施法"],
    "content": "魔法需要魔力和咒语才能施展。",
    "constant": true,
    "position": 0
  },
  {
    "keys": ["魔法学院", "学习魔法"],
    "content": "魔法学院位于北方山脉，分为火、冰、自然三个学派。",
    "constant": false,
    "position": 1
  },
  {
    "keys": ["禁忌魔法"],
    "content": "禁忌魔法包括死灵术、血祭、灵魂操控等。",
    "constant": false,
    "position": 2
  }
]
```

#### 1.2 关闭不必要的 constant 条目

只保留核心世界观为 `constant: true`：

```json
{
  "keys": ["世界", "背景"],
  "content": "故事发生在魔法大陆艾泽拉斯。",
  "constant": true  // ✅ 核心设定，始终激活
}

{
  "keys": ["特定地点", "某城市"],
  "content": "（详细地点描述）",
  "constant": false  // ✅ 只在提到时触发
}
```

#### 1.3 使用更精确的关键词

避免过于宽泛的关键词：

❌ **不好：**
```json
{
  "keys": ["的", "是", "了", "魔法"],  // "的"/"是" 太宽泛！
  "content": "..."
}
```

✅ **好：**
```json
{
  "keys": ["魔法学院", "魔法塔", "施法仪式"],  // 具体且明确
  "content": "..."
}
```

---

### 解决方案 2：减少对话历史

修改 `app/character/page.tsx` 中的 `memoryLength` 参数：

```typescript
// 在 handleSendMessage 函数中
const response = await handleCharacterChatRequest({
  username,
  characterId: character.id,
  message,
  modelName,
  baseUrl,
  apiKey,
  llmType,
  streaming: false,
  streamUsage: true,
  language: language as "zh" | "en",
  number: responseLength,
  nodeId,
  fastModel,
});
```

当前代码中，对话历史是在 `ContextNode` 中处理的，默认保留 10 轮。

**临时修改（调试用）：**

在 `lib/nodeflow/ContextNode/ContextNode.ts` 第 26 行：

```typescript
const memoryLength = input.memoryLength || 5; // 从 10 改为 5
```

---

### 解决方案 3：更换更大上下文的模型

修改 `.env` 文件：

```bash
# 使用更大上下文的模型
NEXT_PUBLIC_CHAT_LLM_MODEL=gpt-4-turbo-preview  # 128K tokens
# 或
NEXT_PUBLIC_CHAT_LLM_MODEL=claude-3-opus  # 200K tokens
```

---

### 解决方案 4：添加 Token 限制检查

在 `lib/nodeflow/WorldBookNode/WorldBookNodeTools.ts` 中添加保护逻辑：

```typescript
static async assemblePromptWithWorldBook(
  characterId: string,
  baseSystemMessage: string,
  userMessage: string,
  currentUserInput: string,
  language: "zh" | "en" = "zh",
  contextWindow: number = 5,
  username?: string,
  charName?: string,
): Promise<{ systemMessage: string; userMessage: string }> {
  try {
    // ... 原有代码 ...

    const result = promptAssembler.assemblePrompt(
      character.worldBook,
      baseSystemMessage,
      userMessage,
      chatHistory,
      currentUserInput,
      username,
      charName,
    );

    // ====== 添加 token 检查 ======
    const estimatedTokens = Math.ceil(
      (result.systemMessage.length + result.userMessage.length) / 2.5
    );

    console.log(`📊 预估 tokens: ${estimatedTokens}`);

    if (estimatedTokens > 7000) {
      console.warn(`⚠️ Token 数量过多 (${estimatedTokens})，可能导致请求失败`);

      // 可选：自动截断过长的内容
      if (estimatedTokens > 10000) {
        console.error('❌ Token 数量严重超标，自动截断世界书内容');
        // 返回不包含世界书的简化版本
        return {
          systemMessage: baseSystemMessage,
          userMessage: userMessage.replace('{{userInput}}', currentUserInput),
        };
      }
    }
    // ====== 检查结束 ======

    return result;
  } catch (error) {
    this.handleError(error as Error, "assemblePromptWithWorldBook");
  }
}
```

---

## 快速修复脚本

### 脚本 1：批量关闭 constant 条目

```javascript
// 在浏览器控制台运行
(async () => {
  const dbRequest = indexedDB.open('narratium-db', 1);

  dbRequest.onsuccess = async (event) => {
    const db = event.target.result;
    const transaction = db.transaction(['world-books'], 'readwrite');
    const objectStore = transaction.objectStore('world-books');
    const getAllRequest = objectStore.getAll();

    getAllRequest.onsuccess = () => {
      const worldBooks = getAllRequest.result;

      worldBooks.forEach(wb => {
        let modified = false;
        wb.entries.forEach(entry => {
          if (entry.constant) {
            entry.constant = false;
            modified = true;
          }
        });

        if (modified) {
          objectStore.put(wb);
          console.log(`✅ 已修改角色 ${wb.characterId} 的世界书`);
        }
      });
    };
  };
})();
```

### 脚本 2：删除超长世界书条目

```javascript
// 删除超过 2000 字符的世界书条目
(async () => {
  const dbRequest = indexedDB.open('narratium-db', 1);

  dbRequest.onsuccess = async (event) => {
    const db = event.target.result;
    const transaction = db.transaction(['world-books'], 'readwrite');
    const objectStore = transaction.objectStore('world-books');
    const getAllRequest = objectStore.getAll();

    getAllRequest.onsuccess = () => {
      const worldBooks = getAllRequest.result;

      worldBooks.forEach(wb => {
        const originalCount = wb.entries.length;
        wb.entries = wb.entries.filter(entry => {
          if ((entry.content || '').length > 2000) {
            console.warn(`删除超长条目 (${entry.content.length} 字符):`, entry.keys);
            return false;
          }
          return true;
        });

        if (wb.entries.length < originalCount) {
          objectStore.put(wb);
          console.log(`✅ 角色 ${wb.characterId}: 删除了 ${originalCount - wb.entries.length} 个超长条目`);
        }
      });
    };
  };
})();
```

---

## 预防措施

### 创建角色卡时的最佳实践

1. **控制基础内容长度**：
   - personality: < 500 字符
   - scenario: < 500 字符
   - first_mes: < 200 字符
   - description: < 300 字符

2. **世界书设计原则**：
   - 每个条目 < 1000 字符
   - 最多 3-5 个 `constant: true` 条目
   - 使用精确的关键词
   - 总条目数 < 20 个

3. **测试新角色卡**：
   - 先发送简单消息测试
   - 查看控制台的 token 估算
   - 逐步增加复杂度

---

## 总结

**最可能的原因排序：**

1. ⭐⭐⭐ 世界书条目过多或过长
2. ⭐⭐ 多个 `constant: true` 条目同时激活
3. ⭐ 对话历史 + 角色信息 + 世界书总和超过模型限制
4. ⭕ 特殊字符或 JSON 格式问题

**最有效的解决方案：**

1. 运行诊断脚本，定位具体问题
2. 优化世界书（缩短/关闭 constant/减少条目）
3. 更换更大上下文的模型
4. 添加 token 限制保护

**下一步建议：**

1. 在浏览器控制台运行步骤 1 的诊断脚本
2. 截图诊断结果发给我
3. 根据诊断结果选择对应的修复方案
