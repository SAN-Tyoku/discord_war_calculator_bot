require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const logger = require('../logger');
const { getDefaultGameYear, MIN_YEAR } = require('./utils');

/**
 * アプリケーションのスラッシュコマンドをDiscordに登録・更新します。
 * 'src/commands' ディレクトリ内のすべてのコマンドファイルを動的に読み込みます。
 * @param {string} token - Discord Botのトークン。
 * @param {string} applicationId - Discord BotのアプリケーションID。
 * @returns {Promise<void>}
 */
async function updateCommands(token, applicationId) {
    logger.info('[System] コマンド定義の更新チェックを開始します。');
    
    try {
        const commands = [];
        const commandsPath = path.join(__dirname, 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
            } else {
                logger.warn(`[WARNING] ${filePath} のコマンドには、必須の "data" または "execute" プロパティがありません。`);
            }
        }
        
        const maxYear = getDefaultGameYear();
        const calcWarCommand = commands.find(cmd => cmd.name === 'calculate_war');
        if (calcWarCommand) {
            for (const subcommand of calcWarCommand.options.filter(opt => opt.type === 1)) {
                const yearOption = subcommand.options.find(opt => opt.name === 'year');
                if (yearOption) {
                    yearOption.max_value = maxYear;
                    yearOption.description = `年度 (${MIN_YEAR}〜${maxYear})`;
                }
            }
        }

        const rest = new REST({ version: '10' }).setToken(token);
        
        logger.info(`[System] ${commands.length}個のアプリケーションコマンドの更新を開始しました。`);

        await rest.put(
            Routes.applicationCommands(applicationId),
            { body: commands },
        );

        logger.info(`[System] アプリケーションコマンドの定義を更新しました。 (Max Year: ${maxYear})`);

    } catch (error) {
        logger.error(`[System] コマンド定義の更新に失敗しました: ${error.message}`);
    }
}

if (require.main === module) {
    const token = process.env.BOT_TOKEN;
    const appId = process.env.APPLICATION_ID;

    if (!token || !appId) {
        logger.error('[System] BOT_TOKEN または APPLICATION_ID が .env ファイルに設定されていません。');
    } else {
        updateCommands(token, appId);
    }
}

module.exports = { updateCommands };
