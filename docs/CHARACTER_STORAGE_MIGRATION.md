# 角色卡服务器存储迁移指南

## 问题背景

**当前问题**：
- 角色卡存储在浏览器的 IndexedDB 中
- 每个浏览器有独立的数据
- 新用户或新浏览器看不到你导入的角色卡
- 无法在多个设备间共享角色卡

**解决方案**：
- 将角色卡存储在服务器端
- 所有用户访问同一组角色卡
- 支持多设备、多浏览器访问
- 真正实现角色卡共享

---

## 迁移步骤

### 方法一：使用迁移工具（推荐）

#### 1. 访问迁移页面

打开浏览器访问：
```
http://localhost:3000/migrate-characters
```

#### 2. 查看当前状态

迁移页面会显示：
- **浏览器本地存储**：你当前浏览器中的角色卡数量
- **服务器存储**：已经在服务器上的角色卡数量

#### 3. 点击迁移按钮

点击"开始迁移 X 个角色卡"按钮，系统会自动：
- 读取浏览器中的所有角色卡
- 提取角色数据和头像图片
- 上传到服务器
- 保存到 `data/characters.json` 文件
- 保存头像到 `data/character-images/` 目录

#### 4. 查看迁移结果

迁移完成后会显示：
- ✅ 成功迁移的数量
- ❌ 失败的数量（如果有）
- 提示前往角色卡页面查看

#### 5. 验证迁移

打开新的浏览器窗口（或无痕模式），访问：
```
http://localhost:3000/character-cards
```

如果能看到角色卡，说明迁移成功！

---

### 方法二：使用 API 手动迁移

如果你想更精细地控制迁移过程，可以使用 API：

#### 1. 导出浏览器数据

在浏览器控制台（F12）运行：

```javascript
// 导出所有角色卡数据
(async () => {
  const { LocalCharacterRecordOperations } = await import('/lib/data/roleplay/character-record-operation');
  const { getBlob } = await import('/lib/data/local-storage');

  const characters = await LocalCharacterRecordOperations.getAllCharacters();

  for (const char of characters) {
    // 获取头像图片
    const blob = await getBlob(char.imagePath);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const imageData = reader.result;

      // 上传到服务器
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: char.id,
          data: char.data,
          imageData: imageData
        })
      });

      const result = await response.json();
      console.log(`Migrated: ${char.data.name}`, result);
    };

    if (blob) {
      reader.readAsDataURL(blob);
    }
  }
})();
```

---

## API 接口说明

### 1. 获取所有角色卡

```http
GET /api/characters
```

**响应示例**：
```json
{
  "success": true,
  "data": [
    {
      "id": "char_123",
      "data": {
        "name": "艾莉娅",
        "personality": "活泼开朗",
        ...
      },
      "imagePath": "/api/characters/images/char_123.png",
      "created_at": "2024-11-02T10:00:00.000Z",
      "updated_at": "2024-11-02T10:00:00.000Z"
    }
  ]
}
```

### 2. 创建新角色卡

```http
POST /api/characters
Content-Type: application/json

{
  "id": "char_123",
  "data": {
    "name": "角色名",
    "personality": "性格描述",
    ...
  },
  "imageData": "data:image/png;base64,..."
}
```

### 3. 更新角色卡

```http
PUT /api/characters
Content-Type: application/json

{
  "id": "char_123",
  "data": {
    "personality": "新的性格描述",
    ...
  },
  "imageData": "data:image/png;base64,..." // 可选
}
```

### 4. 删除角色卡

```http
DELETE /api/characters?id=char_123
```

### 5. 获取角色头像

```http
GET /api/characters/images/char_123.png
```

---

## 数据存储位置

### 服务器端存储结构

```
/home/ubuntu/shenglin/Narratium.ai/
├── data/
│   ├── characters.json         # 角色卡数据文件
│   └── character-images/       # 角色头像目录
│       ├── char_123.png
│       ├── char_456.png
│       └── ...
```

### characters.json 格式

```json
[
  {
    "id": "char_1762044578496",
    "data": {
      "name": "艾莉娅",
      "personality": "活泼开朗，对魔法充满热情",
      "scenario": "魔法学院的学生导游",
      "first_mes": "你好呀~欢迎来到魔法学院！",
      "description": "18岁，火焰系二年级学生",
      "character_book": {
        "entries": [...]
      }
    },
    "imagePath": "/api/characters/images/char_1762044578496.png",
    "created_at": "2024-11-02T10:00:00.000Z",
    "updated_at": "2024-11-02T10:00:00.000Z"
  }
]
```

---

## 常见问题

### Q1: 迁移后浏览器中的数据会被删除吗？

**不会**。迁移操作只是将数据复制到服务器，不会删除浏览器中的原始数据。

如果你想删除浏览器数据以释放空间，可以在浏览器控制台运行：
```javascript
// 清空 IndexedDB（谨慎操作！）
indexedDB.deleteDatabase('CharacterAppDB');
```

---

### Q2: 迁移后如何让角色卡页面使用服务器数据？

