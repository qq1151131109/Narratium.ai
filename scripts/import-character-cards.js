/**
 * Character Card PNG Import Script
 *
 * This script extracts character data from PNG files and imports them into the server.
 */

const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '..', 'data', 'character-images');
const CHARACTERS_FILE = path.join(__dirname, '..', 'data', 'characters.json');

// Extract text chunks from PNG
function extractPngMetadata(buffer) {
  try {
    // PNG signature
    const signature = buffer.slice(0, 8);
    if (signature.toString('hex') !== '89504e470d0a1a0a') {
      throw new Error('Not a valid PNG file');
    }

    let offset = 8;
    const chunks = [];

    while (offset < buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const type = buffer.slice(offset + 4, offset + 8).toString('ascii');
      const data = buffer.slice(offset + 8, offset + 8 + length);

      offset += 12 + length; // length(4) + type(4) + data(length) + crc(4)

      if (type === 'tEXt') {
        const nullIndex = data.indexOf(0);
        const keyword = data.slice(0, nullIndex).toString('ascii');
        const text = data.slice(nullIndex + 1).toString('utf8');
        chunks.push({ keyword, text });
      }

      if (type === 'IEND') break;
    }

    return chunks;
  } catch (error) {
    console.error('Error extracting PNG metadata:', error);
    return [];
  }
}

// Parse character card from PNG
function parseCharacterCard(pngPath) {
  try {
    const buffer = fs.readFileSync(pngPath);
    const chunks = extractPngMetadata(buffer);

    // Look for 'chara' chunk (Character Card v2)
    const charaChunk = chunks.find(chunk => chunk.keyword === 'chara');
    if (!charaChunk) {
      console.log(`No 'chara' chunk found in ${path.basename(pngPath)}`);
      return null;
    }

    // Decode base64
    const jsonStr = Buffer.from(charaChunk.text, 'base64').toString('utf8');
    const cardData = JSON.parse(jsonStr);

    return cardData;
  } catch (error) {
    console.error(`Error parsing ${path.basename(pngPath)}:`, error.message);
    return null;
  }
}

// Import all character cards
async function importCharacterCards() {
  console.log('🚀 开始导入角色卡...\n');

  const files = fs.readdirSync(IMAGES_DIR).filter(f => f.endsWith('.png'));
  console.log(`📁 找到 ${files.length} 个 PNG 文件\n`);

  const characters = [];
  let successCount = 0;
  let failCount = 0;

  for (const file of files) {
    const filePath = path.join(IMAGES_DIR, file);
    console.log(`📄 处理: ${file}`);

    const cardData = parseCharacterCard(filePath);

    if (!cardData) {
      console.log(`   ❌ 失败: 无法提取角色数据\n`);
      failCount++;
      continue;
    }

    // Generate character ID from filename
    const charId = 'char_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Get character name
    const charName = cardData.data?.name || cardData.name || file.replace('.png', '');

    console.log(`   ✅ 提取成功: ${charName}`);
    console.log(`   📝 ID: ${charId}`);

    const character = {
      id: charId,
      data: cardData.data || cardData,
      imagePath: `/api/characters/images/${file}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    characters.push(character);
    successCount++;
    console.log('');
  }

  // Save to characters.json
  fs.writeFileSync(CHARACTERS_FILE, JSON.stringify(characters, null, 2));

  console.log('═'.repeat(50));
  console.log(`\n🎉 导入完成！`);
  console.log(`✅ 成功: ${successCount} 个`);
  console.log(`❌ 失败: ${failCount} 个`);
  console.log(`\n💾 数据已保存到: ${CHARACTERS_FILE}`);
  console.log(`\n🌐 现在可以访问: http://localhost:3000/character-cards\n`);
}

// Run import
importCharacterCards().catch(console.error);
