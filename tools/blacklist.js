require('dotenv').config();
const { addToBlacklist, removeFromBlacklist, getBlacklist, closeDatabase } = require('../src/database');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const command = process.argv[2];
const targetId = process.argv[3];
const typeOrReason = process.argv[4]; // addの場合はtype, removeは不要
const reason = process.argv[5];

(async () => {
    try {
        if (!command) {
            console.log(`
使用法:
  node tools/blacklist.js list
  node tools/blacklist.js add <ID> <user|guild> [reason]
  node tools/blacklist.js remove <ID>
`);
            process.exit(0);
        }

        if (command === 'list') {
            const list = await getBlacklist();
            if (list.length === 0) {
                console.log('ブラックリストは空です。');
            } else {
                console.log('--- ブラックリスト ---');
                list.forEach(item => {
                    const date = new Date(item.timestamp).toLocaleString();
                    console.log(`${item.type.toUpperCase().padEnd(6)} | ID: ${item.id.padEnd(20)} | Date: ${date} | Reason: ${item.reason || 'N/A'}`);
                });
            }
        } else if (command === 'add') {
            if (!targetId || !typeOrReason) {
                console.error('エラー: IDとタイプ(user/guild)を指定してください。');
                process.exit(1);
            }
            const type = typeOrReason.toLowerCase();
            if (type !== 'user' && type !== 'guild') {
                console.error('エラー: タイプは "user" または "guild" で指定してください。');
                process.exit(1);
            }
            await addToBlacklist(targetId, type, reason || '');
            console.log(`ID: ${targetId} をブラックリストに追加しました。`);
        } else if (command === 'remove') {
            if (!targetId) {
                console.error('エラー: 削除するIDを指定してください。');
                process.exit(1);
            }
            await removeFromBlacklist(targetId);
            console.log(`ID: ${targetId} をブラックリストから削除しました。`);
        } else {
            console.error(`不明なコマンド: ${command}`);
        }

    } catch (error) {
        console.error('エラーが発生しました:', error);
    } finally {
        await closeDatabase();
        rl.close();
        process.exit(0);
    }
})();
