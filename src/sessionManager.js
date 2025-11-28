const { ChannelType, ThreadAutoArchiveDuration, EmbedBuilder } = require('discord.js');
const logger = require('../logger');
const { getQuestions, calculateWarWithApi } = require('./utils');

const sessions = new Map();

/**
 * WAR計算セッションを開始します。
 * 計算用のスレッドを作成し、最初の質問を投稿します。
 * @param {import('discord.js').ChatInputCommandInteraction | import('discord.js').Message} trigger - コマンドの起点となったインタラクションまたはメッセージ。
 * @param {'fielder' | 'pitcher'} subCommand - 計算対象（野手または投手）。
 * @param {number} year - 対象年度。
 * @param {string} league - 対象リーグ。
 * @param {object} config - サーバー設定オブジェクト。
 * @param {object} [initialSessionData={}] - セッションに事前入力するデータ (answers, stepなど)。
 * @returns {Promise<void>}
 */
async function startWarSession(trigger, subCommand, year, league, config, initialSessionData = {}) {
    const isInteraction = trigger.isCommand?.() || trigger.isChatInputCommand?.();
    const user = isInteraction ? trigger.user : trigger.author;
    const channel = trigger.channel;

    try {
        if (isInteraction) {
             if (!trigger.isModalSubmit() && !trigger.deferred) {
                await trigger.deferReply({ ephemeral: true });
            }
        }
        
        const thread = await channel.threads.create({
            name: `WAR計算-${user.username}`,
            autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
            type: ChannelType.PrivateThread,
            reason: 'WAR Calculation Session'
        });

        logger.debug(`[Session] Created private thread: ${thread.id} for user: ${user.id}`);

        await thread.members.add(user.id);

        if (isInteraction) {
            const replyContent = `ポジション別試合数を入力するため、プライベートスレッドを作成しました。こちらへどうぞ ▶ <#${thread.id}>`;
            if (trigger.isModalSubmit()) {
                await trigger.followUp({ content: replyContent, ephemeral: true });
            } else {
                await trigger.editReply({ content: replyContent });
            }
        }

        let roleMention = "";
        if (config.notify_role_id) roleMention = `\n(通知: <@&${config.notify_role_id}>)`;

        const questions = getQuestions(subCommand);
        const session = {
            userId: user.id,
            subCommand,
            year,
            league,
            step: 0,
            answers: {},
            ...initialSessionData,
            lastUpdate: Date.now()
        };
        
        sessions.set(thread.id, session);
        logger.debug(`[Session] Started new session: ${JSON.stringify(session)}`);
        await thread.send(`${roleMention} <@${user.id}> **(${session.step + 1}/${questions.length})** ${questions[session.step].q}\n(中断したい場合は "!end" や "!back" と入力してください)`);

    } catch (error) {
        logger.error(`スレッド作成中にエラーが発生しました: ${error.message}`);
        if (isInteraction) {
            if (trigger.replied || trigger.deferred) {
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
    let requestBody = {};
    try {
        requestBody = {
            calcType: session.subCommand,
            year: session.year,
            league: session.league,
            ...session.answers
        };

        logger.debug(`[API] Request Body: ${JSON.stringify(requestBody)}`);
        const response = await calculateWarWithApi(requestBody);
        logger.debug(`[API] Response Status: ${response.status}`);
        logger.debug(`[API] Response Data: ${JSON.stringify(response.data)}`);
        
        if (typeof response.data === 'object') {
            const statLabels = {
				'war': 'WAR',
				'woba': 'wOBA',
				'batting': '打撃貢献',
				'baserunning': '走塁貢献',
				'fielding': '守備貢献',
				'fip': 'FIP',
				'era': '防御率',
				'whip': 'WHIP'
			};
            
            const title = `WAR計算結果 (${session.year}年 / ${session.league}リーグ)`;

            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle(title)
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
        logger.error(`[Error Context] Request Body: ${JSON.stringify(requestBody)}`);
        
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
        logger.debug(`[Session] Thread ${thread.id} closed and archived.`);
    } catch (e) { logger.error(`スレッドのアーカイブに失敗しました: ${e.message}`); }
}

module.exports = {
    sessions,
    startWarSession,
    processApiCalculation,
    closeThread,
};
