require('dotenv').config();
const sqlite3 = require('sqlite3');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '..', 'config.db');

const args = process.argv.slice(2);
const mode = args[0]; // 'preset' or 'custom'
const value = args[1]; // 'servers', 'members' or 'Any text'
const type = args[2];  // 'playing', 'watching', 'listening' (optional, for custom)

if (!mode || !value) {
    console.log('使用法:');
    console.log('  node tools/set_status.js preset <servers|members>');
    console.log('  node tools/set_status.js custom "<ステータステキスト>" [playing|watching|listening|competing]');
    process.exit(1);
}

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('データベースを開けませんでした:', err);
        process.exit(1);
    }
});

const config = {
    mode: mode,
    value: value,
    type: type || 'playing' // デフォルトは 'playing'
};

const valueToStore = JSON.stringify(config);
const guildId = 'SYSTEM'; // グローバル設定用
const key = 'status_config';

db.run(`CREATE TABLE IF NOT EXISTS guild_configs (
    guild_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    PRIMARY KEY (guild_id, key)
)`, (err) => {
    if (err) {
        console.error('テーブル作成に失敗しました:', err);
        db.close();
        process.exit(1);
    }

    const stmt = "REPLACE INTO guild_configs (guild_id, key, value) VALUES (?, ?, ?)";
    db.run(stmt, [guildId, key, valueToStore], function(err) {
        if (err) {
            console.error('ステータス設定の更新に失敗しました:', err);
        } else {
            console.log('ステータス設定が正常に更新されました！');
            console.log(`  モード:  ${mode}`);
            console.log(`  値:    ${value}`);
            if (type) console.log(`  タイプ:  ${type}`);
            console.log('\nBotはこの変更を10分以内（または次回の再起動時）に反映します。');
        }
        db.close();
    });
});
