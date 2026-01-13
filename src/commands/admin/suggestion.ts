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
    .setDescription("Système de suggestions")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Configurer le système de suggestions")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel pour les suggestions")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName("approved")
            .setDescription("Channel pour les suggestions approuvées")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("approve")
        .setDescription("Approuver une suggestion")
        .addStringOption((opt) =>
          opt
            .setName("id")
            .setDescription("ID du message de la suggestion")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("raison")
            .setDescription("Raison de l'approbation")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("reject")
        .setDescription("Rejeter une suggestion")
        .addStringOption((opt) =>
          opt
            .setName("id")
            .setDescription("ID du message de la suggestion")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("raison")
            .setDescription("Raison du rejet")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("suggest")
        .setDescription("Proposer une suggestion")
        .addStringOption((opt) =>
          opt
            .setName("contenu")
            .setDescription("Ta suggestion")
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
          title: "💡 Suggestions configurées",
          description: [
            `**Channel:** <#${channel.id}>`,
            approved ? `**Approuvées:** <#${approved.id}>` : null,
            "",
            "Les utilisateurs peuvent proposer via `/suggestion suggest`",
          ].filter(Boolean).join("\n"),
        })
      );
    }

    if (subcommand === "suggest") {
      const content = interaction.options.getString("contenu", true);

      const config = await client.db.guild.findUnique({
        where: { id: guildId },
      });

      if (!config?.suggestionChannel) {
        return interaction.reply({
          ...errorMessage({ description: "Le système de suggestions n'est pas configuré." }),
          ephemeral: true,
        });
      }

      const suggestionChannel = interaction.guild?.channels.cache.get(config.suggestionChannel) as TextChannel;
      if (!suggestionChannel) {
        return interaction.reply({
          ...errorMessage({ description: "Le channel de suggestions n'existe plus." }),
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("💡 Nouvelle suggestion")
        .setDescription(content)
        .setColor(Colors.Primary)
        .setAuthor({
          name: interaction.user.tag,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .addFields(
          { name: "Status", value: "⏳ En attente", inline: true },
          { name: "Votes", value: "👍 0 | 👎 0", inline: true }
        )
        .setFooter({ text: `ID: En cours...` })
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
        ...successMessage({ description: `Ta suggestion a été envoyée dans <#${config.suggestionChannel}>` }),
        ephemeral: true,
      });
    }

    if (subcommand === "approve" || subcommand === "reject") {
      const messageId = interaction.options.getString("id", true);
      const reason = interaction.options.getString("raison");

      const suggestion = await client.db.suggestion.findUnique({
        where: { messageId },
      });

      if (!suggestion) {
        return interaction.reply({
          ...errorMessage({ description: "Suggestion introuvable avec cet ID." }),
          ephemeral: true,
        });
      }

      if (suggestion.status !== "pending") {
        return interaction.reply({
          ...errorMessage({ description: "Cette suggestion a déjà été traitée." }),
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
        if (message) {
          const embed = EmbedBuilder.from(message.embeds[0]);
          embed.setColor(isApproved ? Colors.Success : Colors.Error);
          embed.spliceFields(0, 1, {
            name: "Status",
            value: isApproved ? "✅ Approuvée" : "❌ Rejetée",
            inline: true,
          });

          if (reason) {
            embed.addFields({
              name: isApproved ? "Raison d'approbation" : "Raison du rejet",
              value: reason,
              inline: false,
            });
          }

          embed.addFields({
            name: "Traitée par",
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
            .setTitle("✅ Suggestion approuvée")
            .setDescription(suggestion.content)
            .setColor(Colors.Success)
            .setAuthor({
              name: user?.tag ?? "Inconnu",
              iconURL: user?.displayAvatarURL(),
            })
            .addFields(
              { name: "Votes finaux", value: `👍 ${suggestion.upvotes} | 👎 ${suggestion.downvotes}`, inline: true }
            )
            .setTimestamp();

          if (reason) {
            approvedEmbed.addFields({ name: "Note du staff", value: reason, inline: false });
          }

          await approvedChannel.send({ embeds: [approvedEmbed] });
        }
      }

      return interaction.reply(
        successMessage({
          description: `Suggestion ${isApproved ? "approuvée" : "rejetée"} avec succès.`,
        })
      );
    }
  },
} satisfies Command;
