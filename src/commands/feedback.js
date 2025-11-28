const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { getGuildConfig } = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('feedback')
        .setDescription('開発者やサーバー管理者にフィードバックやバグ報告を送信します。'),
    async execute(interaction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: 'このコマンドはサーバー内でのみ使用できます。', ephemeral: true });
            return;
        }

        const config = await getGuildConfig(interaction.guildId);
        
        // フィードバックチャンネルが設定されていない場合は使用不可
        if (!config.feedback_channel_id) {
            await interaction.reply({
                content: 'このサーバーではフィードバック機能が有効になっていません。\n管理者が `/config feedback` で受信チャンネルを設定する必要があります。',
                ephemeral: true 
            });
            return;
        }

        const select = new StringSelectMenuBuilder()
            .setCustomId('feedback_category_select')
            .setPlaceholder('カテゴリを選択してください')
            .addOptions([
                new StringSelectMenuOptionBuilder().setLabel('バグ報告').setValue('bug_report'),
                new StringSelectMenuOptionBuilder().setLabel('機能要望').setValue('feature_request'),
                new StringSelectMenuOptionBuilder().setLabel('質問').setValue('question'),
                new StringSelectMenuOptionBuilder().setLabel('その他').setValue('other'),
            ]);

        const row = new ActionRowBuilder().addComponents(select);

        await interaction.reply({
            content: 'フィードバックのカテゴリを選択してください。',
            components: [row],
            ephemeral: true
        });
    },
};