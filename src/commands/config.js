const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const { getGuildConfig, updateGuildConfig } = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Botのサーバー設定を管理します。 (管理者限定)')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('role')
                .setDescription('計算開始時にメンションする通知ロールを設定/解除します。')
                .addRoleOption(option =>
                    option.setName('target_role')
                        .setDescription('設定するロール (未指定の場合は解除します)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('allow')
                .setDescription('Botの使用を許可するチャンネルを追加します。')
                .addChannelOption(option =>
                    option.setName('target_channel')
                        .setDescription('許可するチャンネル')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disallow')
                .setDescription('Botの使用が許可されているチャンネルを解除します。')
                .addChannelOption(option =>
                    option.setName('target_channel')
                        .setDescription('許可を解除するチャンネル')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Botの使用が許可されているチャンネルの一覧を表示します。')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('mode')
                .setDescription('チャンネルの使用許可モードを設定します。')
                .addStringOption(option =>
                    option.setName('mode')
                        .setDescription('モードを選択してください。')
                        .setRequired(true)
                        .addChoices(
                            { name: '全チャンネルで許可 (allow-all)', value: 'allow-all' },
                            { name: '指定チャンネルのみ許可 (restricted)', value: 'restricted' }
                        )
                )
        ),
    async execute(interaction) {
        if (!interaction.inGuild()) {
            await interaction.reply({ content: 'このコマンドはサーバー内でのみ使用できます。', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const subCommand = interaction.options.getSubcommand();

        switch (subCommand) {
            case 'role': {
                const role = interaction.options.getRole('target_role');
                if (role) {
                    await updateGuildConfig(interaction.guildId, 'notify_role_id', role.id);
                    await interaction.editReply({ content: `通知ロールを **${role.name}** に設定しました。` });
                } else {
                    await updateGuildConfig(interaction.guildId, 'notify_role_id', null);
                    await interaction.editReply({ content: `通知ロールを解除しました。` });
                }
                break;
            }
            case 'allow': {
                const channel = interaction.options.getChannel('target_channel');
                const config = await getGuildConfig(interaction.guildId);
                const allowed = config.allowed_channels || [];
                if (!allowed.includes(channel.id)) {
                    allowed.push(channel.id);
                    await updateGuildConfig(interaction.guildId, 'allowed_channels', allowed);
                }
                await interaction.editReply({ content: `<#${channel.id}> でのコマンド使用を許可しました。` });
                break;
            }
            case 'disallow': {
                const channel = interaction.options.getChannel('target_channel');
                const config = await getGuildConfig(interaction.guildId);
                let allowed = config.allowed_channels || [];
                allowed = allowed.filter(id => id !== channel.id);
                await updateGuildConfig(interaction.guildId, 'allowed_channels', allowed);
                await interaction.editReply({ content: `<#${channel.id}> でのコマンド使用を禁止しました。` });
                break;
            }
            case 'list': {
                const config = await getGuildConfig(interaction.guildId);
                const mode = config.channel_mode || 'allow-all';
                const allowed = config.allowed_channels || [];

                let replyText = `現在のチャンネルモード: **${mode}**\n\n`;

                if (mode === 'restricted') {
                    if (allowed.length === 0) {
                        replyText += "許可されているチャンネルはありません。現在、Botはどのチャンネルでも使用できません。";
                    } else {
                        replyText += `許可されているチャンネル:\n${allowed.map(id => `<#${id}>`).join("\n")}`;
                    }
                } else { // 'allow-all'
                    replyText += "すべてのチャンネルでBotの使用が許可されています（チャンネルごとの権限設定を除く）。";
                }
                
                await interaction.editReply({ content: replyText });
                break;
            }
            case 'mode': {
                const mode = interaction.options.getString('mode');
                await updateGuildConfig(interaction.guildId, 'channel_mode', mode);
                const replyText = mode === 'restricted'
                    ? 'モードを `restricted` (指定チャンネルのみ許可) に設定しました。`/config allow` でチャンネルを許可してください。'
                    : 'モードを `allow-all` (全チャンネルで許可) に設定しました。';
                await interaction.editReply({ content: replyText });
                break;
            }
        }
    },
};
