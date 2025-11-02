/**
 * 为女优角色添加世界书
 *
 * 读取 actress-worldbooks.js 中的世界书数据
 * 更新 characters.json 中对应角色的 character_book 字段
 */

const fs = require('fs');
const path = require('path');
const {
  yuraKanoWorldBook,
  yuaMikamiWorldBook,
  eimiFukadaWorldBook,
  yuiHatanoWorldBook
} = require('../data/actress-worldbooks.js');

const CHARACTERS_FILE = path.join(__dirname, '..', 'data', 'characters.json');

// 角色名称到世界书的映射
const worldBookMapping = {
  '架乃由罗': yuraKanoWorldBook,
  '三上悠亚': yuaMikamiWorldBook,
  '深田咏美': eimiFukadaWorldBook,
  '波多野结衣': yuiHatanoWorldBook
};

async function addWorldBooks() {
  console.log('========================================');
  console.log('📚 开始为女优角色添加世界书');
  console.log('========================================\n');

  try {
    // 读取现有角色数据
    const charactersData = JSON.parse(fs.readFileSync(CHARACTERS_FILE, 'utf-8'));
    console.log(`📊 当前共有 ${charactersData.length} 个角色\n`);

    let updatedCount = 0;

    // 遍历角色，为匹配的角色添加世界书
    charactersData.forEach((character, index) => {
      const characterName = character.data.name;

      if (worldBookMapping[characterName]) {
        const worldBook = worldBookMapping[characterName];

        console.log(`📖 为角色 ${index + 1}: ${characterName} 添加世界书`);
        console.log(`   条目数量: ${worldBook.entries.length}`);

        // 添加世界书到角色数据
        character.data.character_book = worldBook;
        character.updated_at = new Date().toISOString();

        updatedCount++;
        console.log(`   ✅ 已添加\n`);
      }
    });

    // 保存更新后的数据
    fs.writeFileSync(CHARACTERS_FILE, JSON.stringify(charactersData, null, 2));

    console.log('========================================');
    console.log('🎉 世界书添加完成！');
    console.log('========================================');
    console.log(`✅ 已更新: ${updatedCount} 个角色`);
    console.log(`📝 总计: ${charactersData.length} 个角色\n`);

    console.log('📊 世界书条目统计：');
    Object.entries(worldBookMapping).forEach(([name, book]) => {
      console.log(`  ${name}: ${book.entries.length} 个条目`);
    });

    console.log('\n⚠️  注意事项：');
    console.log('1. 世界书已成功添加到角色数据中');
    console.log('2. 重启服务器后生效：pkill -f "pnpm dev" && pnpm dev');
    console.log('3. 世界书会根据对话中的关键词自动激活');
    console.log('4. 可以在对话中提到相关关键词来触发世界书内容\n');

    console.log('========================================\n');

  } catch (error) {
    console.error('❌ 添加世界书失败:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// 执行添加
addWorldBooks();
