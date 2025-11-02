/**
 * 选择性替换角色卡脚本
 *
 * 将4个指定角色替换为女优角色：
 * 1. Ayaka → 架乃由罗
 * 2. Jamiel Han → 三上悠亚
 * 3. Meiling → 深田咏美
 * 4. Chiyo Aoki → 波多野结衣
 *
 * 保留3个游戏角色：Kiana, Lumine, Camila
 */

const fs = require('fs');
const path = require('path');
const { actressCharacters } = require('../data/actress-characters.js');

const CHARACTERS_FILE = path.join(__dirname, '..', 'data', 'characters.json');

// 角色映射关系
const characterMapping = {
  'Ayaka': 'yura_kano',
  'Jamiel Han': 'yua_mikami',
  'Meiling': 'eimi_fukada',
  'Chiyo Aoki': 'yui_hatano'
};

// 将女优数据转换为角色卡格式
function convertToCharacterCard(actressData) {
  return {
    name: actressData.name,
    description: actressData.description,
    personality: actressData.personality,
    first_mes: actressData.first_mes,
    mes_example: "",
    scenario: actressData.scenario,
    avatar: actressData.imageUrl,
    character_version: "v2",
    tags: actressData.tags || [],
    creator: "Generated",
    creator_notes: actressData.creator_notes || "",
    alternate_greetings: actressData.alternate_greetings || [],
    character_book: {
      entries: []
    }
  };
}

async function replaceCharacters() {
  console.log('========================================');
  console.log('🎬 开始替换角色卡为女优角色');
  console.log('========================================\n');

  try {
    // 读取现有角色数据
    const charactersData = JSON.parse(fs.readFileSync(CHARACTERS_FILE, 'utf-8'));
    console.log(`📊 当前共有 ${charactersData.length} 个角色\n`);

    let replacedCount = 0;
    let preservedCount = 0;

    // 遍历并替换指定角色
    charactersData.forEach((character, index) => {
      const characterName = character.data.name;

      if (characterMapping[characterName]) {
        const actressKey = characterMapping[characterName];
        const actressData = actressCharacters[actressKey];

        console.log(`🔄 替换角色 ${index + 1}: ${characterName} → ${actressData.name}`);
        console.log(`   年龄: ${actressData.age}岁`);
        console.log(`   职业: ${actressData.occupation}`);
        console.log(`   场景: ${actressData.scenario.substring(0, 50)}...`);

        // 保留原有的ID和时间戳
        character.data = convertToCharacterCard(actressData);
        character.updated_at = new Date().toISOString();

        // 更新图片路径（使用原有的文件名模式）
        const imageFileName = `${actressData.name_en.toLowerCase().replace(' ', '_')}.jpg`;
        character.imagePath = `/api/characters/images/${imageFileName}`;

        replacedCount++;
        console.log(`   ✅ 已替换\n`);
      } else {
        console.log(`✅ 保留角色 ${index + 1}: ${characterName}`);
        preservedCount++;
      }
    });

    // 保存更新后的数据
    fs.writeFileSync(CHARACTERS_FILE, JSON.stringify(charactersData, null, 2));

    console.log('\n========================================');
    console.log('🎉 替换完成！');
    console.log('========================================');
    console.log(`✅ 已替换: ${replacedCount} 个角色`);
    console.log(`✅ 已保留: ${preservedCount} 个角色`);
    console.log(`📝 总计: ${charactersData.length} 个角色\n`);

    console.log('替换的角色：');
    Object.entries(characterMapping).forEach(([old, newKey]) => {
      const newName = actressCharacters[newKey].name;
      console.log(`  ${old} → ${newName}`);
    });

    console.log('\n保留的角色：');
    charactersData.forEach(char => {
      if (!characterMapping[char.data.name]) {
        console.log(`  ${char.data.name}`);
      }
    });

    console.log('\n⚠️  注意事项：');
    console.log('1. 头像图片需要手动下载并放到 data/character-images/ 目录');
    console.log('2. 图片命名格式：');
    Object.values(actressCharacters).forEach(actress => {
      const fileName = `${actress.name_en.toLowerCase().replace(' ', '_')}.jpg`;
      console.log(`   ${actress.name}: ${fileName}`);
    });
    console.log('\n3. 重启服务器后生效：pkill -f "pnpm dev" && pnpm dev');
    console.log('\n========================================\n');

  } catch (error) {
    console.error('❌ 替换失败:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// 执行替换
replaceCharacters();
