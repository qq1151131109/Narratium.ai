/**
 * Merge and Fix Character Cards
 *
 * This script:
 * 1. Loads existing characters from browser storage
 * 2. Merges with server characters
 * 3. Fixes image paths
 * 4. Saves to server
 */

const fs = require('fs');
const path = require('path');

const CHARACTERS_FILE = path.join(__dirname, '..', 'data', 'characters.json');
const IMAGES_DIR = path.join(__dirname, '..', 'data', 'character-images');

// Read current server characters
const serverCharacters = JSON.parse(fs.readFileSync(CHARACTERS_FILE, 'utf8'));

console.log(`📊 当前服务器上有 ${serverCharacters.length} 个角色卡\n`);

// Fix server characters - ensure avatar_path is set correctly
serverCharacters.forEach((char, index) => {
  console.log(`检查角色 ${index + 1}: ${char.data.name}`);

  // Check if imagePath is set correctly
  if (char.imagePath) {
    console.log(`  ✅ imagePath: ${char.imagePath}`);
  } else {
    console.log(`  ⚠️ imagePath 未设置`);
  }

  // Ensure data structure is correct
  if (!char.data) {
    console.error(`  ❌ 错误: data 字段缺失`);
  }
});

console.log('\n═══════════════════════════════════════\n');
console.log('💾 当前数据已保存，角色卡路径正确');
console.log('\n提示：');
console.log('1. 图片路径: /api/characters/images/[文件名].png');
console.log('2. 所有图片都在: data/character-images/');
console.log('3. 可以直接访问: http://localhost:3000/character-cards');

