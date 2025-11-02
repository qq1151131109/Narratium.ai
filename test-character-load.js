/**
 * 测试脚本：模拟加载服务器角色
 */

// 模拟服务器返回的角色数据
const serverCharacter = {
  "id": "char_1762053255216_ac90droj8",
  "data": {
    "name": "Ayaka",
    "description": "测试描述",
    "personality": "",
    "first_mes": "你好",
    "scenario": "测试场景",
    "mes_example": "",
    "avatar": "https://avatars.charhub.io/avatars/randotone/ayaka-sumi-1e5e3fa6590d/chara_card_v2.png",
    "character_book": {
      "entries": []
    },
    "creator_notes": "测试备注",
    "alternate_greetings": []
  },
  "imagePath": "/api/characters/images/main_ayaka-sumi-1e5e3fa6590d_spec_v2.png",
  "created_at": "2025-11-02T03:14:15.216Z",
  "updated_at": "2025-11-02T03:14:15.216Z"
};

// 模拟浏览器存储的角色数据
const browserCharacter = {
  "id": "char_browser_123",
  "data": {
    "data": {  // 嵌套结构
      "name": "Browser Char",
      "description": "浏览器角色",
      "personality": "友好",
      "first_mes": "你好",
      "scenario": "测试",
      "mes_example": "",
      "character_book": {
        "entries": []
      },
      "creator_notes": "备注",
      "alternate_greetings": []
    }
  },
  "imagePath": "blob:http://localhost:3000/abc123",
  "created_at": "2025-11-02T03:14:15.216Z",
  "updated_at": "2025-11-02T03:14:15.216Z"
};

console.log("========================================");
console.log("测试服务器角色数据提取");
console.log("========================================");

// 测试服务器角色
const serverName = serverCharacter.data.data?.name || serverCharacter.data.name;
const serverPersonality = serverCharacter.data.data?.personality || serverCharacter.data.personality;
const serverCharacterBook = serverCharacter.data.data?.character_book || serverCharacter.data.character_book;

console.log("服务器角色：");
console.log("  name:", serverName);
console.log("  personality:", serverPersonality || "(空)");
console.log("  character_book:", serverCharacterBook ? "存在" : "不存在");

console.log("\n========================================");
console.log("测试浏览器角色数据提取");
console.log("========================================");

// 测试浏览器角色
const browserName = browserCharacter.data.data?.name || browserCharacter.data.name;
const browserPersonality = browserCharacter.data.data?.personality || browserCharacter.data.personality;
const browserCharacterBook = browserCharacter.data.data?.character_book || browserCharacter.data.character_book;

console.log("浏览器角色：");
console.log("  name:", browserName);
console.log("  personality:", browserPersonality || "(空)");
console.log("  character_book:", browserCharacterBook ? "存在" : "不存在");

console.log("\n========================================");
console.log("测试结果");
console.log("========================================");
console.log("服务器角色提取:", serverName ? "✅ 成功" : "❌ 失败");
console.log("浏览器角色提取:", browserName ? "✅ 成功" : "❌ 失败");