目前角色卡页面仍然使用 IndexedDB。你需要修改 `app/character-cards/page.tsx` 来使用服务器 API。

**修改步骤**：

1. 导入服务器存储类：
```typescript
import { ServerCharacterOperations } from "@/lib/data/roleplay/server-character-operation";
```

2. 修改加载函数：
```typescript
// 原来：
const characters = await LocalCharacterRecordOperations.getAllCharacters();

// 修改为：
const characters = await ServerCharacterOperations.getAllCharacters();
```

---

### Q3: 服务器重启后数据会丢失吗？

**不会**。数据存储在 `data/` 目录的 JSON 文件中，服务器重启后仍然存在。

**注意**：如果你删除了 `data/` 目录，数据将永久丢失！建议定期备份。

---

### Q4: 如何备份角色卡数据？

**方法1：直接复制文件**
```bash
# 备份整个 data 目录
cp -r /home/ubuntu/shenglin/Narratium.ai/data /path/to/backup/

# 只备份角色卡数据
cp /home/ubuntu/shenglin/Narratium.ai/data/characters.json /path/to/backup/
cp -r /home/ubuntu/shenglin/Narratium.ai/data/character-images /path/to/backup/
```

**方法2：使用 Git**
```bash
cd /home/ubuntu/shenglin/Narratium.ai
git add data/
git commit -m "Backup character data"
git push
```

---

### Q5: 多人使用会有冲突吗？

**会**。当前实现是简单的文件存储，不支持并发控制。如果多人同时修改角色卡，可能会出现数据覆盖。

**解决方案**（未来改进）：
1. 使用真实数据库（如 PostgreSQL、MongoDB）
2. 添加文件锁机制
3. 实现乐观锁（版本号控制）

---

### Q6: 如何在生产环境部署？

**使用真实数据库**（推荐）：

1. 安装 PostgreSQL 或 MongoDB
2. 修改 API 代码使用数据库连接
3. 不要使用文件存储（并发不安全）

**使用文件存储**（仅适合小规模）：

1. 确保 `data/` 目录有写权限
2. 使用文件锁避免并发冲突
3. 定期备份 `data/` 目录

---

## 下一步优化

### 1. 自动使用服务器存储

修改 `app/character-cards/page.tsx`，让页面直接使用服务器 API。

### 2. 实现双向同步

- 上传：浏览器 → 服务器
- 下载：服务器 → 浏览器
- 检测冲突并提示用户

### 3. 添加用户权限

- 公共角色卡：所有人可见
- 私有角色卡：只有创建者可见
- 需要实现用户登录系统

### 4. 使用真实数据库

- PostgreSQL + Prisma
- MongoDB + Mongoose
- Supabase（最简单）

---

## 使用示例

### 完整迁移流程

```bash
# 1. 确保服务器正在运行
cd /home/ubuntu/shenglin/Narratium.ai
pnpm dev

# 2. 打开迁移页面
# 浏览器访问: http://localhost:3000/migrate-characters

# 3. 点击"开始迁移"按钮

# 4. 等待迁移完成

# 5. 打开新浏览器验证
# 访问: http://localhost:3000/character-cards

# 6. 备份数据
cp data/characters.json data/characters.backup.json
```

---

## 技术细节

### 文件结构

```
app/
├── api/
│   └── characters/
│       ├── route.ts                    # 主 API（增删改查）
│       └── images/
│           └── [filename]/
│               └── route.ts            # 图片服务

lib/
└── data/
    └── roleplay/
        ├── character-record-operation.ts      # 浏览器存储（旧）
        └── server-character-operation.ts      # 服务器存储（新）

app/
└── migrate-characters/
    └── page.tsx                        # 迁移工具页面
```

### API 实现原理

1. **GET /api/characters**
   - 读取 `data/characters.json`
   - 返回所有角色卡数据

2. **POST /api/characters**
   - 接收角色数据和 base64 图片
   - 保存图片到 `data/character-images/`
   - 更新 `characters.json`

3. **PUT /api/characters**
   - 查找指定 ID 的角色
   - 更新数据
   - 可选更新图片

4. **DELETE /api/characters**
   - 删除角色数据
   - 删除对应的图片文件

---

## 总结

### 迁移前后对比

| 特性 | 迁移前（IndexedDB） | 迁移后（服务器） |
|------|-------------------|----------------|
| 数据位置 | 浏览器本地 | 服务器 |
| 访问范围 | 单个浏览器 | 所有用户 |
| 新用户可见 | ❌ 否 | ✅ 是 |
| 多设备同步 | ❌ 否 | ✅ 是 |
| 数据备份 | 困难 | 容易 |
| 并发安全 | 不适用 | 需要优化 |

### 推荐使用流程

1. ✅ 使用迁移工具将现有角色卡迁移到服务器
2. ✅ 验证迁移成功（新浏览器可访问）
3. ✅ 备份 `data/` 目录
4. ⏭️ 后续：修改前端代码直接使用服务器 API
5. ⏭️ 未来：使用真实数据库替代文件存储

祝使用愉快！✨
