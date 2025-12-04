const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const logger = require('../../logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cleanup_threads')
        .setDescription('このチャンネルにあるBotの計算用スレッドを一括でアーカイブします。(管理者限定)')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .setDMPermission(false),
        
    async execute(interaction) {
        // 権限チェックは setDefaultMemberPermissions で行われるが、念のため
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            await interaction.reply({ content: 'このコマンドを実行する権限がありません。', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.channel;
        
        // スレッド以外では実行不可にする（スレッド内でスレッド一覧は取得できないため）
        if (channel.isThread()) {
            await interaction.editReply('このコマンドは親チャンネルで実行してください。');
            return;
        }

        try {
            // アクティブなスレッドを取得
            const activeThreads = await channel.threads.fetchActive();
            // アーカイブ済みスレッドも取得（念のため）
            // const archivedThreads = await channel.threads.fetchArchived();

            let count = 0;
            const threadsToClose = activeThreads.threads.filter(thread => {
                // 条件: Botが作成した (ownerId) かつ、名前が "WAR計算-" で始まる
                // または、Botが管理権限を持っているもの
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