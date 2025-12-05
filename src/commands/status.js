const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig } = require('../database');
const { checkApiStatus, getDefaultGameYear } = require('../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Botとシステムのステータス診断を行います。 (管理者限定)')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .setDMPermission(false),
    
    /**
     * コマンドを実行します。
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        if (!interaction.inGuild()) {
            await interaction.reply({ content: 'このコマンドはサーバー内でのみ使用できます。', ephemeral: true });
            return;
        }

        await interaction.deferReply();

        // 1. API接続チェック
        const apiResult = await checkApiStatus();
        let apiStatusText = "";
        if (apiResult.status === 'ok') {
            apiStatusText = `🟢 正常 (応答: ${apiResult.latency}ms)`;
        } else {
            apiStatusText = `❌️ エラー: ${apiResult.message}`;
        }

        // 2. Discord応答速度
        const wsPing = interaction.client.ws.ping;
        const wsStatusText = `🟢 正常 (${wsPing}ms)`;

        // 3. 現在のチャンネル権限チェック
        const me = interaction.guild.members.me;
        const permissions = interaction.channel.permissionsFor(me);
        
        const requiredPermissions = [
            { name: 'メッセージ送信', flag: PermissionFlagsBits.SendMessages },
            { name: '埋め込みリンク', flag: PermissionFlagsBits.EmbedLinks },
            { name: '公開スレッド作成', flag: PermissionFlagsBits.CreatePublicThreads },
            { name: '非公開スレッド作成', flag: PermissionFlagsBits.CreatePrivateThreads },
            { name: 'スレッドで送信', flag: PermissionFlagsBits.SendMessagesInThreads },
        ];

        const missingPermissions = requiredPermissions.filter(p => !permissions.has(p.flag));
        let permissionText = "🟢 OK (主要権限あり)";
        if (missingPermissions.length > 0) {
            permissionText = `⚠️ 警告: 以下の権限が不足しています\n${missingPermissions.map(p => `・${p.name}`).join('\n')}`;
        }

        // 4. サーバー設定の取得
        const config = await getGuildConfig(interaction.guildId);
        const mode = config.channel_mode || 'allow-all';
        const allowed = config.allowed_channels || [];
        const roleId = config.notify_role_id;
        
        const shareVal = config.allow_share_result;
        const isShareEnabled = (shareVal === true || shareVal === 1 || shareVal === 'true' || shareVal === '1');
        const shareEnabled = isShareEnabled ? '有効' : '無効';

        let modeText = mode === 'restricted' ? '指定チャンネルのみ (restricted)' : '全チャンネル許可 (allow-all)';
        let roleText = roleId ? `<@&${roleId}>` : 'なし';
        let allowedText = allowed.length > 0 
            ? allowed.map(id => `<#${id}>`).join(', ') 
            : 'なし';

        if (mode === 'restricted' && allowed.length === 0) {
            allowedText += ' (使用可能なチャンネルがありません)';
        }

        // 5. ゲーム内年度
        const gameYear = getDefaultGameYear();

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71) // Green
            .setTitle('システムステータス & 設定確認')
            .addFields(
                { name: 'システム診断', value: `**APIサーバー:** ${apiStatusText}\n**Discord応答:** ${wsStatusText}\n**チャンネル権限:** ${permissionText}`, inline: false },
                { name: '現在のサーバー設定', value: `**モード:** ${modeText}\n**通知ロール:** ${roleText}\n**許可チャンネル:** ${allowedText}\n**共有機能:** ${shareEnabled}`, inline: false },
                { name: 'API情報', value: `**現在の計算可能な最大年度:** ${gameYear}年`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `Bot Version: ${require('../../package.json').version}` });

        await interaction.editReply({ embeds: [embed] });
    },
};