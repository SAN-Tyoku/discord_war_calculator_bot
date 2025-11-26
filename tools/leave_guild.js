require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const guildIdToLeave = process.argv[2]; // コマンドライン引数からギルドIDを取得

if (!guildIdToLeave) {
    console.error('エラー: ギルドIDを引数として指定してください。');
    console.error('使用法: node tools/leave_guild.js <GUILD_ID>');
    process.exit(1);
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

async function main() {
    try {
        console.log('ログイン中...');
        await client.login(process.env.BOT_TOKEN);
    } catch (error) {
        console.error('ログインに失敗しました:', error);
        process.exit(1);
    }
}

client.once('ready', async () => {
    console.log(`ログインしました: ${client.user.tag}`);
    
    try {
        const guild = client.guilds.cache.get(guildIdToLeave);
        if (guild) {
            console.log(`ギルドから退出を試みています: "${guild.name}" (${guild.id})...`);
            await guild.leave();
            console.log(`ギルド "${guild.name}" (${guild.id}) から正常に退出しました。`);
        } else {
            console.error(`エラー: Botは指定されたギルドID (${guildIdToLeave}) に参加していません。`);
        }
    } catch (error) {
        console.error(`ギルド ${guildIdToLeave} からの退出に失敗しました:`, error);
    } finally {
        client.destroy();
        process.exit(0);
    }
});

main();
