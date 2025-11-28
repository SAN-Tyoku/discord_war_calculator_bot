require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const channelId = process.argv[2];

if (!channelId) {
    console.error('Usage: node tools/debug_channel.js <CHANNEL_ID>');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Trying to fetch channel ID: ${channelId}...`);

    try {
        // 1. Client全体からFetch (API問い合わせ)
        const channel = await client.channels.fetch(channelId, { force: true });
        
        console.log('\n--- Channel Found ---');
        console.log(`Name: ${channel.name}`);
        console.log(`Type: ${channel.type}`);
        console.log(`Guild: ${channel.guild.name} (${channel.guild.id})`);
        
        // 2. 権限チェック
        const permissions = channel.permissionsFor(client.user);
        console.log('\n--- Permissions ---');
        console.log(`View Channel: ${permissions.has('ViewChannel')}`);
        console.log(`Send Messages: ${permissions.has('SendMessages')}`);
        console.log(`Embed Links: ${permissions.has('EmbedLinks')}`);
        console.log(`Administrator: ${permissions.has('Administrator')}`);

    } catch (error) {
        console.error('\n!!! Error fetching channel !!!');
        console.error(`Error Name: ${error.name}`);
        console.error(`Error Message: ${error.message}`);
        
        if (error.message === 'Unknown Channel') {
            console.error('\n[診断]');
            console.error('Botはこのチャンネルを見つけられませんでした。');
            console.error('考えられる原因:');
            console.error('1. IDが間違っている。');
            console.error('2. Botがこのチャンネルのあるサーバーに参加していない。');
            console.error('3. Botに「チャンネルを見る」権限がない。');
        }
    } finally {
        client.destroy();
    }
});

client.login(process.env.BOT_TOKEN);
