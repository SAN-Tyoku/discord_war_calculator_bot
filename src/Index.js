// .envファイルから環境変数を読み込む
require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const logger = require('../logger');

// データベースの初期化を開始
require('./database');

// Discordクライアントのインスタンスを作成
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

// コマンドを格納するためのCollectionを作成
client.commands = new Collection();

// 'commands' ディレクトリからコマンドファイルを動的に読み込む
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // 有効なコマンドファイルであるかを確認
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        logger.info(`[Loader] コマンド ${command.data.name} をロードしました。`);
    } else {
        logger.warn(`[WARNING] ${filePath} のコマンドには、必須の "data" または "execute" プロパティがありません。`);
    }
}

// 'events' ディレクトリからイベントハンドラを動的に読み込む
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

// Botトークンを使用してDiscordにログイン
const token = process.env.BOT_TOKEN;
if (!token) {
    logger.error('BOT_TOKENが設定されていません。.envファイルを確認してください。');
} else {
    client.login(token);
}
