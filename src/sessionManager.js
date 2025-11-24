const { ChannelType, ThreadAutoArchiveDuration, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const logger = require('../logger');
const { getQuestions } = require('./utils');

//セッションをメモリ上で管理するためのMap
const sessions = new Map();

/**
 * WAR計算セッションを開始します。
 * 計算用のスレッドを作成し、最初の質問を投稿します。
 * @param {import('discord.js').ChatInputCommandInteraction | import('discord.js').Message} trigger - コマンドの起点となったインタラクションまたはメッセージ。
 * @param {'fielder' | 'pitcher'} subCommand - 計算対象（野手または投手）。
 * @param {number} year - 対象年度。
 * @param {string} league - 対象リーグ。
 * @param {object} config - サーバー設定オブジェクト。
 * @returns {Promise<void>}
 */
async function startWarSession(trigger, subCommand, year, league, config) {
    const isInteraction = trigger.isCommand?.() || trigger.isChatInputCommand?.();
    const user = isInteraction ? trigger.user : trigger.author;
    const channel = trigger.channel;

    try {
        // スラッシュコマンドの場合は、ephemeral（一時的）な応答を準備
        if (isInteraction) await trigger.deferReply({ ephemeral: true });
        
        const thread = await channel.threads.create({
            name: `WAR計算-${user.username}`,
            autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
            type: ChannelType.PrivateThread, // ここをPrivateThreadに変更
            reason: 'WAR Calculation Session'
        });

        // プライベートスレッドにユーザーを招待
        await thread.members.add(user.id);

        // スラッシュコマンドの場合のみ、本人にだけ見えるメッセージでスレッドへのリンクを通知
        if (isInteraction) {
            const replyContent = `プライベートスレッドを作成しました。こちらへどうぞ ▶ <#${thread.id}>`;
            await trigger.editReply({ content: replyContent });
        }
        // メッセージコマンドの場合は、元のチャンネルには何も返信しない

        let roleMention = "";
        if (config.notify_role_id) roleMention = `\n(通知: <@&${config.notify_role_id}>)`;

        const questions = getQuestions(subCommand);
        const session = { userId: user.id, subCommand, year, league, step: 0, answers: {}, lastUpdate: Date.now() };
        
        sessions.set(thread.id, session);
        await thread.send(`${roleMention} <@${user.id}> **(1/${questions.length})** ${questions[0].q}\n(中断したい場合は "!end" や "!back" と入力してください)`);

    } catch (error) {
        logger.error(`スレッド作成中にエラーが発生しました: ${error.message}`);
        if (isInteraction) {
            if (trigger.deferred || trigger.replied) {
                await trigger.followUp({ content: '!!!エラーが発生しました。!!!', ephemeral: true });
            } else {
                await trigger.reply({ content: '!!!エラーが発生しました。!!!', ephemeral: true });
            }
        } else {
            await trigger.reply('!!!エラー: スレッドを作成できませんでした。!!!');
        }
    }
}

/**
 * APIサーバーと通信してWAR計算を実行し、結果を投稿します。
 * 処理完了後、セッションファイルとスレッドをクリーンアップします。
 * @param {import('discord.js').Message} message - ユーザーからの最後の回答メッセージ。
 * @param {object} session - 現在の計算セッション情報。
 * @returns {Promise<void>}
 */
async function processApiCalculation(message, session) {
    const threadId = message.channelId;
    try {
        const apiUrl = process.env.API_URL;
        if (!apiUrl) throw new Error("API_URL未設定");

        const separator = apiUrl.includes('?') ? '&' : '?';
        const fullUrl = `${apiUrl}${separator}endpoint=calculate`;

        const requestBody = {
            calcType: session.subCommand,
            year: session.year,
            league: session.league,
            ...session.answers
        };

        const config = { headers: { 'Content-Type': 'application/json' } };
        if (process.env.BASIC_ID && process.env.BASIC_PASS) {
            config.auth = { username: process.env.BASIC_ID, password: process.env.BASIC_PASS };
        }

        const response = await axios.post(fullUrl, requestBody, config);
        
        if (typeof response.data === 'object') {
            const statLabels = {
                'WAR': 'WAR (総合)', 'oWAR': 'oWAR (攻撃)', 'dWAR': 'dWAR (守備)', 'RAR': 'RAR',
                'BatR': '打撃', 'BsR': '走塁', 'FldR': '守備', 'PosR': '守備位置', 'RepR': '代替補償',
                'FIP': 'FIP', 'RA9': 'RA/9'
            };

            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle(`WAR計算結果 (${session.year}年 / ${session.league}リーグ)`)
                .setDescription(`**${session.subCommand === 'fielder' ? '野手' : '投手'}** の計算が完了しました。`)
                .setTimestamp();
            
            for (const [key, value] of Object.entries(response.data)) {
                const name = statLabels[key] || key;
                const valueStr = typeof value === 'number' ? value.toFixed(3) : String(value);
                embed.addFields({ name: name, value: valueStr, inline: true });
            }
            await message.channel.send({ content: '**計算完了!**', embeds: [embed] });

        } else {
            const resultText = String(response.data);
            await message.channel.send(`**計算完了!**\n\\${resultText.slice(0, 1900)}\\`);
        }

    } catch (error) {
        let technicalErrorMsg = error.message;
        if (error.response) {
            technicalErrorMsg = `Status ${error.response.status}: ${JSON.stringify(error.response.data)}`;
        }
        logger.error(`API計算処理でエラーが発生しました: ${technicalErrorMsg}`);
        
        await message.channel.send('!!!APIエラー: 計算サーバーへの接続に失敗しました。管理者に連絡してください。!!!');
    } finally {
        if (sessions.has(threadId)) sessions.delete(threadId);
        await closeThread(message.channel);
    }
}

/**
 * 指定されたスレッドをロックしてアーカイブします。
 * @param {import('discord.js').ThreadChannel} thread - 対象のスレッド。
 * @returns {Promise<void>}
 */
async function closeThread(thread) {
    try {
        await thread.setLocked(true);
        await thread.setArchived(true);
    } catch (e) { logger.error(`スレッドのアーカイブに失敗しました: ${e.message}`); }
}

module.exports = {
    sessions,
    startWarSession,
    processApiCalculation,
    closeThread,
};
