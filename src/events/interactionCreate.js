const { Events } = require('discord.js');
const logger = require('../../logger');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isChatInputCommand()) return;

		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			logger.error(`${interaction.commandName} というコマンドは見つかりませんでした。`);
			return;
		}

		try {
			await command.execute(interaction);
		} catch (error) {
			logger.error(`${interaction.commandName} の実行中にエラーが発生しました。`, error);
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({ content: 'コマンドの実行中にエラーが発生しました！', ephemeral: true });
			} else {
				await interaction.reply({ content: 'コマンドの実行中にエラーが発生しました！', ephemeral: true });
			}
		}
	},
};
