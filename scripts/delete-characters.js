#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const charactersPath = path.join(__dirname, '../data/characters.json');

// 读取角色数据
const characters = JSON.parse(fs.readFileSync(charactersPath, 'utf8'));

console.log(`原始角色数量: ${characters.length}`);

// 删除 Camila 和 Kiana
const filteredCharacters = characters.filter(char => {
  const name = char.data?.name || '';
  console.log(`检查角色: ${name}`);
  return name !== 'Camila' && name !== 'Kiana ';
});

console.log(`删除后角色数量: ${filteredCharacters.length}`);

// 写回文件
fs.writeFileSync(charactersPath, JSON.stringify(filteredCharacters, null, 2));

console.log('✅ 成功删除 Camila 和 Kiana 角色');
