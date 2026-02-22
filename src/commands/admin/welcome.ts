import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } from "discord.js";
import type { Command } from "../../types/index.js";
import { successMessage, errorMessage, Colors } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Configure welcome messages")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Configure the welcome message")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel for welcome messages")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("message")
            .setDescription("Welcome message (use {user}, {username}, {server}, {memberCount})")
            .setRequired(true)
            .setMaxLength(1000)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("disable").setDescription("Disable welcome messages")
    )
    .addSubcommand((sub) =>
      sub.setName("show").setDescription("View current configuration")
    )
    .addSubcommand((sub) =>
      sub.setName("test").setDescription("Test the welcome message")
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (subcommand === "setup") {
      const channel = interaction.options.getChannel("channel", true);
      const message = interaction.options.getString("message", true);

      await client.db.guild.upsert({
        where: { id: guildId },
        create: {
          id: guildId,
          welcomeChannel: channel.id,
          welcomeMessage: message,
        },
        update: {
          welcomeChannel: channel.id,
          welcomeMessage: message,
        },
      });

      return interaction.reply(
        successMessage({
          title: "👋 Welcome Configured",
          description: [
            `**Channel:** <#${channel.id}>`,
            "",
            "**Message:**",
            `\`\`\`${message}\`\`\``,
            "",
            "**Available variables:**",
            "• `{user}` - Member mention",
            "• `{username}` - Member name",
            "• `{tag}` - Full tag (User#1234)",
            "• `{server}` - Server name",
            "• `{memberCount}` - Member count",
            "",
            "*Add `{embed}` at the beginning to display as an embed.*",
          ].join("\n"),
        })
      );
    }

    if (subcommand === "disable") {
      await client.db.guild.upsert({
        where: { id: guildId },
        create: { id: guildId },
        update: {
          welcomeChannel: null,
          welcomeMessage: null,
        },
      });

      return interaction.reply(
        successMessage({ description: "Welcome messages disabled." })
      );
    }

    if (subcommand === "show") {
      const config = await client.db.guild.findUnique({
        where: { id: guildId },
      });

      if (!config?.welcomeChannel || !config?.welcomeMessage) {
        return interaction.reply({
          ...errorMessage({ description: "Welcome messages are not configured." }),
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("👋 Welcome Configuration")
        .setColor(Colors.Primary)
        .addFields(
          { name: "Channel", value: `<#${config.welcomeChannel}>`, inline: true },
          { name: "Message", value: `\`\`\`${config.welcomeMessage}\`\`\``, inline: false }
        );

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "test") {
      const config = await client.db.guild.findUnique({
        where: { id: guildId },
      });

      if (!config?.welcomeChannel || !config?.welcomeMessage) {
        return interaction.reply({
          ...errorMessage({ description: "Welcome messages are not configured." }),
          ephemeral: true,
        });
      }

      const member = interaction.member!;
      const message = config.welcomeMessage
        .replace(/{user}/g, interaction.user.toString())
        .replace(/{username}/g, interaction.user.username)
        .replace(/{tag}/g, interaction.user.tag)
        .replace(/{server}/g, interaction.guild!.name)
        .replace(/{memberCount}/g, interaction.guild!.memberCount.toString());

      // Show preview
      if (config.welcomeMessage.startsWith("{embed}")) {
        const text = message.replace("{embed}", "").trim();
        const previewEmbed = new EmbedBuilder()
          .setDescription(text)
          .setColor(Colors.Success)
          .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
          .setTimestamp();

        return interaction.reply({
          content: "**Welcome message preview:**",
          embeds: [previewEmbed],
          ephemeral: true,
        });
      } else {
        return interaction.reply({
          content: `**Welcome message preview:**\n\n${message}`,
          ephemeral: true,
        });
      }
    }
  },
} satisfies Command;
