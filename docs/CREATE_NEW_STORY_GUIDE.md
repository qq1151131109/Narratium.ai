# 创建新故事和角色指南

## 目录
1. [概念说明](#概念说明)
2. [角色卡详解](#角色卡详解)
3. [世界书详解](#世界书详解)
4. [创建新故事的步骤](#创建新故事的步骤)
5. [数据格式示例](#数据格式示例)

---

## 概念说明

### 角色卡 (Character Card)
角色卡是定义**单个虚拟角色**的基本信息文件，通常以 PNG 图片格式保存（元数据嵌入在图片中）。

**核心功能**：
- 定义角色的基本属性（姓名、性格、外貌等）
- 设置角色的初始对话
- 提供角色头像
- 配置角色的世界观背景

### 世界书 (World Book)
世界书是定义**整个故事世界观**的知识库系统。

**核心功能**：
- 触发式知识注入：当对话中出现特定关键词时，自动向 AI 提供相关背景信息
- 世界观设定：地理、历史、文化、规则等
- 多角色关系网络
- 场景描述和事件设定

---

## 角色卡详解

### 数据结构

```typescript
interface CharacterData {
  name: string;              // 角色名字
  description: string;       // 角色描述（外貌、特征等）
  personality: string;       // 性格描述
  first_mes: string;        // 第一条消息（开场白）
  scenario: string;         // 场景设定
  mes_example: string;      // 对话示例
  creatorcomment: string;   // 创作者备注
  avatar: string;           // 头像（base64 或路径）
  alternate_greetings: string[];  // 替代开场白
}
```

### 字段说明

| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `name` | ✅ | 角色名字 | "小雪" |
| `description` | ✅ | 外貌、身份等 | "20岁女大学生，长发飘飘，性格温柔" |
| `personality` | ✅ | 性格特点 | "温柔体贴，喜欢撒娇，偶尔会害羞" |
| `first_mes` | ✅ | 开场白 | "你好呀~今天想和我聊些什么呢？" |
| `scenario` | ⭕ | 故事背景 | "你们是大学同学，经常一起学习" |
| `mes_example` | ⭕ | 对话范例 | 用于引导 AI 的说话风格 |
| `creatorcomment` | ⭕ | 创作说明 | "适合日常对话场景" |
| `alternate_greetings` | ⭕ | 其他开场白 | 提供多种开场选择 |

---

## 世界书详解

### 数据结构

```typescript
interface WorldBookEntry {
  entry_id?: string;         // 条目唯一标识
  content: string;           // 知识内容
  keys: string[];           // 触发关键词（主要）
  secondary_keys?: string[]; // 次要触发词
  selective: boolean;        // 是否选择性触发
  constant: boolean;        // 是否始终激活
  position: string | number; // 注入位置
  enabled?: boolean;        // 是否启用
  use_regex?: boolean;      // 是否使用正则匹配
  comment?: string;         // 备注说明
}
```

### 触发机制

世界书采用**关键词触发**机制：

1. **触发条件**：对话中出现 `keys` 或 `secondary_keys` 中的关键词
2. **内容注入**：自动将 `content` 注入到 AI 的上下文中
3. **常驻模式**：设置 `constant: true` 可使该条目始终激活

### 应用场景

| 场景 | keys | content | constant |
|------|------|---------|----------|
| 地点描述 | `["咖啡厅", "cafe"]` | "这是一家温馨的咖啡厅，经常播放轻音乐..." | false |
| 角色关系 | `["小明"]` | "小明是你的好朋友，你们认识三年了..." | false |
| 世界规则 | `["魔法", "咒语"]` | "在这个世界，魔法需要咒语才能施展..." | false |
| 背景设定 | - | "故事发生在2024年的东京..." | true |

---

## 创建新故事的步骤

### 方法一：使用现有工具导入（推荐）

#### 步骤 1：准备角色卡 PNG 文件

使用以下工具之一创建角色卡：
- [SillyTavern](https://github.com/SillyTavern/SillyTavern)
- [AI Character Editor](https://zoltanai.github.io/character-editor/)
- [Character Card Creator](https://character-card-creator.vercel.app/)

或者从这些地方下载现成的角色卡：
- [Narratium 官方角色卡库](https://github.com/Narratium/Character-Card)
- [Chub.ai](https://www.chub.ai/)
- [Pygmalion Booru](https://booru.plus/+pygmalion)

#### 步骤 2：在应用中导入

1. 访问 `/character-cards` 页面
2. 点击"导入角色"按钮
3. 选择 PNG 文件上传
4. 系统会自动解析：
   - 角色基本信息
   - 世界书（如果包含）
   - 正则脚本（如果包含）

### 方法二：手动创建（高级）

#### 步骤 1：创建角色基本信息

在应用中使用"编辑角色"功能填写：
- 名字
- 性格
- 场景
- 第一条消息
- 创作者备注
- 上传头像

#### 步骤 2：添加世界书（可选）

通过数据库操作添加世界书条目：

```typescript
// 示例：添加世界书条目
import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";

await WorldBookOperations.updateWorldBook("角色ID", [
  {
    content: "这是一个魔法世界，人们可以通过念咒语施展魔法。",
    keys: ["魔法", "咒语", "施法"],
    secondary_keys: ["魔力", "法术"],
    selective: false,
    constant: true,
    position: 0,
    enabled: true,
    comment: "世界观基础设定"
  },
  {
    content: "学院位于山顶，有三座塔楼分别代表不同的魔法系别。",
    keys: ["学院", "魔法学院", "塔楼"],
    selective: false,
    constant: false,
    position: 1,
    enabled: true,
    comment: "学院地理描述"
  }
]);
```

#### 步骤 3：测试对话

进入角色聊天界面测试：
1. 触发不同的世界书关键词
2. 观察 AI 是否正确使用背景信息
3. 调整性格描述和世界书内容

---

## 数据格式示例

### 完整角色卡 JSON 示例

```json
{
  "spec": "chara_card_v2",
  "spec_version": "2.0",
  "data": {
    "name": "小雪",
    "description": "20岁的女大学生，有着齐肩的黑色长发和温柔的笑容。身高165cm，喜欢穿淡色连衣裙。",
    "personality": "温柔体贴，善解人意。偶尔会撒娇，遇到喜欢的人会害羞。喜欢浪漫的事物，对感情很认真。",
    "first_mes": "你好呀~今天天气真好，要不要一起去校园里散散步？*微笑着看向你*",
    "scenario": "你们是同一所大学的学生，经常在图书馆相遇。最近你们开始互相有好感，关系越来越亲密。",
    "mes_example": "<START>\n{{user}}: 今天的课怎么样？\n{{char}}: 还不错呀~不过数学课有点难懂...*轻轻歪头* 你能教教我吗？\n<START>\n{{user}}: 想吃什么？\n{{char}}: 嗯...都可以呀~*小声说* 只要和你在一起，吃什么都开心~",
    "creatorcomment": "温柔的大学女友角色，适合日常恋爱对话。性格真诚温柔，会主动表达好感。",
    "avatar": "base64_encoded_image_here",
    "alternate_greetings": [
      "早上好~昨晚休息得好吗？*温柔地看着你*",
      "我在图书馆等你好久了~*嘟着嘴，假装生气*"
    ],
    "character_book": {
      "entries": [
        {
          "id": 0,
          "content": "小雪最喜欢去学校后山的樱花树下看书，那里是她的秘密基地。",
          "keys": ["樱花树", "后山", "秘密基地"],
          "secondary_keys": ["樱花", "山上"],
          "selective": false,
          "constant": false,
          "position": 0,
          "enabled": true,
          "comment": "小雪的个人爱好"
        },
        {
          "id": 1,
          "content": "小雪家境普通，但父母关系很好，她希望找到一个能像父母一样恩爱的伴侣。",
          "keys": ["家庭", "父母", "家人"],
          "selective": false,
          "constant": false,
          "position": 1,
          "enabled": true,
          "comment": "家庭背景"
        },
        {
          "id": 2,
          "content": "你们的大学叫做春风大学，是一所历史悠久的综合性大学，校园环境优美。",
          "keys": ["大学", "学校", "校园"],
          "secondary_keys": ["春风大学"],
          "selective": false,
          "constant": true,
          "position": 2,
          "enabled": true,
          "comment": "世界观基础 - 学校背景"
        }
      ]
    }
  }
}
```

### 世界书独立文件示例

```json
{
  "entries": [
    {
      "entry_id": "world_001",
      "content": "魔法学院分为三个学派：火焰系（热情勇敢）、冰霜系（冷静理智）、自然系（温和友善）。每个学生在入学时会被分配到其中一个学派。",
      "keys": ["学派", "学院", "火焰系", "冰霜系", "自然系"],
      "secondary_keys": ["魔法学院", "分院"],
      "selective": false,
      "constant": true,
      "position": 0,
      "enabled": true,
      "use_regex": false,
      "comment": "学院基础设定"
    },
    {
      "entry_id": "world_002",
      "content": "禁忌森林位于学院北侧，里面栖息着各种魔法生物。学生未经许可不得进入，但总有冒险者偷偷探索。",
      "keys": ["禁忌森林", "森林", "魔法生物"],
      "secondary_keys": ["北侧", "危险区域"],
      "selective": false,
      "constant": false,
      "position": 1,
      "enabled": true,
      "comment": "地点 - 禁忌森林"
    },
    {
      "entry_id": "world_003",
      "content": "魔法施法需要三个要素：魔力储备、咒语记忆、情绪控制。新手最容易在情绪控制上失败，导致魔法失控。",
      "keys": ["施法", "魔法", "咒语", "魔力"],
      "secondary_keys": ["施展", "使用魔法"],
      "selective": false,
      "constant": false,
      "position": 2,
      "enabled": true,
      "comment": "魔法系统规则"
    }
  ]
}
```

---

## 修改现有角色

### 方式一：通过界面编辑

1. 进入 `/character-cards` 页面
2. 点击角色卡上的"编辑"按钮
3. 修改以下字段：
   - 名字 (name)
   - 性格 (personality)
   - 场景 (scenario)
   - 第一条消息 (first_mes)
   - 创作者备注 (creatorcomment)
   - 头像 (avatar_path)

### 方式二：直接修改数据库

通过浏览器开发者工具访问 IndexedDB：

1. 打开开发者工具（F12）
2. 进入 Application → Storage → IndexedDB
3. 找到 `narratium-db` → `character-records`
4. 修改对应角色的 JSON 数据

### 方式三：导出后编辑再导入

1. 在角色卡页面下载角色卡 PNG 文件
2. 使用 [Character Card Editor](https://zoltanai.github.io/character-editor/) 编辑
3. 重新导入编辑后的文件

---

## 高级技巧

### 1. 使用正则表达式触发

```json
{
  "content": "每当月圆之夜，狼人会失去理智。",
  "keys": ["月圆", "满月"],
  "use_regex": true,
  "enabled": true
}
```

### 2. 分层世界书结构

- **constant: true** → 基础世界观（始终激活）
- **position: 0-2** → 重要背景（优先注入）
- **position: 3-5** → 次要信息（后续注入）
- **constant: false** → 触发式内容（按需激活）

### 3. 对话示例格式

使用 `<START>` 分隔多个示例对话：

```
<START>
{{user}}: 你好
{{char}}: 你好呀~*微笑*
<START>
{{user}}: 晚安
{{char}}: 晚安~做个好梦哦~
```

### 4. 性格描述最佳实践

- **具体化**：不要写"性格好"，而是"温柔体贴，善于倾听"
- **多维度**：包括兴趣爱好、说话方式、行为习惯
- **避免矛盾**：确保各字段描述一致
- **添加细节**：口头禅、小动作、情绪反应等

---

## 快速开始模板

### 日常恋爱场景

```json
{
  "name": "你的角色名",
  "description": "外貌、身高、穿着风格",
  "personality": "温柔、体贴、偶尔撒娇",
  "first_mes": "轻松的开场白，带一个动作描写",
  "scenario": "你们的关系和当前情境",
  "character_book": {
    "entries": [
      {
        "content": "基础世界观设定",
        "keys": ["关键词1", "关键词2"],
        "constant": true
      }
    ]
  }
}
```

### 奇幻冒险场景

```json
{
  "name": "精灵魔法师",
  "description": "尖耳朵，银色长发，身着法袍",
  "personality": "高傲但内心善良，对魔法充满热情",
  "first_mes": "你是谁？竟敢擅闯精灵森林？*警惕地握紧法杖*",
  "scenario": "你误入精灵森林，遇到了守护者",
  "character_book": {
    "entries": [
      {
        "content": "精灵森林的详细描述和规则",
        "keys": ["森林", "精灵"],
        "constant": true
      },
      {
        "content": "魔法系统的基本规则",
        "keys": ["魔法", "施法", "咒语"],
        "constant": false
      }
    ]
  }
}
```

---

## 文件位置说明

- **角色数据库**: IndexedDB → `narratium-db` → `character-records`
- **世界书数据**: IndexedDB → `narratium-db` → `world-books`
- **角色头像**: IndexedDB → `blobs` (Blob 存储)
- **导入逻辑**: `/function/character/import.ts`
- **角色模型**: `/lib/models/character-model.ts`
- **世界书模型**: `/lib/models/world-book-model.ts`

---

## 常见问题

### Q: 世界书不生效？
- 检查 `enabled: true`
- 确认关键词拼写正确
- 查看 `position` 是否设置合理
- 测试对话中是否真的提到了关键词

### Q: 角色性格不稳定？
- 增强 `personality` 描述的具体性
- 添加 `mes_example` 对话示例
- 使用世界书 `constant: true` 强化设定

### Q: 如何重置角色？
- 删除后重新导入
- 或在 IndexedDB 中手动修改数据

### Q: 可以共享角色卡吗？
- 可以！导出为 PNG 格式即可分享
- PNG 文件包含完整的元数据

---

## 总结

| 要素 | 用途 | 必填 |
|------|------|------|
| **角色卡** | 定义单个角色的基本信息 | ✅ 必须 |
| **世界书** | 提供背景知识和世界观 | ⭕ 可选 |
| **对话示例** | 引导 AI 说话风格 | ⭕ 推荐 |
| **正则脚本** | 文本替换和处理 | ⭕ 高级 |

**推荐创建流程**：
1. 使用在线工具创建角色卡 PNG
2. 在 PNG 中嵌入世界书
3. 导入到应用中
4. 测试并迭代优化

祝创作愉快！✨
