const { ChannelType, ThreadAutoArchiveDuration, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../logger');
const { getQuestions, calculateWarWithApi } = require('./utils');
const { getGuildConfig } = require('./database');

const sessions = new Map();

// 定期的に古いセッションを削除 (10分ごとにチェック、1時間以上放置されたものを削除)
setInterval(() => {
    cleanupSessions();
}, 10 * 60 * 1000);

function cleanupSessions() {
    const now = Date.now();
    const timeout = 60 * 60 * 1000; // 1時間

    for (const [threadId, session] of sessions.entries()) {
        if (now - session.lastUpdate > timeout) {
            sessions.delete(threadId);
            logger.debug(`[Session] Cleaned up expired session: ${threadId}`);
        }
    }
}

/**
 * WAR計算セッションを開始します。
 * @param {import('discord.js').ChatInputCommandInteraction | import('discord.js').Message} trigger
 * @param {'fielder' | 'pitcher'} subCommand
 * @param {number} year
 * @param {string} league
 * @param {object} config
 * @param {object} [initialSessionData={}]
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
            lastUpdate: Date.now(),
            lastResultMsgId: null // 最後に表示した結果メッセージのIDを保持
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
 * @param {import('discord.js').Message | import('discord.js').Interaction} target - 応答対象のメッセージまたはインタラクション。
 * @param {object} session - 現在の計算セッション情報。
 * @returns {Promise<void>}
 */
async function processApiCalculation(target, session) {
    // targetがInteraction(Modal/Button/Command)かMessageかを判定
    const isInteraction = target.isRepliable?.(); 
    
    // Ephemeralかどうかは、Interactionの場合かつ、元々がEphemeralで始まっていれば維持したいが、
    // ここでは「Paste入力由来のセッションかどうか」などで判定するのが確実。
    // ただし、sessionオブジェクトにフラグを持たせるのが簡単。
    const isEphemeral = session.isEphemeral || false;

    // 通常スレッドの場合のみ、古いコンポーネントを無効化
    if (!isEphemeral && session.lastResultMsgId) {
        try {
            const channel = target.channel || target.message?.channel;
            if (channel) {
                const oldMsg = await channel.messages.fetch(session.lastResultMsgId);
                if (oldMsg && oldMsg.editable) {
                    await oldMsg.edit({ components: [] });
                }
            }
        } catch (err) {
            logger.debug(`[Session] Failed to remove components from old message: ${err.message}`);
        }
    }

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
            
            let displayLeague = session.league;
            if (displayLeague === 'A') displayLeague = 'α';
            if (displayLeague === 'B') displayLeague = 'β';

            const title = `WAR計算結果 (${session.year}年 / ${displayLeague}リーグ)`;

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

            const questions = getQuestions(session.subCommand);
            const options = questions.map(q => ({
                label: q.label,
                description: `現在の値: ${session.answers[q.key] ?? 0}`,
                value: q.key
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('recalc_select_field')
                .setPlaceholder('数値を修正して再計算')
                .addOptions(options);
            
            const endButton = new ButtonBuilder()
                .setCustomId('recalc_end_btn')
                .setLabel('終了')
                .setStyle(ButtonStyle.Danger);
            
            const row1 = new ActionRowBuilder().addComponents(selectMenu);
            const row2 = new ActionRowBuilder().addComponents(endButton);

            // 共有機能のチェック
            try {
                const guildId = target.guildId || target.guild?.id;
                if (guildId) {
                    const config = await getGuildConfig(guildId);
                    const val = config.allow_share_result;
                    const isEnabled = (val === true || val === 1 || val === 'true' || val === '1');
                    
                    if (isEnabled) {
                        const shareButton = new ButtonBuilder()
                            .setCustomId('share_result_btn')
                            .setLabel('結果を共有')
                            .setStyle(ButtonStyle.Secondary)
                        row2.addComponents(shareButton);
                    }
                }
            } catch (e) { logger.warn(`Config fetch failed in session: ${e.message}`); }

            const payload = {
                content: '**計算完了!**\n数値を修正して再計算できます。終了する場合は「終了」ボタンを押してください。',
                embeds: [embed],
                components: [row1, row2],
                ephemeral: isEphemeral
            };

            let sentMsg;
            if (isInteraction) {
                // Interactionの場合 (recalc_modal_submit等)
                // 既に deferReply されている場合は followUp
                if (target.deferred || target.replied) {
                     sentMsg = await target.followUp(payload);
                } else {
                     sentMsg = await target.reply({ ...payload, fetchReply: true });
                }
            } else {
                // Messageの場合 (通常入力)
                sentMsg = await target.channel.send(payload);
            }

            // メッセージIDを保存 (Ephemeralの場合はID取得できない場合があるが、followUpなら取れる)
            if (sentMsg && sentMsg.id) {
                session.lastResultMsgId = sentMsg.id;
                sessions.set(target.channelId || target.channel.id, session);
            }

        } else {
            const resultText = String(response.data);
            const msgContent = `**計算完了!**\n\n${resultText.slice(0, 1900)}\n`;
            
            if (isInteraction) {
                 if (target.deferred || target.replied) {
                     await target.followUp({ content: msgContent, ephemeral: isEphemeral });
                 } else {
                     await target.reply({ content: msgContent, ephemeral: isEphemeral });
                 }
            } else {
                await target.channel.send(msgContent);
            }
        }

    } catch (error) {
        const errorMsg = '!!!APIエラー: 計算サーバーへの接続に失敗しました。管理者に連絡してください。!!!';
        if (isInteraction) {
            if (target.deferred || target.replied) {
                await target.followUp({ content: errorMsg, ephemeral: true });
            } else {
                await target.reply({ content: errorMsg, ephemeral: true });
            }
        } else {
            await target.channel.send(errorMsg);
        }
        logger.error(`API Calc Error: ${error.message}`);
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