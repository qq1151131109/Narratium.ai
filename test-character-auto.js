/**
 * 自动化测试角色加载功能
 */

const http = require('http');

// 获取所有角色
async function getAllCharacters() {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:3000/api/characters', (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// 模拟 Character 类的构造逻辑
function testCharacterConstruction(characterRecord) {
    console.log('\n🔍 测试 Character 构造...');
    console.log('characterRecord.id:', characterRecord.id);
    console.log('characterRecord.imagePath:', characterRecord.imagePath);

    if (!characterRecord) {
        throw new Error("Character record is required");
    }

    if (!characterRecord.data) {
        throw new Error("Character data is missing");
    }

    console.log('✅ characterRecord 和 data 存在');

    // 模拟 Character 类的数据提取
    const characterData = {
        name: characterRecord.data.data?.name || characterRecord.data.name || "Unknown Character",
        description: characterRecord.data.data?.description || characterRecord.data.description || "",
        personality: characterRecord.data.data?.personality || characterRecord.data.personality || "",
        first_mes: characterRecord.data.data?.first_mes || characterRecord.data.first_mes || "",
        scenario: characterRecord.data.data?.scenario || characterRecord.data.scenario || "",
        mes_example: characterRecord.data.data?.mes_example || characterRecord.data.mes_example || "",
        creatorcomment: characterRecord.data.creatorcomment || characterRecord.data.data?.creator_notes || "",
        avatar: characterRecord.data.avatar || "",
        creator_notes: characterRecord.data.data?.creator_notes || characterRecord.data.creator_notes || "",
        alternate_greetings: characterRecord.data.data?.alternate_greetings || characterRecord.data.alternate_greetings || [],
    };

    console.log('提取的角色数据:');
    console.log('  name:', characterData.name);
    console.log('  personality:', characterData.personality || '(空)');
    console.log('  first_mes:', characterData.first_mes ? characterData.first_mes.substring(0, 50) + '...' : '(空)');
    console.log('  alternate_greetings:', characterData.alternate_greetings.length, '条');

    // 测试 worldBook 提取
    const character_book = characterRecord.data.data?.character_book || characterRecord.data.character_book;
    console.log('  character_book:', character_book ? '存在' : '不存在');

    if (character_book) {
        if (character_book.entries) {
            const entries = Array.isArray(character_book.entries) ? character_book.entries : Object.keys(character_book.entries);
            console.log('    entries:', entries.length || Object.keys(character_book.entries).length, '条');
        }
    }

    if (!characterData.name || characterData.name === "Unknown Character") {
        throw new Error('❌ 角色名称提取失败！');
    }

    console.log('✅ Character 构造成功');
    return characterData;
}

async function main() {
    console.log('========================================');
    console.log('🚀 开始自动化测试角色加载');
    console.log('========================================\n');

    try {
        // 1. 获取所有角色
        console.log('📡 步骤 1: 获取所有角色...');
        const result = await getAllCharacters();

        if (!result.success) {
            throw new Error('API 返回失败');
        }

        console.log(`✅ 成功获取 ${result.data.length} 个角色\n`);

        // 2. 测试每个角色
        let successCount = 0;
        let failCount = 0;
        const failures = [];

        for (let i = 0; i < result.data.length; i++) {
            const char = result.data[i];
            const name = char.data.data?.name || char.data.name || '未命名';

            console.log('═'.repeat(50));
            console.log(`📝 测试角色 ${i + 1}/${result.data.length}: ${name}`);
            console.log('═'.repeat(50));
            console.log('ID:', char.id);
            console.log('imagePath:', char.imagePath);
            console.log('数据结构:', char.data.data ? '嵌套 (data.data)' : '扁平 (data)');

            try {
                testCharacterConstruction(char);
                successCount++;
                console.log(`✅ 测试通过: ${name}\n`);
            } catch (error) {
                failCount++;
                failures.push({ name, id: char.id, error: error.message });
                console.error(`❌ 测试失败: ${name}`);
                console.error(`   错误: ${error.message}\n`);
            }
        }

        // 3. 汇总报告
        console.log('\n');
        console.log('========================================');
        console.log('📊 测试汇总');
        console.log('========================================');
        console.log(`总计: ${result.data.length} 个角色`);
        console.log(`✅ 成功: ${successCount} 个`);
        console.log(`❌ 失败: ${failCount} 个`);

        if (failures.length > 0) {
            console.log('\n失败的角色:');
            failures.forEach((f, i) => {
                console.log(`  ${i + 1}. ${f.name} (${f.id})`);
                console.log(`     错误: ${f.error}`);
            });
        }

        console.log('\n========================================\n');

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
