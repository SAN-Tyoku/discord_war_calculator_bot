require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const sqlite3 = require('sqlite3');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '..', 'config.db');

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

// DB内の全ギルドIDを取得する
function getAllGuildIdsFromDb(db) {
    return new Promise((resolve, reject) => {
        db.all("SELECT DISTINCT guild_id FROM guild_configs", [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows.map(row => row.guild_id));
        });
    });
}

// 指定したギルドIDのデータを削除する
function deleteGuildData(db, guildId) {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM guild_configs WHERE guild_id = ?", [guildId], function(err) {
            if (err) return reject(err);
            resolve(this.changes); // 削除された行数を返す
        });
    });
}

async function main() {
    try {
        console.log('現在のギルドリストを取得するためログイン中...');
        await client.login(process.env.BOT_TOKEN);
    } catch (error) {
        console.error('ログインに失敗しました:', error);
        process.exit(1);
    }
}

client.once('ready', async () => {
    console.log(`ログインしました: ${client.user.tag}`);
    
    const currentGuilds = new Set(client.guilds.cache.map(g => g.id));
    console.log(`Botは現在 ${currentGuilds.size} 個のギルドに参加しています。`);

    const db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error('データベースを開けませんでした:', err);
            client.destroy();
            process.exit(1);
        }
    });

    try {
        const dbGuildIds = await getAllGuildIdsFromDb(db);
        console.log(`データベース内で ${dbGuildIds.length} 個のギルドの設定データが見つかりました。`);

        const guildsToRemove = dbGuildIds.filter(id => !currentGuilds.has(id));
        
        if (guildsToRemove.length === 0) {
            console.log('古いデータは見つかりませんでした。データベースはクリーンです。');
        } else {
            console.log(`Botが参加していない ${guildsToRemove.length} 個のギルドの設定データが見つかりました。クリーンアップを実行します...`);
            
            let totalDeletedRows = 0;
            for (const guildId of guildsToRemove) {
                const changes = await deleteGuildData(db, guildId);
                totalDeletedRows += changes;
                console.log(` - ギルドID: ${guildId} の設定を削除しました (${changes} 行)`);
            }
            
            console.log(`クリーンアップが完了しました。削除された行の合計: ${totalDeletedRows}`);
        }

    } catch (error) {
        console.error('クリーンアップ処理中にエラーが発生しました:', error);
    } finally {
        db.close();
        client.destroy();
        process.exit(0);
    }
});

main();
