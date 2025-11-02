# 故事推进系统完整说明

## 目录
1. [系统架构概览](#系统架构概览)
2. [故事推进流程详解](#故事推进流程详解)
3. [角色卡与世界书的作用](#角色卡与世界书的作用)
4. [如何创建新故事](#如何创建新故事)
5. [实战示例](#实战示例)

---

## 系统架构概览

### 核心组件

```
用户输入
  ↓
DialogueWorkflow（对话工作流）
  ↓
9个处理节点（Node Pipeline）
  ↓
角色回复输出
```

### 9个处理节点（按顺序执行）

```typescript
1. UserInputNode       → 接收用户输入
2. PluginMessageNode   → 插件消息预处理
3. PresetNode          → 加载系统预设
4. ContextNode         → 获取对话历史
5. WorldBookNode       → 注入世界书知识
6. LLMNode             → 调用大语言模型生成回复
7. RegexNode           → 正则表达式处理输出
8. PluginNode          → 插件后处理
9. OutputNode          → 输出最终结果
```

---

## 故事推进流程详解

### 第一步：用户输入处理

**文件位置**: `lib/nodeflow/UserInputNode/UserInputNode.ts`

```typescript
// 用户输入："我想去魔法学院看看"
const userInput = {
  characterId: "char_123",
  userInput: "我想去魔法学院看看",
  language: "zh",
  username: "玩家"
}
```

**作用**：
- 接收用户输入
- 传递角色ID、语言、用户名等配置
- 初始化整个工作流

---

### 第二步：加载系统预设（Preset）

**文件位置**: `lib/nodeflow/PresetNode/PresetNode.ts`

系统会加载预设的提示词模板，例如：

```
系统消息（System Message）:
你是一个擅长角色扮演的AI助手。你需要根据以下信息扮演角色：

角色名：{{charName}}
性格：{{personality}}
场景：{{scenario}}

{{worldInfoBefore}}  ← 世界书注入位置（position 0-1）

请严格按照角色设定进行对话，保持角色的性格和语气。

{{worldInfoAfter}}   ← 世界书注入位置（position 2）

---

用户消息（User Message）:
[对话历史]
{{userInput}}
```

**关键占位符**：
- `{{charName}}` - 角色名字
- `{{personality}}` - 性格描述
- `{{scenario}}` - 场景设定
- `{{worldInfoBefore}}` - 前置世界书内容
- `{{worldInfoAfter}}` - 后置世界书内容
- `{{userInput}}` - 用户输入

---

### 第三步：获取对话历史（Context）

**文件位置**: `lib/nodeflow/ContextNode/ContextNode.ts`

```typescript
// 系统会获取最近的对话历史（默认5轮）
const recentHistory = [
  { role: "user", content: "你好" },
  { role: "assistant", content: "你好呀~欢迎来到魔法世界！" },
  { role: "user", content: "这里是什么地方？" },
  { role: "assistant", content: "这里是艾泽拉斯大陆的魔法学院~" },
  // ... 最多保留5轮对话
];
```

**作用**：
- 保持对话连贯性
- 避免AI忘记之前说过的话
- 提供上下文给世界书触发系统

**可配置参数**：
- `contextWindow`: 对话轮数（默认5轮 = 10条消息）

---

### 第四步：世界书知识注入（WorldBook）

**文件位置**: `lib/nodeflow/WorldBookNode/WorldBookNode.ts`

这是**故事推进的核心机制**！

#### 触发流程

1. **关键词匹配**：
```typescript
// 用户说："我想去魔法学院看看"
// 系统会检查世界书中所有条目的 keys 字段

世界书条目1:
{
  keys: ["魔法学院", "学院", "魔法塔"],
  content: "魔法学院位于山顶，有三座高塔...",
  constant: false,  // 只在提到时触发
  position: 2
}

匹配成功！→ "魔法学院" 在用户输入中出现
```

2. **内容注入**：
```typescript
// 匹配的世界书内容会被格式化注入到 prompt 中
const formattedContent = `
<world information>
<tag>魔法学院设定</tag>
<content>
魔法学院位于山顶，有三座高塔分别代表火焰系、冰霜系、自然系...
</content>
</world information>
`;

// 根据 position 注入到不同位置
if (entry.position === 0 || entry.position === 1) {
  // 注入到 {{worldInfoBefore}}
}
if (entry.position === 2) {
  // 注入到 {{worldInfoAfter}}
}
```

#### Position 位置说明

| Position | 注入位置 | 用途 | 优先级 |
|----------|---------|------|--------|
| 0-1 | `{{worldInfoBefore}}` | 核心世界观、基础设定 | 最高 |
| 2 | `{{worldInfoAfter}}` | 场景描述、角色关系 | 高 |
| 3 | 用户消息前 | 当前情境提示 | 中 |
| 4 | 用户消息后 | 补充说明 | 低 |

#### Constant 常驻模式

```typescript
{
  content: "这是一个魔法世界，魔法需要咒语才能施展。",
  keys: ["魔法", "施法"],
  constant: true,  // 始终激活！
  position: 0
}
```

**注意**：`constant: true` 的条目会**始终注入**，不管用户是否提到关键词！

---

### 第五步：组装完整的 Prompt

**文件位置**: `lib/core/prompt-assembler.ts`

```typescript
// 最终发送给 LLM 的完整 Prompt

System Message:
你是一个擅长角色扮演的AI助手。你需要根据以下信息扮演角色：

角色名：艾莉娅
性格：活泼开朗，对魔法充满热情
场景：你是魔法学院的学生导游，正在带领新生参观

<world information>
<tag>世界观基础</tag>
<content>
这是一个魔法世界，魔法需要咒语才能施展。每个人天生具有不同的魔法亲和力。
</content>
</world information>

请严格按照角色设定进行对话，保持角色的性格和语气。

<world information>
<tag>魔法学院设定</tag>
<content>
魔法学院位于山顶，有三座高塔分别代表火焰系、冰霜系、自然系。学生会根据魔法亲和力被分配到不同学派。
</content>
</world information>

---

User Message:
[对话历史]
玩家: 你好
艾莉娅: 你好呀~欢迎来到魔法世界！
玩家: 这里是什么地方？
艾莉娅: 这里是艾泽拉斯大陆的魔法学院~

玩家: 我想去魔法学院看看
```

---

### 第六步：LLM 生成回复

**文件位置**: `lib/nodeflow/LLMNode/LLMNode.ts`

```typescript
// 调用 LLM API（OpenAI 兼容接口）
const response = await ChatOpenAI.invoke({
  model: "grok-4-fast",
  messages: [
    { role: "system", content: systemMessage },
    { role: "user", content: userMessage }
  ],
  temperature: 0.7,
  max_tokens: 4000
});

// AI 生成的回复示例
const aiResponse = `
好的~那我带你去参观一下吧！*兴奋地拉着你的手*

你看，前面那座红色的高塔就是火焰系的塔楼，里面的学生都很热情勇敢。中间那座蓝色的是冰霜系，学生们都很冷静理智。右边那座绿色的是自然系，学生们都很温和友善~

你想先去哪个塔楼看看呢？
`;
```

**作用**：
- 根据组装好的 Prompt 生成角色回复
- AI 会参考：角色设定 + 世界书知识 + 对话历史
- 保持角色性格和语气一致

---

### 第七步：正则表达式处理

**文件位置**: `lib/nodeflow/RegexNode/RegexNode.ts`

```typescript
// 支持特殊格式标记
<think>
我应该表现得活泼一点，符合艾莉娅的性格
</think>

<talk>
好的~那我带你去参观一下吧！*兴奋地拉着你的手*
</talk>

<event>
场景切换：来到魔法学院大门前
</event>
```

**作用**：
- 提取思考内容（`<think>`）
- 提取说话内容（`<talk>`）
- 提取事件触发（`<event>`）
- 提取建议输入（`<nextPrompts>`）

---

### 第八步：输出结果

**文件位置**: `lib/nodeflow/OutputNode/OutputNode.ts`

```typescript
// 最终输出到聊天界面
{
  thinkingContent: "我应该表现得活泼一点...",
  screenContent: "好的~那我带你去参观一下吧！*兴奋地拉着你的手*\n\n你看，前面那座红色的高塔就是火焰系的塔楼...",
  fullResponse: "完整回复内容",
  nextPrompts: ["去火焰系塔楼", "去冰霜系塔楼", "去自然系塔楼"],
  event: "场景切换：来到魔法学院大门前"
}
```

---

## 角色卡与世界书的作用

### 角色卡的作用

**定义角色的"灵魂"**：

```typescript
{
  name: "艾莉娅",
  personality: "活泼开朗，对魔法充满热情，喜欢帮助新生",
  scenario: "你是魔法学院的学生导游，正在带领新生参观",
  first_mes: "你好呀~欢迎来到魔法学院！我是艾莉娅，今天由我来带你参观~",
  description: "18岁，火焰系二年级学生，红色长发，总是笑容满面"
}
```

**作用**：
- **personality** → 决定AI的说话语气和行为方式
- **scenario** → 设定当前剧情背景
- **first_mes** → 第一句开场白，设定初始氛围
- **description** → 角色外貌和身份

### 世界书的作用

**定义整个故事世界的"规则"**：

```typescript
[
  {
    // 核心世界观（始终激活）
    content: "这是一个魔法世界，魔法需要咒语才能施展。",
    keys: ["魔法", "施法"],
    constant: true,
    position: 0
  },
  {
    // 地点描述（提到时触发）
    content: "魔法学院位于山顶，有三座高塔...",
    keys: ["魔法学院", "学院"],
    constant: false,
    position: 2
  },
  {
    // 角色关系（提到时触发）
    content: "艾莉娅是你的学姐，她非常热心...",
    keys: ["艾莉娅", "学姐"],
    constant: false,
    position: 2
  },
  {
    // 重要物品（提到时触发）
    content: "魔法水晶是施法的必需品，可以在商店购买...",
    keys: ["魔法水晶", "水晶"],
    constant: false,
    position: 2
  }
]
```

**作用**：
- **constant: true** → 核心设定，AI 始终知道
- **keys 触发** → 按需提供知识，避免 prompt 过长
- **position 分层** → 控制信息优先级

---

## 如何创建新故事

### 方法一：使用角色卡 PNG 文件（推荐）

#### 步骤1：准备角色卡文件

使用以下工具创建角色卡：
- [SillyTavern](https://github.com/SillyTavern/SillyTavern)
- [AI Character Editor](https://zoltanai.github.io/character-editor/)
- [Character Card Creator](https://character-card-creator.vercel.app/)

或者下载现成的：
- [Narratium 官方角色卡库](https://github.com/Narratium/Character-Card)
- [Chub.ai](https://www.chub.ai/)

#### 步骤2：导入角色卡

1. 访问 http://localhost:3000/character-cards
2. 点击"导入角色"按钮
3. 选择 PNG 文件上传
4. 系统自动解析角色信息和世界书

#### 步骤3：测试对话

1. 点击角色卡进入聊天界面
2. 发送测试消息
3. 观察AI回复是否符合预期

---

### 方法二：手动创建（完全自定义）

#### 第一步：设计角色基本信息

```typescript
// 角色设定模板
const characterData = {
  name: "你的角色名",

  // 性格描述（影响说话方式）
  personality: `
  - 性格特点1（如：活泼开朗）
  - 性格特点2（如：好奇心强）
  - 说话风格（如：经常使用"~"语气词）
  - 行为习惯（如：喜欢用动作描写）
  `,

  // 场景设定（当前剧情背景）
  scenario: `
  你是一名魔法学院的新生导游。
  今天是开学第一天，你需要带领新生参观校园。
  你对学院的一切都很熟悉，并且乐于助人。
  `,

  // 第一条消息（开场白）
  first_mes: "你好呀~欢迎来到魔法学院！我是艾莉娅，今天由我来带你参观~",

  // 角色描述（外貌和身份）
  description: `
  18岁女性，火焰系二年级学生
  红色长发，金色眼睛
  身高165cm，身材匀称
  总是穿着学院制服，佩戴火焰徽章
  `,

  // 对话示例（可选，用于引导AI说话风格）
  mes_example: `
  <START>
  {{user}}: 你好
  {{char}}: 你好呀~*微笑着挥手* 很高兴见到你！
  <START>
  {{user}}: 魔法学院是什么样的？
  {{char}}: 魔法学院超棒的！*眼睛闪闪发光* 这里有三个学派，每个都有自己的特色~
  `
};
```

#### 第二步：设计世界书

```typescript
// 世界书条目设计原则

[
  // 1. 核心世界观（constant: true，始终激活）
  {
    entry_id: "world_core",
    content: "这是一个魔法与科技并存的世界。魔法需要通过咒语和魔力才能施展，每个人天生具有不同的魔法亲和力。",
    keys: ["魔法", "世界", "咒语"],
    constant: true,  // ✅ 始终激活
    position: 0,     // ✅ 最高优先级
    enabled: true,
    comment: "世界观基础设定"
  },

  // 2. 重要地点（提到时触发）
  {
    entry_id: "location_academy",
    content: `
    魔法学院位于艾泽拉斯山脉顶端，由三座高塔组成：
    - 北塔（火焰系）：红色塔身，培养战斗型魔法师
    - 东塔（冰霜系）：蓝色塔身，培养学术型魔法师
    - 西塔（自然系）：绿色塔身，培养治疗型魔法师

    学院有5000名学生，200名教师，历史悠久。
    `,
    keys: ["魔法学院", "学院", "校园", "塔楼"],
    constant: false,  // ❌ 只在提到时触发
    position: 2,
    enabled: true,
    comment: "魔法学院地理描述"
  },

  // 3. 关键角色（提到时触发）
  {
    entry_id: "character_mentor",
    content: `
    梅林教授是魔法学院的院长，年龄超过300岁，是当代最强大的魔法师之一。
    他性格和蔼可亲，但在教学上非常严格。
    学生们既敬畏又尊敬他。
    `,
    keys: ["梅林", "院长", "教授"],
    constant: false,
    position: 2,
    enabled: true,
    comment: "院长角色设定"
  },

  // 4. 魔法系统规则（提到时触发）
  {
    entry_id: "magic_system",
    content: `
    魔法施放需要三个要素：
    1. 魔力储备：每个人的魔力上限不同，会随着修炼增长
    2. 咒语记忆：需要背诵并理解咒语的含义
    3. 情绪控制：失控的情绪会导致魔法暴走

    初学者最容易犯的错误就是情绪控制不当。
    `,
    keys: ["施法", "使用魔法", "魔法原理", "咒语"],
    constant: false,
    position: 2,
    enabled: true,
    comment: "魔法系统规则"
  },

  // 5. 重要物品（提到时触发）
  {
    entry_id: "item_crystal",
    content: `
    魔法水晶是辅助施法的道具，可以储存魔力。
    常见类型：
    - 初级水晶（白色）：储存100点魔力，价格50金币
    - 中级水晶（蓝色）：储存500点魔力，价格200金币
    - 高级水晶（紫色）：储存2000点魔力，价格1000金币

    可以在学院商店购买。
    `,
    keys: ["魔法水晶", "水晶", "魔力道具"],
    constant: false,
    position: 2,
    enabled: true,
    comment: "魔法水晶说明"
  },

  // 6. 重要事件（提到时触发）
  {
    entry_id: "event_tournament",
    content: `
    每年春季，学院会举办"三塔竞技大会"，三个学派的学生会进行魔法对决。
    获胜的学派可以获得"圣杯"，并在一年内享有优先使用图书馆禁书区的权利。
    这是学院最重要的年度盛事。
    `,
    keys: ["竞技大会", "三塔竞技", "比赛", "对决"],
    constant: false,
    position: 2,
    enabled: true,
    comment: "年度赛事"
  }
]
```

#### 第三步：创建 JSON 文件

创建完整的角色卡 JSON：

```json
{
  "spec": "chara_card_v2",
  "spec_version": "2.0",
  "data": {
    "name": "艾莉娅",
    "description": "18岁女性，火焰系二年级学生，红色长发，金色眼睛，身高165cm，总是穿着学院制服。",
    "personality": "活泼开朗，对魔法充满热情，喜欢帮助新生，说话时经常使用"~"语气词，喜欢用动作描写。",
    "first_mes": "你好呀~欢迎来到魔法学院！我是艾莉娅，今天由我来带你参观~*微笑着伸出手*",
    "scenario": "你是魔法学院的学生导游，正在带领新生参观校园。今天是开学第一天。",
    "mes_example": "<START>\n{{user}}: 你好\n{{char}}: 你好呀~*微笑着挥手* 很高兴见到你！\n<START>\n{{user}}: 魔法学院是什么样的？\n{{char}}: 魔法学院超棒的！*眼睛闪闪发光* 这里有三个学派，每个都有自己的特色~",
    "creator_notes": "活泼可爱的魔法学院导游，适合魔法奇幻类角色扮演。",
    "character_book": {
      "entries": [
        {
          "id": 0,
          "content": "这是一个魔法与科技并存的世界。魔法需要通过咒语和魔力才能施展，每个人天生具有不同的魔法亲和力。",
          "keys": ["魔法", "世界", "咒语"],
          "secondary_keys": [],
          "constant": true,
          "position": 0,
          "enabled": true,
          "comment": "世界观基础设定"
        },
        {
          "id": 1,
          "content": "魔法学院位于艾泽拉斯山脉顶端，由三座高塔组成：北塔（火焰系）、东塔（冰霜系）、西塔（自然系）。学院有5000名学生，200名教师。",
          "keys": ["魔法学院", "学院", "校园", "塔楼"],
          "secondary_keys": ["北塔", "东塔", "西塔"],
          "constant": false,
          "position": 2,
          "enabled": true,
          "comment": "魔法学院地理描述"
        }
      ]
    }
  }
}
```

#### 第四步：转换为 PNG 格式

使用在线工具将 JSON 嵌入到图片中：
1. 访问 [Character Card Creator](https://character-card-creator.vercel.app/)
2. 上传角色头像图片
3. 粘贴 JSON 数据
4. 下载生成的 PNG 文件

#### 第五步：导入并测试

1. 导入 PNG 文件到应用
2. 进入聊天界面
3. 测试不同的输入，观察世界书触发效果

---

## 实战示例

### 示例1：触发世界书的对话流程

**用户输入**："我想去魔法学院看看"

**系统处理流程**：

```
1. UserInputNode: 接收输入 "我想去魔法学院看看"
   ↓
2. PresetNode: 加载系统预设
   SystemMessage = "你是艾莉娅，魔法学院导游..."
   ↓
3. ContextNode: 获取对话历史（假设是第一次对话，历史为空）
   ↓
4. WorldBookNode: 检查关键词匹配
   - 检测到 "魔法学院" → 匹配到世界书条目！
   - 条目内容："魔法学院位于艾泽拉斯山脉顶端，由三座高塔组成..."
   - 注入到 SystemMessage 的 {{worldInfoAfter}} 位置
   ↓
5. 组装最终 Prompt:
   System: "你是艾莉娅，魔法学院导游...
           <world information>魔法学院位于艾泽拉斯山脉顶端...</world information>"
   User: "我想去魔法学院看看"
   ↓
6. LLMNode: 调用 API 生成回复
   AI回复: "好的~那我带你去参观吧！你看前面那三座高塔..."
   ↓
7. RegexNode: 处理输出格式
   ↓
8. OutputNode: 显示在聊天界面
```

**关键点**：
- AI 知道"三座高塔"的信息 → 来自世界书
- AI 保持艾莉娅的活泼语气 → 来自角色卡的 personality
- AI 扮演导游角色 → 来自角色卡的 scenario

---

### 示例2：多条世界书同时触发

**用户输入**："梅林教授会教我们如何施法吗？"

**关键词匹配**：
- "梅林" → 触发角色条目
- "施法" → 触发魔法系统条目

**注入内容**：
```
<world information>
<tag>角色设定</tag>
<content>
梅林教授是魔法学院的院长，年龄超过300岁，是当代最强大的魔法师之一...
</content>
</world information>

<world information>
<tag>魔法系统</tag>
<content>
魔法施放需要三个要素：魔力储备、咒语记忆、情绪控制...
</content>
</world information>
```

**AI回复**：
```
梅林教授确实会教授施法课程！*点点头*

他虽然年纪很大，但教学非常严格哦~他会教你魔法施放的三个要素：
魔力储备、咒语记忆和情绪控制。

不过据说他的课很难，很多学生都被他严厉批评过呢~*小声说*
但只要认真学习，肯定能学到很多东西的！
```

**效果**：
- AI 知道梅林教授的详细信息
- AI 知道魔法施放的具体要素
- AI 融合了两条世界书的知识进行回复

---

### 示例3：Constant 常驻条目的作用

**世界书设置**：
```typescript
{
  content: "魔法需要咒语才能施展，失控会导致危险。",
  keys: ["魔法"],
  constant: true,  // 始终激活
  position: 0
}
```

**即使用户没有提到"魔法"**：

用户："这里的建筑真漂亮"

AI回复："是的！学院的建筑都经过魔法加固，不仅美观还很安全~"

**原因**：
- AI 始终知道这是一个"魔法世界"
- 即使用户没提到魔法，AI也会自然地提到魔法相关内容
- 这让整个世界观更加一致

---

## 总结

### 故事推进的三大支柱

1. **角色卡（Character）**：
   - 定义"谁"在说话
   - 控制说话的"语气"和"风格"
   - 设定当前"剧情背景"

2. **世界书（WorldBook）**：
   - 定义"世界规则"
   - 提供"背景知识"
   - 触发式注入，避免 prompt 过长

3. **对话历史（Context）**：
   - 保持"连贯性"
   - 记住之前的"剧情发展"
   - 提供触发世界书的上下文

### 创建新故事的最佳实践

1. **先设计角色**：
   - 明确角色的性格特点
   - 写好开场白，设定初始氛围
   - 提供对话示例，引导AI说话风格

2. **再构建世界**：
   - 核心世界观设为 `constant: true`
   - 地点、角色、物品设为按需触发
   - 每条世界书内容不超过500字

3. **测试和优化**：
   - 发送不同类型的输入
   - 观察世界书触发效果
   - 根据AI回复调整设定

### 常见问题

**Q: 为什么AI没有提到世界书的内容？**
- 检查关键词是否匹配
- 确认 `enabled: true`
- 查看 `position` 设置是否合理

**Q: 为什么AI的回复很长？**
- 世界书内容可能过多
- 减少 `constant: true` 的条目
- 缩短单个条目的内容

**Q: 如何让AI记住剧情？**
- 使用世界书记录重要事件
- 关键剧情设为 `constant: true`
- 增加 `contextWindow` 保留更多历史

---

祝你创作愉快！✨
