const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const logger = require('../../logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cleanup_threads')
        .setDescription('このチャンネルにあるBotの計算用スレッドを一括でアーカイブします。(管理者限定)')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .setDMPermission(false),
        
    /**
     * コマンドを実行します。
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            await interaction.reply({ content: 'このコマンドを実行する権限がありません。', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.channel;
        
        if (channel.isThread()) {
            await interaction.editReply('このコマンドは親チャンネルで実行してください。');
            return;
        }

        try {
            const activeThreads = await channel.threads.fetchActive();

            let count = 0;
            const threadsToClose = activeThreads.threads.filter(thread => {
                return thread.ownerId === interaction.client.user.id && thread.name.startsWith('WAR計算-');
            });

            if (threadsToClose.size === 0) {
                await interaction.editReply('整理対象のアクティブなスレッドは見つかりませんでした。');
                return;
            }

            await interaction.editReply(`${threadsToClose.size} 件のスレッドをアーカイブしています...`);

            for (const [id, thread] of threadsToClose) {
                try {
                    // ロックしてアーカイブ
                    await thread.setLocked(true);
                    await thread.setArchived(true);
                    count++;
                } catch (err) {
                    logger.warn(`スレッド ${thread.name} のクローズに失敗: ${err.message}`);
                }
            }

            await interaction.editReply({ content: `完了しました。${count} 件のスレッドをアーカイブしました。` });
            logger.info(`[Cleanup] Guild: ${interaction.guild.name}, User: ${interaction.user.tag}, Closed: ${count} threads`);

        } catch (error) {
            logger.error(`スレッド掃除中にエラー: ${error.message}`);
            await interaction.editReply('処理中にエラーが発生しました。');
        }
    },
};