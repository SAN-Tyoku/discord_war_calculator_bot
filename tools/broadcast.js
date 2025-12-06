require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { getGuildConfig } = require('../src/database');

/**
 * 全サーバーにお知らせを送信します。
 * @param {import('discord.js').Client} client 
 * @param {string} messageToSend 
 */
async function broadcast(client, messageToSend) {
    console.log('アナウンスの送信を開始します...');

    const guilds = client.guilds.cache;
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (const [guildId, guild] of guilds) {
        try {
            const config = await getGuildConfig(guildId);
            let targetChannel = null;

            // 優先順位1: 許可されたチャンネルのリストから最初の1つを取得
            if (config.allowed_channels && config.allowed_channels.length > 0) {
                // 存在確認
                for (const channelId of config.allowed_channels) {
                    const channel = guild.channels.cache.get(channelId);
                    if (channel && channel.viewable && channel.permissionsFor(guild.members.me).has('SendMessages')) {
                        targetChannel = channel;
                        break;
                    }
                }
            }

            // 優先順位2: 全許可モードならシステムチャンネル
            if (!targetChannel && (config.channel_mode || 'allow-all') === 'allow-all') {
                if (guild.systemChannel && guild.systemChannel.viewable && guild.systemChannel.permissionsFor(guild.members.me).has('SendMessages')) {
                    targetChannel = guild.systemChannel;
                }
            }

            if (targetChannel) {
                await targetChannel.send(`【お知らせ】\n${messageToSend}`);
                console.log(`[OK] ${guild.name} -> #${targetChannel.name}`);
                successCount++;
            } else {
                console.log(`[SKIP] ${guild.name} (適切な送信先チャンネルがありません)`);
                skipCount++;
            }

        } catch (error) {
            console.error(`[ERROR] ${guild.name}: ${error.message}`);
            failCount++;
        }
        
        // API制限考慮のウェイト
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n--- 完了 ---');
    console.log(`成功: ${successCount}, スキップ: ${skipCount}, 失敗: ${failCount}`);
}

if (require.main === module) {
    const messageToSend = process.argv[2];

    if (!messageToSend) {
        console.log('使用法: node tools/broadcast.js "送信するメッセージ"');
        process.exit(0);
    }

    const client = new Client({
        intents: [GatewayIntentBits.Guilds]
    });

    client.once('ready', async () => {
        console.log(`Logged in as ${client.user.tag}`);
        await broadcast(client, messageToSend);
        
        // スタンドアロン実行時は終了する
        process.exit(0);
    });

    client.login(process.env.BOT_TOKEN);
}

module.exports = { broadcast };