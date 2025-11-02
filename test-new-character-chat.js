/**
 * Test script to verify new character chat initialization
 */

const BASE_URL = 'http://localhost:3001';

async function testNewCharacterChat() {
  try {
    // Step 1: Get all characters
    console.log('\n📋 Step 1: Fetching all characters...');
    const charsResponse = await fetch(`${BASE_URL}/api/characters`);
    const charsData = await charsResponse.json();

    const newChars = charsData.data.filter(c =>
      ['架乃由罗', '三上悠亚', '深田咏美', '波多野结衣'].includes(c.data.name)
    );

    console.log(`Found ${newChars.length} new actress characters:`);
    newChars.forEach(c => {
      console.log(`  - ${c.data.name} (${c.id})`);
      console.log(`    Has description: ${!!c.data.description}`);
      console.log(`    Has first_mes: ${!!c.data.first_mes}`);
      console.log(`    Has scenario: ${!!c.data.scenario}`);
      console.log(`    Has character_book: ${!!c.data.character_book}`);
      console.log(`    World book entries: ${c.data.character_book?.entries?.length || 0}`);
    });

    if (newChars.length === 0) {
      console.error('❌ No new characters found!');
      return;
    }

    // Step 2: Test character data structure
    const testChar = newChars[0];
    console.log(`\n🧪 Step 2: Testing ${testChar.data.name} data structure...`);

    const requiredFields = ['name', 'description', 'first_mes', 'scenario', 'personality'];
    const missingFields = requiredFields.filter(field => !testChar.data[field]);

    if (missingFields.length > 0) {
      console.error(`❌ Missing required fields: ${missingFields.join(', ')}`);
    } else {
      console.log('✅ All required fields present');
    }

    // Step 3: Check if character_book is properly formatted
    console.log(`\n📚 Step 3: Checking world book structure...`);
    const worldBook = testChar.data.character_book;

    if (!worldBook) {
      console.error('❌ No character_book found');
    } else {
      console.log(`✅ character_book exists`);
      console.log(`   - name: ${worldBook.name}`);
      console.log(`   - scan_depth: ${worldBook.scan_depth}`);
      console.log(`   - token_budget: ${worldBook.token_budget}`);
      console.log(`   - entries: ${worldBook.entries?.length || 0} entries`);

      if (worldBook.entries && worldBook.entries.length > 0) {
        const firstEntry = worldBook.entries[0];
        console.log(`   - First entry keys: ${firstEntry.keys?.join(', ')}`);
        console.log(`   - First entry content length: ${firstEntry.content?.length || 0} chars`);
      }
    }

    console.log('\n✅ Test completed!');
    console.log('\n💡 Next: Try accessing http://localhost:3001/character?id=' + testChar.id);
    console.log('   and send a test message to see if there are any runtime errors.');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  }
}

testNewCharacterChat();
