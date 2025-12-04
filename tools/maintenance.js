require('dotenv').config();
const { updateGuildConfig, getGuildConfig, closeDatabase } = require('../src/database');

const args = process.argv.slice(2);
const command = args[0]; // 'on', 'off', or 'status'

if (!['on', 'off', 'status'].includes(command)) {
    console.log(`
使用法:
  node tools/maintenance.js on    : メンテナンスモードを有効にする
  node tools/maintenance.js off   : メンテナンスモードを無効にする
  node tools/maintenance.js status: 現在の状態を確認する
`);
    process.exit(1);
}

const SYSTEM_ID = 'SYSTEM';
const KEY = 'maintenance_mode';

(async () => {
    try {
        if (command === 'status') {
            const config = await getGuildConfig(SYSTEM_ID);
            const isMaintenance = config[KEY] === true;
            console.log(`現在のステータス: ${isMaintenance ? '🔴 メンテナンス中 (ON)' : 'mn 🟢 通常稼働中 (OFF)'}`);
        } else if (command === 'on') {
            await updateGuildConfig(SYSTEM_ID, KEY, true);
            console.log('メンテナンスモードを [ON] に切り替えました。');
            console.log('一般ユーザーの操作はブロックされます。HOST_USER_ID のみが操作可能です。');
        } else if (command === 'off') {
            // nullを渡すとキー自体を削除できる仕様を利用
            await updateGuildConfig(SYSTEM_ID, KEY, null); 
            console.log('メンテナンスモードを [OFF] に切り替えました。');
            console.log('通常稼働に戻りました。');
        }
    } catch (error) {
        console.error('エラーが発生しました:', error);
    } finally {
        await closeDatabase();
        process.exit(0);
    }
})();