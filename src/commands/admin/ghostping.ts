import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } from "discord.js";
import type { Command } from "../../types/index.js";
import { successMessage, errorMessage, Colors } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ghostping")
    .setDescription("Configure ghost pings when a member joins")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a channel for ghost pings")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to send the ghost ping")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a channel from ghost pings")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to remove")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("View configured channels")
    )
    .addSubcommand((sub) =>
      sub.setName("clear").setDescription("Clear all channels")
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    // Get current config
    const config = await client.db.guild.findUnique({
      where: { id: guildId },
    });

    const currentChannels: string[] = config?.ghostPingChannels
      ? JSON.parse(config.ghostPingChannels)
      : [];

    if (subcommand === "add") {
      const channel = interaction.options.getChannel("channel", true);

      if (currentChannels.includes(channel.id)) {
        return interaction.reply({
          ...errorMessage({ description: `<#${channel.id}> is already in the list.` }),
          ephemeral: true,
        });
      }

      if (currentChannels.length >= 5) {
        return interaction.reply({
          ...errorMessage({ description: "You cannot add more than 5 channels." }),
          ephemeral: true,
        });
      }

      currentChannels.push(channel.id);

      await client.db.guild.upsert({
        where: { id: guildId },
        create: {
          id: guildId,
          ghostPingChannels: JSON.stringify(currentChannels),
        },
        update: {
          ghostPingChannels: JSON.stringify(currentChannels),
        },
      });

      return interaction.reply(
        successMessage({
          title: "Ghost Ping",
          description: `<#${channel.id}> added to the list.\n\nWhen a member joins, they will be pinged then the message will be deleted.`,
        })
      );
    }

    if (subcommand === "remove") {
      const channel = interaction.options.getChannel("channel", true);

      if (!currentChannels.includes(channel.id)) {
        return interaction.reply({
          ...errorMessage({ description: `<#${channel.id}> is not in the list.` }),
          ephemeral: true,
        });
      }

      const newChannels = currentChannels.filter((id) => id !== channel.id);

      await client.db.guild.update({
        where: { id: guildId },
        data: {
          ghostPingChannels: newChannels.length > 0 ? JSON.stringify(newChannels) : null,
        },
      });

      return interaction.reply(
        successMessage({
          description: `<#${channel.id}> removed from the list.`,
        })
      );
    }

    if (subcommand === "list") {
      if (currentChannels.length === 0) {
        return interaction.reply({
          ...errorMessage({ description: "No channels configured for ghost pings." }),
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("Ghost Ping - Configured Channels")
        .setColor(Colors.Primary)
        .setDescription(currentChannels.map((id) => `• <#${id}>`).join("\n"))
        .setFooter({ text: "When a member joins, they are pinged then the message is deleted" });

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "clear") {
      await client.db.guild.update({
        where: { id: guildId },
        data: { ghostPingChannels: null },
      });

      return interaction.reply(
        successMessage({
          description: "All ghost ping channels have been cleared.",
        })
      );
    }
  },
} satisfies Command;
