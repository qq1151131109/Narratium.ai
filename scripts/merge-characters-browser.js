/**
 * Merge Browser and Server Characters
 *
 * This script merges characters from browser IndexedDB with server storage
 */

// 使用说明：
// 1. 在浏览器中打开 http://localhost:3000
// 2. 打开控制台（F12）
// 3. 粘贴并运行以下代码：

console.log(`
========================================
  浏览器角色卡合并工具
========================================

这个工具会将你浏览器中的角色卡上传到服务器，
与服务器上已有的角色卡合并。

请在浏览器控制台运行以下代码：
`);

const mergeScript = `
(async () => {
  console.log('🔄 开始合并角色卡...');

  // 1. 读取浏览器 IndexedDB 中的角色卡
  const dbRequest = indexedDB.open('CharacterAppDB', 10);

  dbRequest.onsuccess = async (event) => {
    const db = event.target.result;

    // 读取角色卡
    const tx1 = db.transaction(['characters_record'], 'readonly');
    const store1 = tx1.objectStore('characters_record');
    const getRequest = store1.get('data');

    getRequest.onsuccess = async () => {
      const localCharacters = getRequest.result || [];
      console.log(\`📱 浏览器中有 \${localCharacters.length} 个角色卡\`);

      if (localCharacters.length === 0) {
        console.log('⚠️ 浏览器中没有角色卡需要上传');
        return;
      }

      // 2. 获取服务器上的角色卡
      const serverResponse = await fetch('/api/characters');
      const serverData = await serverResponse.json();
      const serverCharacters = serverData.data || [];
      console.log(\`☁️ 服务器上有 \${serverCharacters.length} 个角色卡\`);

      // 3. 逐个上传浏览器中的角色卡到服务器
      let uploaded = 0;
      let skipped = 0;

      for (const char of localCharacters) {
        const name = char.data?.name || char.id;

        // 检查服务器上是否已存在
        const exists = serverCharacters.find(s => s.id === char.id);
        if (exists) {
          console.log(\`⏭️ 跳过: \${name} (已存在)\`);
          skipped++;
          continue;
        }

        console.log(\`📤 上传: \${name}\`);

        try {
          // 获取图片
          let imageData = null;
          if (char.imagePath) {
            const tx2 = db.transaction(['character_images'], 'readonly');
            const store2 = tx2.objectStore('character_images');
            const imgRequest = store2.get(char.imagePath);

            const blob = await new Promise((resolve) => {
              imgRequest.onsuccess = () => resolve(imgRequest.result);
            });

            if (blob) {
              imageData = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
              });
            }
          }

          // 上传到服务器
          const response = await fetch('/api/characters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: char.id,
              data: char.data,
              imageData: imageData
            })
          });

          if (response.ok) {
            console.log(\`  ✅ 成功\`);
            uploaded++;
          } else {
            const error = await response.json();
            console.error(\`  ❌ 失败: \${error.error}\`);
          }
        } catch (error) {
          console.error(\`  ❌ 失败: \${error.message}\`);
        }
      }

      console.log(\`\\n🎉 合并完成！\`);
      console.log(\`✅ 上传: \${uploaded} 个\`);
      console.log(\`⏭️ 跳过: \${skipped} 个\`);
      console.log(\`📊 服务器总计: \${serverCharacters.length + uploaded} 个角色卡\`);
      console.log(\`\\n刷新页面查看效果！\`);
    };
  };

  dbRequest.onerror = () => {
    console.error('❌ 无法打开 IndexedDB');
  };
})();
`;

console.log(mergeScript);
console.log(`
========================================
`);
