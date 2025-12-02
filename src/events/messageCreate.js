const { Events } = require('discord.js');
const { getGuildConfig, isBlacklisted } = require('../database');
const { getQuestions } = require('../utils');
const logger = require('../../logger');
const { sessions, processApiCalculation, closeThread, startWarSession } = require('../sessionManager');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot) return;

        // ブラックリストチェック
        if (await isBlacklisted(message.author.id) || (message.guildId && await isBlacklisted(message.guildId))) {
            return;
        }

        if (message.content.startsWith('!') && message.guild) {
            const isOwner = message.guild.ownerId === message.author.id;
            const isAdmin = message.member?.permissions.has('Administrator');

            if ((isOwner || isAdmin) && message.content.startsWith('!force_war')) {
                const args = message.content.split(/\s+/);
                const command = args[0];

                if (command === '!force_war') {
                    if (args.length < 4) {
                        await message.reply('使用法: `!force_war <fielder|pitcher> <year> <league>`');
                        return;
                    }
                    const subCommand = args[1].toLowerCase();
                    const year = parseInt(args[2]);
                    const league = args[3].toUpperCase();

                    if (!['fielder', 'pitcher'].includes(subCommand) || isNaN(year)) {
                        await message.reply('!!!入力形式が正しくありません。!!!');
                        return;
                    }
                    const config = await getGuildConfig(message.guildId);

                    const mode = config.channel_mode || 'allow-all';
                    if (mode === 'restricted') {
                        const allowed = config.allowed_channels || [];
                        if (!allowed.includes(message.channelId)) {
                            logger.warn(`[Access Denied] ${message.author.tag} tried to use !force_war in restricted channel ${message.channel.name}.`);
                            return; 
                        }
                    }

                    await startWarSession(message, subCommand, year, league, config);
                    return;
                }
            }
        }

        const session = sessions.get(message.channelId);
        if (session) {
            if (message.author.id !== session.userId) return;

            const messageContent = message.content.trim();
            logger.debug(`[Input] User: ${message.author.tag}, Content: ${messageContent}, Current Step: ${session.step}`);

            if (messageContent === '!end') {
                await message.reply('セッションを強制終了しました。');
                sessions.delete(message.channelId);
                await closeThread(message.channel);
                return;
            }

            if (messageContent === '!back') {
                if (session.step > 0) {
                    session.step--;
                    const questions = getQuestions(session.subCommand);
                    const previousQ = questions[session.step];
                    delete session.answers[questions[session.step + 1].key];
                    session.lastUpdate = Date.now();
                    sessions.set(message.channelId, session);
                    await message.reply(`一つ前の質問に戻りました。**(${session.step + 1}/${questions.length})** ${previousQ.q}`);
                } else {
                    await message.reply('これ以上前に戻ることはできません。');
                }
                return;
            }

            if (Date.now() - session.lastUpdate > 600000) {
                await message.reply("タイムアウトしました。");
                sessions.delete(message.channelId);
                await closeThread(message.channel);
                return;
            }

            const questions = getQuestions(session.subCommand);
            const currentQ = questions[session.step];
            if (!currentQ) return;

            let val = messageContent.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

            if (isNaN(val) || val.trim() === '') {
                await message.reply("!!!数字を入力してください。(中断する場合は `!end` または `!back`)!!!");
                return;
            }
            if (parseFloat(val) < 0) {
                await message.reply("!!!正の数を入力してください。!!!");
                return;
            }

            session.answers[currentQ.key] = parseFloat(val);
            session.step++;
            session.lastUpdate = Date.now();
            logger.debug(`[Session] Updated answers: ${JSON.stringify(session.answers)}`);

            if (session.step < questions.length) {
                const nextQ = questions[session.step];
                sessions.set(message.channelId, session);
                await message.channel.send(`**(${session.step + 1}/${questions.length})** ${nextQ.q}`);
            } else {
                await message.channel.send("計算中...");
                await processApiCalculation(message, session);
            }
        } else {
            // セッションがないが、Botが作成したWAR計算スレッドでの発言の場合
            if (message.channel.isThread() &&
                message.channel.ownerId === message.client.user.id &&
                message.channel.name.startsWith('WAR計算-')) {

                await message.reply('このセッションは有効期限切れか、終了しています。新しい計算を行うには、再度コマンドを実行してください。');
                await closeThread(message.channel);
            }
        }
    },
};