const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Botのコマンド一覧と使い方を表示します。'),
    async execute(interaction) {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('WAR Calculator Bot ヘルプ')
            .setDescription('WAR計算Botのコマンド一覧です。')
            .addFields(
                {
                    name: '<一般ユーザー向けコマンド>',
                    value: `
                    ・\`/calculate_war [fielder/pitcher]\`: WAR計算を開始します。専用スレッドが作成されます。
                    ・\`/seiseki_paste\`: 成績テキストを貼り付けてWARを計算するフォームを開きます。
                    ・\`/help\`: このヘルプを表示します。
                    ・\`!end\` (スレッド内専用): 入力を中断し、セッションを強制終了します。
                    ・\`!back\` (スレッド内専用): 一つ前の質問に戻ります。
                    ・\`/feedback\`: 開発者やサーバー管理者にフィードバックを送信します。
                    `
                }
            );

        // 管理者権限を持つユーザーにのみ管理者コマンドを表示
        if (interaction.member && interaction.member.permissions.has('Administrator')) {
            helpEmbed.addFields({
                name: '<管理者向けコマンド>',
                value: `
                ・\`/config role [@role]\`: 通知ロールを設定/解除します。
                ・\`/config allow [#channel]\`: コマンドの使用を特定のチャンネルに許可します。
                ・\`/config disallow [#channel]\`: 特定のチャンネルでのコマンド使用を禁止します。
                ・\`/config list\`: 許可チャンネルの一覧を表示します。
                ・\`/status\`: システムのステータス診断を表示します。
                ・\`!force_war <fielder|pitcher> <year> <league>\`: 強制的にWAR計算を開始します。
                ・\`/config feedback [#channel]\`: フィードバックを受け取るチャンネルを設定/解除します。
                ・\`/cleanup_threads\`: このチャンネルのBot計算用スレッドを一括アーカイブします。
                `
            });
        }

        await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    },
};