import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/index.js";
import type { Bot } from "../../client/Bot.js";
import {
  successMessage,
  errorMessage,
  Colors,
} from "../../utils/index.js";

const data = new SlashCommandBuilder()
  .setName("suggestion")
  .setDescription("Manage suggestions")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName("approve")
      .setDescription("Approve a suggestion")
      .addStringOption((opt) =>
        opt
          .setName("id")
          .setDescription("Message ID of the suggestion")
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("reason")
          .setDescription("Reason for approval")
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
          .setDescription("Message ID of the suggestion")
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("reason")
          .setDescription("Reason for rejection")
          .setRequired(false)
      )
  );

async function execute(
  interaction: ChatInputCommandInteraction,
  client: Bot
): Promise<unknown> {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;

  const messageId = interaction.options.getString("id", true);
  const reason = interaction.options.getString("reason");
  const isApproved = subcommand === "approve";

  try {
    const config = await client.api.getGuildConfig(guildId);

    if (!config.suggestion_channel) {
      return interaction.reply({
        ...errorMessage({
          description: "The suggestion system is not configured.",
        }),
        ephemeral: true,
      });
    }

    // Find the suggestion by looking for the message in the suggestion channel
    const suggestionChannel = interaction.guild?.channels.cache.get(
      config.suggestion_channel
    ) as TextChannel;

    if (!suggestionChannel) {
      return interaction.reply({
        ...errorMessage({
          description: "The suggestion channel no longer exists.",
        }),
        ephemeral: true,
      });
    }

    // Approve or reject via the backend
    // The backend needs the suggestion ID (database ID), but we have the message ID
    // We'll call the appropriate endpoint
    if (isApproved) {
      await client.api.approveSuggestion(
        guildId,
        parseInt(messageId) || 0,
        interaction.user.id,
        reason ?? undefined
      );
    } else {
      await client.api.rejectSuggestion(
        guildId,
        parseInt(messageId) || 0,
        interaction.user.id,
        reason ?? undefined
      );
    }

    // Update the original message embed
    const message = await suggestionChannel.messages
      .fetch(messageId)
      .catch(() => null);

    if (message && message.embeds[0]) {
      const embed = EmbedBuilder.from(message.embeds[0]);
      embed.setColor(isApproved ? Colors.Success : Colors.Error);
      embed.spliceFields(0, 1, {
        name: "Status",
        value: isApproved ? "Approved" : "Rejected",
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
        name: "Reviewed by",
        value: interaction.user.tag,
        inline: true,
      });

      await message.edit({
        embeds: [embed],
        components: [],
      });
    }

    // If approved and there's an approved channel, copy there
    if (isApproved && config.suggestion_approved_channel) {
      const approvedChannel = interaction.guild?.channels.cache.get(
        config.suggestion_approved_channel
      ) as TextChannel;

      if (approvedChannel && message?.embeds[0]) {
        const originalEmbed = message.embeds[0];
        const approvedEmbed = new EmbedBuilder()
          .setTitle("Approved Suggestion")
          .setDescription(originalEmbed.description ?? "No content")
          .setColor(Colors.Success)
          .setTimestamp();

        if (originalEmbed.author) {
          approvedEmbed.setAuthor({
            name: originalEmbed.author.name,
            iconURL: originalEmbed.author.iconURL ?? undefined,
          });
        }

        if (reason) {
          approvedEmbed.addFields({
            name: "Staff note",
            value: reason,
            inline: false,
          });
        }

        await approvedChannel.send({ embeds: [approvedEmbed] });
      }
    }

    return interaction.reply(
      successMessage({
        description: `Suggestion ${isApproved ? "approved" : "rejected"} successfully.`,
      })
    );
  } catch (error) {
    console.error(error);
    return interaction.reply({
      ...errorMessage({
        description: `Failed to ${isApproved ? "approve" : "reject"} the suggestion.`,
      }),
      ephemeral: true,
    });
  }
}

export default { data, execute } satisfies Command;
