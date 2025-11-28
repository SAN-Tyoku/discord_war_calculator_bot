require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const logger = require('../logger');
const { updateCommands } = require('./deploy');

require('./database');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        logger.info(`[Loader] コマンド ${command.data.name} をロードしました。`);
    } else {
        logger.warn(`[WARNING] ${filePath} のコマンドには、必須の "data" または "execute" プロパティがありません。`);
    }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
    logger.info(`[Loader] イベント ${event.name} をロードしました。`);
}

// BotがDiscord APIに接続し、準備ができたときに一度コマンドを更新
client.once('ready', async () => {
    logger.info(`[System] ${client.user.tag} としてログインしました！ (Log Level: ${logger.level})`);
    const appId = process.env.APPLICATION_ID;
    const token = process.env.BOT_TOKEN;

    if (appId && token) {
        await updateCommands(token, appId);
    } else {
        logger.error('[System] APPLICATION_ID または BOT_TOKEN が .env ファイルに設定されていません。コマンドは更新されません。');
    }
});


const token = process.env.BOT_TOKEN;
if (!token) {
    logger.error('BOT_TOKENが設定されていません。.envファイルを確認してください。');
} else {
    client.login(token);
}