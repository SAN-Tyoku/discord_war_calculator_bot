const { Events, ActivityType } = require('discord.js');
const logger = require('../../logger');
const { getGuildConfig } = require('../database');

module.exports = {
	name: Events.ClientReady,
	once: true,
	/**
	 * クライアントの準備が完了したときに呼び出されます。
	 * @param {import('discord.js').Client} client - Discordクライアントインスタンス。
	 */
	async execute(client) {
		logger.info(`Botが起動しました。ログインユーザー: ${client.user.tag}`);

		// ステータスの初期更新
		await updateStatus(client);
		setInterval(() => updateStatus(client), 10 * 60 * 1000); // 10分ごとにステータスを更新
	},
};

/**
 * DBの設定に基づいてBotのステータスを更新します。
 * @param {import('discord.js').Client} client 
 */
async function updateStatus(client) {
	try {
		const config = await getGuildConfig('SYSTEM');

		// メンテナンスモードのチェック
		if (config.maintenance_mode) {
			client.user.setStatus('dnd');
			client.user.setActivity('メンテナンス中', { type: ActivityType.Playing });
			return;
		}

		// 通常モード: ステータスをオンラインに戻す
		client.user.setStatus('online');

		const statusConfig = config.status_config;

		if (!statusConfig) return;

		let name = '';
		let type = ActivityType.Playing;

		if (statusConfig.mode === 'preset') {
			switch (statusConfig.value) {
				case 'servers':
					name = `${client.guilds.cache.size} servers`;
					type = ActivityType.Playing;
					break;
				case 'members':
					const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
					name = `${totalMembers} members`;
					type = ActivityType.Watching;
					break;
				default:
					break;
			}
		} else {
			name = statusConfig.value || '';
			if (statusConfig.type) {
				switch (statusConfig.type.toLowerCase()) {
					case 'watching': type = ActivityType.Watching; break;
					case 'listening': type = ActivityType.Listening; break;
					case 'competing': type = ActivityType.Competing; break;
					default: type = ActivityType.Playing; break;
				}
			}
		}

		if (name) {
			client.user.setActivity(name, { type });
		}
	} catch (error) {
		logger.error(`ステータス更新エラー: ${error.message}`);
	}
}
