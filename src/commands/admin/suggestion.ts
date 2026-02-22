import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
} from "discord.js";
import type { Command } from "../../types/index.js";
import { successMessage, errorMessage, Colors } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("suggestion")
    .setDescription("Suggestion system")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Configure the suggestion system")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel for suggestions")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName("approved")
            .setDescription("Channel for approved suggestions")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("approve")
        .setDescription("Approve a suggestion")
        .addStringOption((opt) =>
          opt
            .setName("id")
            .setDescription("Suggestion message ID")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("reason")
            .setDescription("Approval reason")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("reject")
        .setDescription("Reject a suggestion")
        .addStringOption((opt) =>
          opt
            .setName("id")
            .setDescription("Suggestion message ID")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("reason")
            .setDescription("Rejection reason")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("suggest")
        .setDescription("Submit a suggestion")
        .addStringOption((opt) =>
          opt
            .setName("content")
            .setDescription("Your suggestion")
            .setRequired(true)
            .setMaxLength(1000)
        )
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (subcommand === "setup") {
      const channel = interaction.options.getChannel("channel", true);
      const approved = interaction.options.getChannel("approved");

      await client.db.guild.upsert({
        where: { id: guildId },
        create: {
          id: guildId,
          suggestionChannel: channel.id,
          suggestionApprovedChannel: approved?.id ?? null,
        },
        update: {
          suggestionChannel: channel.id,
          suggestionApprovedChannel: approved?.id ?? null,
        },
      });

      return interaction.reply(
        successMessage({
          title: "💡 Suggestions Configured",
          description: [
            `**Channel:** <#${channel.id}>`,
            approved ? `**Approved:** <#${approved.id}>` : null,
            "",
            "Users can submit suggestions via `/suggestion suggest`",
          ].filter(Boolean).join("\n"),
        })
      );
    }

    if (subcommand === "suggest") {
      const content = interaction.options.getString("content", true);

      const config = await client.db.guild.findUnique({
        where: { id: guildId },
      });

      if (!config?.suggestionChannel) {
        return interaction.reply({
          ...errorMessage({ description: "The suggestion system is not configured." }),
          ephemeral: true,
        });
      }

      const suggestionChannel = interaction.guild?.channels.cache.get(config.suggestionChannel) as TextChannel;
      if (!suggestionChannel) {
        return interaction.reply({
          ...errorMessage({ description: "The suggestions channel no longer exists." }),
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("💡 New Suggestion")
        .setDescription(content)
        .setColor(Colors.Primary)
        .setAuthor({
          name: interaction.user.tag,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .addFields(
          { name: "Status", value: "⏳ Pending", inline: true },
          { name: "Votes", value: "👍 0 | 👎 0", inline: true }
        )
        .setFooter({ text: `ID: Loading...` })
        .setTimestamp();

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("suggestion_upvote")
          .setLabel("0")
          .setStyle(ButtonStyle.Success)
          .setEmoji("👍"),
        new ButtonBuilder()
          .setCustomId("suggestion_downvote")
          .setLabel("0")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("👎")
      );

      const message = await suggestionChannel.send({
        embeds: [embed],
        components: [buttons],
      });

      // Save suggestion
      const suggestion = await client.db.suggestion.create({
        data: {
          guildId,
          userId: interaction.user.id,
          messageId: message.id,
          content,
        },
      });

      // Update footer with ID
      embed.setFooter({ text: `ID: ${message.id}` });
      await message.edit({ embeds: [embed] });

      return interaction.reply({
        ...successMessage({ description: `Your suggestion has been sent to <#${config.suggestionChannel}>` }),
        ephemeral: true,
      });
    }

    if (subcommand === "approve" || subcommand === "reject") {
      const messageId = interaction.options.getString("id", true);
      const reason = interaction.options.getString("reason");

      const suggestion = await client.db.suggestion.findUnique({
        where: { messageId },
      });

      if (!suggestion) {
        return interaction.reply({
          ...errorMessage({ description: "Suggestion not found with this ID." }),
          ephemeral: true,
        });
      }

      if (suggestion.status !== "pending") {
        return interaction.reply({
          ...errorMessage({ description: "This suggestion has already been processed." }),
          ephemeral: true,
        });
      }

      const config = await client.db.guild.findUnique({
        where: { id: guildId },
      });

      // Update in DB
      const isApproved = subcommand === "approve";
      await client.db.suggestion.update({
        where: { messageId },
        data: {
          status: isApproved ? "approved" : "rejected",
          staffId: interaction.user.id,
          staffReason: reason,
        },
      });

      // Update original message
      const suggestionChannel = interaction.guild?.channels.cache.get(config?.suggestionChannel ?? "") as TextChannel;
      if (suggestionChannel) {
        const message = await suggestionChannel.messages.fetch(messageId).catch(() => null);
        if (message && message.embeds[0]) {
          const embed = EmbedBuilder.from(message.embeds[0]);
          embed.setColor(isApproved ? Colors.Success : Colors.Error);
          embed.spliceFields(0, 1, {
            name: "Status",
            value: isApproved ? "✅ Approved" : "❌ Rejected",
            inline: true,
          });

          if (reason) {
            embed.addFields({
              name: isApproved ? "Approval reason" : "Rejection reason",
              value: reason,
              inline: false,
            });
          }

          embed.addFields({
            name: "Processed by",
            value: interaction.user.tag,
            inline: true,
          });

          await message.edit({
            embeds: [embed],
            components: [], // Remove buttons
          });
        }
      }

      // If approved and there's an approved channel, copy there
      if (isApproved && config?.suggestionApprovedChannel) {
        const approvedChannel = interaction.guild?.channels.cache.get(config.suggestionApprovedChannel) as TextChannel;
        if (approvedChannel) {
          const user = await client.users.fetch(suggestion.userId).catch(() => null);

          const approvedEmbed = new EmbedBuilder()
            .setTitle("✅ Suggestion Approved")
            .setDescription(suggestion.content)
            .setColor(Colors.Success)
            .setAuthor({
              name: user?.tag ?? "Unknown",
              ...(user && { iconURL: user.displayAvatarURL() }),
            })
            .addFields(
              { name: "Final votes", value: `👍 ${suggestion.upvotes} | 👎 ${suggestion.downvotes}`, inline: true }
            )
            .setTimestamp();

          if (reason) {
            approvedEmbed.addFields({ name: "Staff note", value: reason, inline: false });
          }

          await approvedChannel.send({ embeds: [approvedEmbed] });
        }
      }

      return interaction.reply(
        successMessage({
          description: `Suggestion ${isApproved ? "approved" : "rejected"} successfully.`,
        })
      );
    }
  },
} satisfies Command;
