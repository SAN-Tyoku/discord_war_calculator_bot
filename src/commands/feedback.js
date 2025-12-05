const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { getGuildConfig } = require('../database');

const cooldowns = new Map();
const COOLDOWN_SECONDS = 10;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('feedback')
        .setDescription('開発者やサーバー管理者にフィードバックやバグ報告を送信します。'),
    /**
     * コマンドを実行します。
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        const userId = interaction.user.id;
        const now = Date.now();

        // クールダウンチェック
        if (cooldowns.has(userId)) {
            const lastExecutionTime = cooldowns.get(userId);
            const remainingTime = (lastExecutionTime + (COOLDOWN_SECONDS * 1000) - now) / 1000;

            if (remainingTime > 0) {
                await interaction.reply({
                    content: `フィードバックは${Math.ceil(remainingTime)}秒後に再度送信できます。`,
                    ephemeral: true
                });
                return;
            }
        }

        if (!interaction.guildId) {
            await interaction.reply({ content: 'このコマンドはサーバー内でのみ使用できます。', ephemeral: true });
            return;
        }

        const config = await getGuildConfig(interaction.guildId);
        
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

        // クールダウンを設定
        cooldowns.set(userId, now);
        setTimeout(() => cooldowns.delete(userId), COOLDOWN_SECONDS * 1000);
    },
};