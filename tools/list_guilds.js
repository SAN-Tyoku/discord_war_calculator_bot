require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const sqlite3 = require('sqlite3');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '..', 'config.db');

// DBから設定が存在するギルドIDを取得する関数
function getConfiguredGuildIds() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                // DBファイルがない等の場合は空配列を返す
                if (err.code === 'SQLITE_CANTOPEN') return resolve(new Set());
                return reject(err);
            }
        });

        db.all("SELECT DISTINCT guild_id FROM guild_configs", [], (err, rows) => {
            if (err) {
                // テーブルがない場合なども考慮
                db.close();
                return resolve(new Set());
            }
            const ids = new Set(rows.map(row => row.guild_id));
            db.close();
            resolve(ids);
        });
    });
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

async function main() {
    try {
        const configuredGuilds = await getConfiguredGuildIds();
        console.log('ログイン中...');
        
        await client.login(process.env.BOT_TOKEN);
    } catch (error) {
        console.error('ログインに失敗しました:', error);
        process.exit(1);
    }
}

client.once('ready', async () => {
    console.log(`ログインしました: ${client.user.tag}`);
    console.log(`参加ギルド数: ${client.guilds.cache.size}`);
    console.log('-'.repeat(80));

    const configuredGuilds = await getConfiguredGuildIds();
    const guilds = client.guilds.cache;

    // データの取得と整形
    const guildDataPromises = guilds.map(async (guild) => {
        let ownerName = '不明';
        try {
            const owner = await guild.fetchOwner();
            ownerName = owner.user.tag;
        } catch (e) {
            ownerName = `取得失敗 (${e.message})`;
        }

        const joinedDate = guild.joinedAt ? guild.joinedAt.toISOString().split('T')[0] : '不明';
        const hasConfig = configuredGuilds.has(guild.id) ? 'あり' : 'なし';

        return {
            name: guild.name,
            id: guild.id,
            memberCount: guild.memberCount,
            owner: `${ownerName} (ID: ${guild.ownerId})`,
            joinedAt: joinedDate,
            hasConfig: hasConfig
        };
    });

    const results = await Promise.all(guildDataPromises);

    // メンバー数順（多い順）にソート
    results.sort((a, b) => b.memberCount - a.memberCount);

    // 出力
    results.forEach((g, index) => {
        console.log(`[${index + 1}] ${g.name}`);
        console.log(`    ID:          ${g.id}`);
        console.log(`    メンバー数:  ${g.memberCount}`);
        console.log(`    オーナー:    ${g.owner}`);
        console.log(`    参加日:      ${g.joinedAt}`);
        console.log(`    設定データ:  ${g.hasConfig}`);
        console.log('-'.repeat(40));
    });

    console.log('\n完了しました。');
    process.exit(0);
});

main();
