const { Events, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const logger = require('../../logger');
const { calculateWarWithApi, MIN_YEAR, getDefaultGameYear, parseStatsText } = require('../utils');
const { isBlacklisted } = require('../database');

const pasteCache = new Map();

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		// ブラックリストチェック
		if (await isBlacklisted(interaction.user.id) || (interaction.guildId && await isBlacklisted(interaction.guildId))) {
			// 応答せずに無視するか、エラーメッセージを返す。ここでは静かに無視する。
			// ただしインタラクションは応答しないとエラー表示になるため、ephemeralで返す
			try {
				if (!interaction.replied && !interaction.deferred) {
					await interaction.reply({ content: 'あなた、またはこのサーバーはBotの利用を制限されています。', ephemeral: true });
				}
			} catch(e) { /* ignore */ }
			return;
		}

		if (interaction.isChatInputCommand()) {
			logger.debug(`[Command] User ${interaction.user.id} executed command: ${interaction.commandName}`);
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
			logger.debug(`[Modal] User ${interaction.user.id} submitted modal: ${interaction.customId}`);
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
			}
		} else if (interaction.isStringSelectMenu()) {
			logger.debug(`[SelectMenu] User ${interaction.user.id} selected menu: ${interaction.customId}, values: ${JSON.stringify(interaction.values)}`);
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
			}
		}
	},
};

/**
 * 共通計算・結果表示ロジック
 */
async function performCalculation(interaction, calcType, year, league, stats) {
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

			const embed = new EmbedBuilder()
				.setColor(0x3498DB)
				.setTitle(`WAR計算結果 (${year}年 / ${league}リーグ)`)
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
			
			if (interaction.deferred) {
				await interaction.editReply({ content: '**計算完了!**', embeds: [embed] });
			} else {
				await interaction.reply({ content: '**計算完了!**', embeds: [embed], ephemeral: true });
			}

		} else {
			const resultText = String(response.data);
			const msg = `**計算完了!**\n\`\`\`\n${resultText.slice(0, 1900)}\n\`\`\``;
			
			if (interaction.deferred) {
				await interaction.editReply(msg);
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
		
		const errorMsg = '!!!APIエラー: 計算サーバーへの接続に失敗しました。管理者に連絡してください。!!!';
		if (interaction.deferred) {
			await interaction.editReply(errorMsg);
		} else {
			await interaction.reply({ content: errorMsg, ephemeral: true });
		}
	}
}