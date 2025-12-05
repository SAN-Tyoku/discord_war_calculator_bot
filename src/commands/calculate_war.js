const { SlashCommandBuilder } = require('discord.js');
const { getGuildConfig } = require('../database');
const { getDefaultGameYear, MIN_YEAR } = require('../utils');
const { startWarSession } = require('../sessionManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('calculate_war')
        .setDescription('WARを計算します')
        .addSubcommand(subcommand =>
            subcommand
                .setName('fielder')
                .setDescription('野手のWARを計算します')
                .addIntegerOption(option => 
                    option.setName('year')
                        .setDescription(`年度 (${MIN_YEAR}〜)`)
                        .setRequired(true)
                        .setMinValue(MIN_YEAR)
                )
                .addStringOption(option => 
                    option.setName('league')
                        .setDescription('リーグ')
                        .setRequired(true)
                        .addChoices(
                            { name: 'A', value: 'A' },
                            { name: 'B', value: 'B' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('pitcher')
                .setDescription('投手のWARを計算します')
                .addIntegerOption(option => 
                    option.setName('year')
                        .setDescription(`年度 (${MIN_YEAR}〜)`)
                        .setRequired(true)
                        .setMinValue(MIN_YEAR)
                )
                .addStringOption(option => 
                    option.setName('league')
                        .setDescription('リーグ')
                        .setRequired(true)
                        .addChoices(
                            { name: 'A', value: 'A' },
                            { name: 'B', value: 'B' }
                        )
                )
        ),
    /**
     * コマンドを実行します。
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: 'このコマンドはサーバー内でのみ使用できます。', ephemeral: true });
            return;
        }

        const config = await getGuildConfig(interaction.guildId);
        const mode = config.channel_mode || 'allow-all';

        if (mode === 'restricted') {
            const allowed = config.allowed_channels || [];
            if (!allowed.includes(interaction.channelId)) {
                await interaction.reply({ content: 'このチャンネルではWAR計算コマンドを使用できません。', ephemeral: true });
                return;
            }
        }

        const subCommand = interaction.options.getSubcommand();
        const year = interaction.options.getInteger('year');
        const league = interaction.options.getString('league');

        const currentMaxYear = getDefaultGameYear();
        if (year > currentMaxYear) {
             await interaction.reply({ content: `未来の年度 (${year}年) は指定できません。現在は ${currentMaxYear}年 までです。`, ephemeral: true });
             return;
        }

        await startWarSession(interaction, subCommand, year, league, config);
    },
};