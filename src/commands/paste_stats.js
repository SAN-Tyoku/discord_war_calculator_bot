const {
    SlashCommandBuilder,
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const { getDefaultGameYear } = require('../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('seiseki_paste')
        .setDescription('モーダルを開いて成績を貼り付け、WARを計算します。'),
    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('pasteStatsModal')
            .setTitle('WAR計算');

        const currentYear = getDefaultGameYear();
        const yearInput = new TextInputBuilder()
            .setCustomId('year')
            .setLabel('年度')
            .setPlaceholder('例: 1385')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(String(currentYear));

        const leagueInput = new TextInputBuilder()
            .setCustomId('league')
            .setLabel('リーグ (AまたはB)')
            .setPlaceholder('例: A')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const statsInput = new TextInputBuilder()
            .setCustomId('statsToPaste')
            .setLabel('成績データ')
            .setPlaceholder('ここに成績をコピー＆ペーストしてください...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(yearInput);
        const secondActionRow = new ActionRowBuilder().addComponents(leagueInput);
        const thirdActionRow = new ActionRowBuilder().addComponents(statsInput);

        modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

        await interaction.showModal(modal);
    },
};
