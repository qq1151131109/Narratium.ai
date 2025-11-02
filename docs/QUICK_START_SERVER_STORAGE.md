# 角色卡共享功能 - 快速开始

## ✅ 已完成的工作

我已经为你实现了完整的**服务器端角色卡存储系统**，让所有用户都能访问相同的角色卡！

### 创建的文件

1. **API 路由**：
   - `app/api/characters/route.ts` - 角色卡增删改查 API
   - `app/api/characters/images/[filename]/route.ts` - 角色头像服务

2. **工具类**：
   - `lib/data/roleplay/server-character-operation.ts` - 服务器存储操作类

3. **迁移页面**：
   - `app/migrate-characters/page.tsx` - 可视化迁移工具

4. **文档**：
   - `docs/CHARACTER_STORAGE_MIGRATION.md` - 完整迁移指南

5. **配置修改**：
   - `next.config.ts` - 移除了 `output: "export"` 以支持 API 路由

---

## 🚀 如何使用

### 第一步：启动服务器

```bash
cd /home/ubuntu/shenglin/Narratium.ai
pnpm dev
```

服务器会在 `http://localhost:3000` 或 `http://localhost:3001` 启动。

---

### 第二步：迁移现有角色卡

#### 方法1：使用可视化工具（推荐）

1. 打开浏览器访问：
   ```
   http://localhost:3000/migrate-characters
   ```

2. 页面会显示：
   - 浏览器本地存储的角色卡数量
   - 服务器上的角色卡数量

3. 点击 **"开始迁移"** 按钮

4. 等待迁移完成，查看结果：
   - ✅ 成功迁移数量
   - ❌ 失败数量（如果有）

#### 方法2：使用浏览器控制台

如果可视化工具有问题，可以在浏览器控制台（F12）运行：

```javascript
// 导入工具类
const { ServerCharacterOperations } = await import('/lib/data/roleplay/server-character-operation.js');

// 执行迁移
const result = await ServerCharacterOperations.migrateFromIndexedDB();

console.log(`✅ 成功迁移: ${result.success}`);
console.log(`❌ 失败: ${result.failed}`);
```

---

### 第三步：验证迁移成功

**打开新的浏览器窗口**（或无痕模式），访问：
```
http://localhost:3000/character-cards
```

如果能看到角色卡，说明迁移成功！🎉

---

## 📁 数据存储位置

迁移后的数据保存在：

```
/home/ubuntu/shenglin/Narratium.ai/data/
├── characters.json              # 角色卡数据（JSON 格式）
└── character-images/            # 角色头像图片
    ├── char_123.png
    ├── char_456.png
    └── ...
```

### characters.json 示例

```json
[
  {
    "id": "char_1762044578496",
    "data": {
      "name": "艾莉娅",
      "personality": "活泼开朗，对魔法充满热情",
      "scenario": "魔法学院的学生导游",
      "first_mes": "你好呀~欢迎来到魔法学院！",
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

## 🔧 API 接口说明

### 1. 获取所有角色卡

```bash
curl http://localhost:3000/api/characters
```

**响应**：
```json
{
  "success": true,
  "data": [...]
}
```

### 2. 创建新角色卡

```bash
curl -X POST http://localhost:3000/api/characters \
  -H "Content-Type: application/json" \
  -d '{
    "id": "char_123",
    "data": {
      "name": "角色名",
      "personality": "性格描述",
      ...
    },
    "imageData": "data:image/png;base64,..."
  }'
```

### 3. 更新角色卡

```bash
curl -X PUT http://localhost:3000/api/characters \
  -H "Content-Type: application/json" \
  -d '{
    "id": "char_123",
    "data": {
      "personality": "新的性格描述",
      ...
    }
  }'
