const { Events, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../../logger');
const { calculateWarWithApi, MIN_YEAR, getDefaultGameYear, parseStatsText, getQuestions } = require('../utils');
const { isBlacklisted, getGuildConfig, addFeedback } = require('../database');
const { sessions, processApiCalculation, closeThread } = require('../sessionManager');

const pasteCache = new Map();

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
        // --- メンテナンスチェック開始 ---
        try {
            const systemConfig = await getGuildConfig('SYSTEM');
            if (systemConfig.maintenance_mode) {
                const hostId = process.env.HOST_USER_ID;
                if (interaction.user.id !== hostId) {
                    const reply = { content: ' **現在メンテナンス中です** \nしばらくお待ちください。', ephemeral: true };
                    if (interaction.deferred || interaction.replied) {
                        await interaction.followUp(reply);
                    } else {
                        await interaction.reply(reply);
                    }
                    return;
                }
            }
        } catch (e) {
            logger.error(`メンテナンスチェックエラー: ${e.message}`);
        }
        // --- メンテナンスチェック終了 ---

		const location = interaction.guild ? `${interaction.guild.name} (${interaction.guildId})` : 'DM';

		// ブラックリストチェック
		if (await isBlacklisted(interaction.user.id) || (interaction.guildId && await isBlacklisted(interaction.guildId))) {
			try {
				if (!interaction.replied && !interaction.deferred) {
					await interaction.reply({ content: 'あなた、またはこのサーバーはBotの利用を制限されています。', ephemeral: true });
				}
			} catch(e) { /* ignore */ }
			return;
		}

		if (interaction.isChatInputCommand()) {
			logger.debug(`[Command] User ${interaction.user.username} (${interaction.user.id}) in ${location} executed command: ${interaction.commandName}`);
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) {
				logger.error(`${interaction.commandName} というコマンドは見つかりませんでした。`);
				return;
			}

			try {
				await command.execute(interaction);
			} catch (error) {
				logger.error(`${interaction.commandName} の実行中にエラーが発生しました。`, error);
				const reply = { content: 'コマンドの実行中にエラーが発生しました！', ephemeral: true };
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp(reply);
				} else {
					await interaction.reply(reply);
				}
			}
		} else if (interaction.isModalSubmit()) {
			logger.debug(`[Modal] User ${interaction.user.username} (${interaction.user.id}) in ${location} submitted modal: ${interaction.customId}`);
			
            if (interaction.customId === 'pasteStatsModal') {
				await interaction.deferReply({ ephemeral: true }); 

				const yearInput = interaction.fields.getTextInputValue('year');
				const leagueInput = interaction.fields.getTextInputValue('league');
				const statsToPaste = interaction.fields.getTextInputValue('statsToPaste');

				const year = parseInt(yearInput, 10);
				const league = leagueInput.toUpperCase();

				if (isNaN(year) || year < MIN_YEAR || year > getDefaultGameYear()) {
					await interaction.followUp({ content: `無効な年度です。${MIN_YEAR}年から${getDefaultGameYear()}年までの値を入力してください。`, ephemeral: true });
					return;
				}
				if (league !== 'A' && league !== 'B') {
					await interaction.followUp({ content: 'リーグは「A」または「B」で入力してください。', ephemeral: true });
					return;
				}

				const isPitcher = /投球回|自責点|被安打|被本塁打|与四球|与死球|奪三振|登板|先発/.test(statsToPaste);
				const calcType = isPitcher ? 'pitcher' : 'fielder';

				const parsedStats = parseStatsText(statsToPaste, calcType);

				if (Object.keys(parsedStats).length === 0) {
					await interaction.followUp({ content: '解析可能な統計データが見つかりませんでした。入力形式を確認してください。', ephemeral: true });
					return;
				}

				if (calcType === 'fielder') {
					pasteCache.set(interaction.user.id, {
						year,
						league,
						stats: parsedStats
					});

					const row = new ActionRowBuilder()
						.addComponents(
							new StringSelectMenuBuilder()
								.setCustomId('select_paste_position')
								.setPlaceholder('メインの守備位置を選択 (全試合出場として計算します)')
								.addOptions(
									{ label: '捕手', value: 'cGame' },
									{ label: '一塁手', value: 'fbGame' },
									{ label: '二塁手', value: 'sbGame' },
									{ label: '三塁手', value: 'tbGame' },
									{ label: '遊撃手', value: 'ssGame' },
									{ label: '左翼手', value: 'lfGame' },
									{ label: '中堅手', value: 'cfGame' },
									{ label: '右翼手', value: 'rfGame' },
									{ label: '指名打者', value: 'dhGame' },
								)
						);
					
					const avg = parsedStats.atBat ? (parsedStats.hit / parsedStats.atBat).toFixed(3).substring(1) : '---';
					const hr = parsedStats.homeRun || 0;

					await interaction.followUp({
						content: `**データ解析成功** (打率 .${avg} / 本塁打 ${hr})\nWARを計算するには、**メインの守備位置**を選択してください。\n※選択したポジションで全試合に出場したとして計算します。`,
						components: [row],
						ephemeral: true
					});
					return;
				}

				await performCalculation(interaction, 'pitcher', year, league, parsedStats);
			} else if (interaction.customId.startsWith('feedbackModal_')) {
                await interaction.deferReply({ ephemeral: true });
                const categoryKey = interaction.customId.replace('feedbackModal_', '');
                const categoryMap = {
                    'bug_report': 'バグ報告',
                    'feature_request': '機能要望',
                    'question': '質問',
                    'other': 'その他'
                };
                const category = categoryMap[categoryKey] || categoryKey;
                const content = interaction.fields.getTextInputValue('content');
                const userTag = interaction.user.tag;

                try {
                    await addFeedback(interaction.user.id, userTag, interaction.guildId, category, content);
                    const config = await getGuildConfig(interaction.guildId);
                    if (config.feedback_channel_id) {
                        const targetId = String(config.feedback_channel_id).trim();
                        let channel = interaction.guild.channels.cache.get(targetId);
                        if (!channel) {
                            try { channel = await interaction.guild.channels.fetch(targetId, { force: true }); } catch (err) {}
                        }
                        if (!channel) {
                            try { channel = await interaction.client.channels.fetch(targetId, { force: true }); } catch (err) {}
                        }
                        if (channel && channel.isTextBased()) {
                            const feedbackEmbed = new EmbedBuilder()
                                .setColor(0xF1C40F)
                                .setTitle('新しいフィードバック')
                                .setAuthor({ name: `${userTag} (${interaction.user.id})`, iconURL: interaction.user.displayAvatarURL() })
                                .addFields({ name: 'カテゴリ', value: category, inline: true }, { name: '内容', value: content })
                                .setTimestamp()
                                .setFooter({ text: `User ID: ${interaction.user.id}` });
                            await channel.send({ embeds: [feedbackEmbed] });
                        }
                    }
                    await interaction.editReply({ content: 'フィードバックを送信しました。ご協力ありがとうございます！' });
                } catch (error) {
                    logger.error(`[Feedback] Error: ${error.message}`);
                    await interaction.editReply({ content: 'エラーが発生しました。' });
                }

            } else if (interaction.customId.startsWith('recalc_modal_')) {
                const key = interaction.customId.replace('recalc_modal_', '');
                const valStr = interaction.fields.getTextInputValue('new_value');
                const val = parseFloat(valStr.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)));

                if (isNaN(val) || val < 0) {
                    await interaction.reply({ content: '有効な正の数値を入力してください。', ephemeral: true });
                    return;
                }

                const session = sessions.get(interaction.channelId);
                if (!session || session.userId !== interaction.user.id) {
                    await interaction.reply({ content: 'セッションが無効か、権限がありません。', ephemeral: true });
                    return;
                }

                session.answers[key] = val;
                session.lastUpdate = Date.now();
                sessions.set(interaction.channelId, session);

                await interaction.reply({ content: '値を更新して再計算します...', ephemeral: session.isEphemeral });
                await processApiCalculation(interaction, session);
            }

		} else if (interaction.isStringSelectMenu()) {
			logger.debug(`[SelectMenu] User ${interaction.user.username} (${interaction.user.id}) in ${location} selected menu: ${interaction.customId}, values: ${JSON.stringify(interaction.values)}`);
			
			if (interaction.customId === 'select_paste_position') {
				const cachedData = pasteCache.get(interaction.user.id);

				if (!cachedData) {
					await interaction.reply({ content: 'セッションの有効期限が切れました。もう一度コマンドを実行してください。', ephemeral: true });
					return;
				}

				await interaction.deferReply({ ephemeral: true }); 

				const { year, league, stats } = cachedData;
				const positionKey = interaction.values[0];
				const games = stats.totalGames || 130;
				stats[positionKey] = games;

				await performCalculation(interaction, 'fielder', year, league, stats);
				pasteCache.delete(interaction.user.id);

			} else if (interaction.customId === 'feedback_category_select') {
                // メッセージの有効期限チェック (5分)
                const messageTime = interaction.message.createdTimestamp;
                const now = Date.now();
                if (now - messageTime > 5 * 60 * 1000) {
                    await interaction.update({ content: 'セッションの有効期限が切れました。もう一度コマンドを実行してください。', components: [] });
                    return;
                }

				const selectedCategoryKey = interaction.values[0];
				const categoryMap = {
					'bug_report': 'バグ報告',
					'feature_request': '機能要望',
					'question': '質問',
					'other': 'その他'
				};
				const categoryLabel = categoryMap[selectedCategoryKey] || selectedCategoryKey;
				
				const modal = new ModalBuilder()
					.setCustomId(`feedbackModal_${selectedCategoryKey}`)
					.setTitle(`フィードバック: ${categoryLabel}`);

				const contentInput = new TextInputBuilder()
					.setCustomId('content')
					.setLabel('詳細内容')
					.setPlaceholder('ここに詳細を入力してください...')
					.setStyle(TextInputStyle.Paragraph)
					.setRequired(true)
					.setMaxLength(1000);

				const row = new ActionRowBuilder().addComponents(contentInput);
				modal.addComponents(row);

				await interaction.showModal(modal);

            } else if (interaction.customId === 'recalc_select_field') {
                const key = interaction.values[0];
                const session = sessions.get(interaction.channelId);
                
                if (!session) {
                    await interaction.reply({ content: 'セッションが切れました。', ephemeral: true });
                    return;
                }
                
                if (session.userId !== interaction.user.id) {
                    await interaction.reply({ content: 'あなたはこのセッションのオーナーではありません。', ephemeral: true });
                    return;
                }

                const questions = getQuestions(session.subCommand);
                const question = questions.find(q => q.key === key);
                const currentVal = session.answers[key] ?? 0;

                const modal = new ModalBuilder()
                    .setCustomId(`recalc_modal_${key}`)
                    .setTitle(`値の修正: ${question.label}`);

                const input = new TextInputBuilder()
                    .setCustomId('new_value')
                    .setLabel(question.q.length > 45 ? question.label + 'を入力' : question.q) // ラベル長制限対策
                    .setValue(String(currentVal))
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const row = new ActionRowBuilder().addComponents(input);
                modal.addComponents(row);

                await interaction.showModal(modal);
            }
		} else if (interaction.isButton()) {
            if (interaction.customId === 'recalc_end_btn') {
                const session = sessions.get(interaction.channelId);
                if (!session) {
                    await interaction.reply({ content: '既に終了しています。', ephemeral: true });
                    try { await closeThread(interaction.channel); } catch {} 
                    return;
                }
                
                if (session.userId !== interaction.user.id) {
                    await interaction.reply({ content: 'あなたはこのセッションのオーナーではありません。', ephemeral: true });
                    return;
                }

                sessions.delete(interaction.channelId);
                await interaction.reply({ content: 'セッションを終了しました。', ephemeral: false });
                // ephemeralの場合はスレッドアーカイブ不要(というかスレッドがない)
                if (!session.isEphemeral && interaction.channel.isThread()) {
                    await closeThread(interaction.channel);
                }
            } else if (interaction.customId === 'share_result_btn') {
                let targetChannel;

                // スレッド内の場合 (対話モード)
                if (interaction.channel.isThread()) {
                    // セッション情報からユーザーを確認
                    const session = sessions.get(interaction.channelId);
                    
                    if (session) { // セッションが有効な場合
                        if (session.userId !== interaction.user.id) {
                            await interaction.reply({ content: '計算を行った本人のみが共有できます。', ephemeral: true });
                            return;
                        }
                    } else { // セッションが有効期限切れの場合
                        // セッション切れでも、Private Thread内でボタンを押せるのは本人か管理者のみ。
                        // かつ、共有EmbedのAuthorにはボタンを押した人の情報が入るので、なりすましリスクは低いと判断。
                        // ここでは、セッション切れでも共有を許可する。
                        logger.debug(`[Share] Session expired for thread ${interaction.channelId}, but allowing share by ${interaction.user.id}.`);
                    }
                    targetChannel = interaction.channel.parent;
                } else {
                    // スレッド外の場合 (Pasteモード - Ephemeral)
                    // Ephemeralのボタンは本人しか見えないため、本人確認は暗黙的に完了している
                    targetChannel = interaction.channel;
                }

                if (!targetChannel) {
                     await interaction.reply({ content: '共有先のチャンネルが見つかりません。', ephemeral: true });
                     return;
                }

                // 共有機能が有効か再チェック (設定変更後のボタン押下対策)
                try {
                    const config = await getGuildConfig(interaction.guildId);
                    const val = config.allow_share_result;
                    const isEnabled = (val === true || val === 1 || val === 'true' || val === '1');
                    
                    if (!isEnabled) {
                        await interaction.reply({ content: '現在、このサーバーでは共有機能が無効化されています。', ephemeral: true });
                        return;
                    }
                } catch (e) {
                    logger.warn(`Config check failed during share: ${e.message}`);
                    // エラー時は安全側に倒して拒否するか、スルーするかだが、ここでは拒否
                    await interaction.reply({ content: '設定確認中にエラーが発生しました。', ephemeral: true });
                    return;
                }

                const embed = interaction.message.embeds[0];
                if (!embed) {
                    await interaction.reply({ content: '共有する結果が見つかりません。', ephemeral: true });
                    return;
                }

                try {
                    // 共有用Embed作成
                    const newEmbed = EmbedBuilder.from(embed)
                        .setAuthor({ 
                            name: `${interaction.user.username} の計算結果`, 
                            iconURL: interaction.user.displayAvatarURL() 
                        });

                    await targetChannel.send({ 
                        content: `<@${interaction.user.id}> がWAR計算結果を共有しました！`,
                        embeds: [newEmbed] 
                    });

                    // ボタンを「共有済み」に更新
                    const disabledButton = ButtonBuilder.from(interaction.component)
                        .setLabel('共有済み')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true);
                    
                    // 全コンポーネントを走査してボタンを更新
                    const newComponents = interaction.message.components.map(row => {
                        const newRow = ActionRowBuilder.from(row);
                        const hasButton = row.components.some(c => c.customId === 'share_result_btn');
                        if (hasButton) {
                            const updatedButtons = newRow.components.map(c => 
                                c.customId === 'share_result_btn' ? disabledButton : c
                            );
                            newRow.setComponents(updatedButtons);
                        }
                        return newRow;
                    });

                    // ボタンの状態を更新
                    await interaction.update({ components: newComponents });

                    // 共有後は用済みなので、スレッドなら強制的にクローズする
                    if (interaction.channel.isThread()) {
                        // 少し待ってからクローズしないと、interaction.updateが完了する前に閉じられてエラーになる可能性があるため
                        // しかしawait interaction.updateしているので基本は大丈夫。
                        // 万全を期すならエラーハンドリング内で。
                        try {
                            await closeThread(interaction.channel);
                        } catch (e) {
                            logger.warn(`共有後のスレッドクローズに失敗: ${e.message}`);
                        }
                    }

                } catch (error) {
                    logger.error(`結果共有エラー: ${error.message}`);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: '共有に失敗しました。Botの権限などを確認してください。', ephemeral: true });
                    }
                }
            }
        }
	},
};

