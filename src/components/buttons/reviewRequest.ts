import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { successMessage, errorMessage, Colors } from "../../utils/index.js";

export default {
  customId: "review_request",

  async execute(interaction, client) {
    // Extract ticket ID from customId (review_request_123)
    const ticketId = parseInt(interaction.customId.split("_")[2]);

    if (isNaN(ticketId)) {
      return interaction.reply({
        ...errorMessage({ description: "ID de ticket invalide." }),
        ephemeral: true,
      });
    }

    const ticket = await client.db.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return interaction.reply({
        ...errorMessage({ description: "Ticket introuvable." }),
        ephemeral: true,
      });
    }

    // Check if already requested
    if (ticket.status === "review_pending") {
      return interaction.reply({
        ...errorMessage({ description: "Un avis a déjà été demandé pour ce ticket." }),
        ephemeral: true,
      });
    }

    // Try to send DM to user
    try {
      const user = await client.users.fetch(ticket.userId);

      const embed = new EmbedBuilder()
        .setTitle("💬 Donne ton avis !")
        .setDescription([
          `Merci d'avoir utilisé le support de **${interaction.guild?.name}** !`,
          "",
          `**Ticket:** #${ticket.number.toString().padStart(4, "0")}`,
          ticket.subject ? `**Sujet:** ${ticket.subject}` : null,
          "",
          "On aimerait avoir ton avis sur la qualité du support.",
          "Clique sur le bouton ci-dessous pour nous laisser un commentaire !",
        ].filter(Boolean).join("\n"))
        .setColor(Colors.Primary)
        .setFooter({ text: interaction.guild?.name ?? "Support" });

      const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`review_write_${ticket.id}_${interaction.guildId}`)
          .setLabel("Donner mon avis")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("⭐")
      );

      await user.send({ embeds: [embed], components: [button] });

      // Update ticket status
      await client.db.ticket.update({
        where: { id: ticketId },
        data: { status: "review_pending" },
      });

      // Update the original message to show it was sent
      await interaction.update({
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`review_request_${ticket.id}`)
              .setLabel("Avis demandé")
              .setStyle(ButtonStyle.Secondary)
              .setEmoji("✅")
              .setDisabled(true)
          ),
        ],
      });
    } catch {
      return interaction.reply({
        ...errorMessage({ description: "Impossible d'envoyer un DM à cet utilisateur (DMs fermés)." }),
        ephemeral: true,
      });
    }
  },
} satisfies ButtonComponent;