```

### 4. 删除角色卡

```bash
curl -X DELETE "http://localhost:3000/api/characters?id=char_123"
```

### 5. 获取角色头像

```bash
curl http://localhost:3000/api/characters/images/char_123.png
```

---

## ⚠️ 注意事项

### 1. 配置更改

我修改了 `next.config.ts`，移除了 `output: "export"` 配置。

**原因**：静态导出模式不支持动态 API 路由。

**影响**：
- ✅ 可以使用 API 路由
- ❌ 不能使用 `next export` 导出静态 HTML

**如果需要部署到静态托管**（如 GitHub Pages），需要使用其他方案：
- Vercel（推荐，原生支持 API 路由）
- Netlify Functions
- 自己的 Node.js 服务器

### 2. 数据备份

**重要！**请定期备份 `data/` 目录：

```bash
# 备份整个 data 目录
cp -r /home/ubuntu/shenglin/Narratium.ai/data /path/to/backup/

# 只备份角色卡数据
cp data/characters.json data/characters.backup.json
```

### 3. 并发安全

当前实现使用简单的文件存储，**不支持高并发**。

如果多人同时修改角色卡，可能会出现数据覆盖问题。

**解决方案**（未来改进）：
- 使用真实数据库（PostgreSQL、MongoDB）
- 添加文件锁机制
- 实现乐观锁（版本号控制）

---

## 📊 迁移前后对比

| 特性 | 迁移前（IndexedDB） | 迁移后（服务器） |
|------|-------------------|----------------|
| **数据位置** | 浏览器本地 | 服务器 |
| **访问范围** | 单个浏览器 | 所有用户 ✅ |
| **新用户可见** | ❌ 否 | ✅ 是 |
| **多设备同步** | ❌ 否 | ✅ 是 |
| **新浏览器** | ❌ 看不到 | ✅ 可访问 |
| **数据备份** | 困难 | 容易（直接复制文件） |
| **并发安全** | 不适用 | ⚠️ 需要优化 |

---

## 🎯 下一步

### 选项1：继续使用浏览器存储（当前）

如果你暂时不需要共享功能，可以继续使用 IndexedDB。

### 选项2：完全切换到服务器存储（推荐）

修改 `app/character-cards/page.tsx`，让页面直接使用服务器 API：

```typescript
// 原来：
import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";
const characters = await LocalCharacterRecordOperations.getAllCharacters();

// 修改为：
import { ServerCharacterOperations } from "@/lib/data/roleplay/server-character-operation";
const characters = await ServerCharacterOperations.getAllCharacters();
```

### 选项3：使用真实数据库（生产环境）

安装数据库并修改 API 代码：

```bash
# 使用 Supabase（最简单）
npm install @supabase/supabase-js

# 或者使用 Prisma + PostgreSQL
npm install prisma @prisma/client
npx prisma init
```

---

## 🆘 常见问题

### Q: 迁移后浏览器中的数据会被删除吗？

**不会**。迁移只是复制数据到服务器，不会删除浏览器中的原始数据。

### Q: 如何清空浏览器数据？

```javascript
// 在浏览器控制台运行（谨慎操作！）
indexedDB.deleteDatabase('CharacterAppDB');
```

### Q: 服务器重启后数据会丢失吗？

**不会**。数据存储在 `data/` 目录的文件中，服务器重启后仍然存在。

### Q: 如何恢复备份？

```bash
# 恢复 characters.json
cp data/characters.backup.json data/characters.json

# 恢复图片目录
cp -r /path/to/backup/character-images data/
```

---

## 📚 相关文档

- [完整迁移指南](./CHARACTER_STORAGE_MIGRATION.md)
- [故事推进系统说明](./STORY_PROGRESSION_SYSTEM.md)
- [创建新故事指南](./CREATE_NEW_STORY_GUIDE.md)
- [角色卡调试指南](./CHARACTER_CARD_DEBUG_GUIDE.md)

---

## ✨ 总结

### 现在你可以：

- ✅ 导入角色卡，其他人也能访问
- ✅ 新浏览器打开网站就能看到所有角色卡
- ✅ 多设备共享同一组角色卡
- ✅ 轻松备份和恢复数据
- ✅ 使用 API 进行自动化操作

### 使用流程：

1. 访问 `http://localhost:3000/migrate-characters`
2. 点击"开始迁移"
3. 新浏览器访问 `http://localhost:3000/character-cards` 验证
4. 定期备份 `data/` 目录

祝使用愉快！🎉