/**
 * 共通計算・結果表示ロジック (Pasteモード用)
 */
async function performCalculation(interaction, calcType, year, league, stats) {
	// ポジション補完
	if (calcType === 'fielder') {
		const allPositions = [
			'cGame', 'fbGame', 'sbGame', 'tbGame', 'ssGame', 
			'lfGame', 'cfGame', 'rfGame', 'dhGame'
		];
		
		allPositions.forEach(pos => {
			if (stats[pos] === undefined) {
				stats[pos] = 0;
			}
		});
	}

	// Pasteモードでは再計算機能(セッション)は使用しないため、セッション作成処理を削除

	const requestBody = {
		calcType: calcType,
		year: year,
		league: league,
		...stats
	};

	try {
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

            let displayLeague = league;
            if (displayLeague === 'A') displayLeague = 'α';
            if (displayLeague === 'B') displayLeague = 'β';

			const embed = new EmbedBuilder()
				.setColor(0x3498DB)
				.setTitle(`WAR計算結果 (${year}年 / ${displayLeague}リーグ)`)
				.setDescription(`**${calcType === 'fielder' ? '野手' : '投手'}** のWAR計算が完了しました。`)
				.setTimestamp();

			if (response.data.war !== undefined) {
				const val = response.data.war;
				embed.addFields({ name: 'WAR', value: typeof val === 'number' ? val.toFixed(2) : String(val), inline: false });
			}

			for (const [key, value] of Object.entries(response.data)) {
				if (key !== 'war' && statLabels[key]) {
					const name = statLabels[key];
					const valueStr = typeof value === 'number' ? value.toFixed(3) : String(value);
					embed.addFields({ name: name, value: valueStr, inline: true });
				}
			}
			
			// Pasteモードはシンプルに結果のみを表示 (再計算ボタン等はなし)
            const msgContent = { 
                content: '**計算完了!**',
                embeds: [embed],
                ephemeral: true,
                components: []
            };

            // 共有機能のチェック (Pasteモード)
            try {
                const guildId = interaction.guildId || interaction.guild?.id;
                if (guildId) {
                    const config = await getGuildConfig(guildId);
                    const val = config.allow_share_result;
                    const isEnabled = (val === true || val === 1 || val === 'true' || val === '1');
                    
                    if (isEnabled) {
                        const shareButton = new ButtonBuilder()
                            .setCustomId('share_result_btn')
                            .setLabel('結果を共有')
                            .setStyle(ButtonStyle.Secondary)
                        const row = new ActionRowBuilder().addComponents(shareButton);
                        msgContent.components.push(row);
                    }
                }
            } catch (e) { logger.warn(`Config fetch failed in paste mode: ${e.message}`); }

			if (interaction.deferred) {
				await interaction.editReply(msgContent);
			} else {
				await interaction.reply(msgContent);
			}

		} else {
			const resultText = String(response.data);
			const msg = `**計算完了!**\n\
\
\
${resultText.slice(0, 1900)}\
\
`;
			
			if (interaction.deferred) {
				await interaction.editReply({ content: msg, ephemeral: true });
			} else {
				await interaction.reply({ content: msg, ephemeral: true });
			}
		}

	} catch (error) {
		let technicalErrorMsg = error.message;
		if (error.response) {
			technicalErrorMsg = `Status ${error.response.status}: ${JSON.stringify(error.response.data)}`;
		}
		logger.error(`API計算処理でエラーが発生しました: ${technicalErrorMsg}`);
		logger.error(`[Error Context] Request Body: ${JSON.stringify(requestBody)}`);
		
		const errorMsg = '!!!APIエラー: 計算サーバーへの接続に失敗しました。管理者に連絡してください.!!!';
		if (interaction.deferred) {
			await interaction.editReply({ content: errorMsg, ephemeral: true });
		} else {
			await interaction.reply({ content: errorMsg, ephemeral: true });
		}
	}
}