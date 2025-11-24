const { Events } = require('discord.js');
const logger = require('../../logger');

module.exports = {
	name: Events.ClientReady,
	once: true,
	execute(client) {
		logger.info(`Botが起動しました。ログインユーザー: ${client.user.tag}`);
	},
};
