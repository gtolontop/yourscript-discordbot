import {
  StringSelectMenuBuilder,
  EmbedBuilder,
  ActionRowBuilder,
} from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { errorMessage, Colors } from "../../utils/index.js";

export default {
  customId: "ticket_create",

  async execute(interaction, client) {
    const guildId = interaction.guildId!;

    // Check if user is blacklisted
    const blacklist = await client.db.ticketBlacklist.findUnique({
      where: { guildId_userId: { guildId, userId: interaction.user.id } },
    });

    if (blacklist) {
      return interaction.reply({
        ...errorMessage({
          description: blacklist.reason
            ? `You are blacklisted from tickets.\n**Reason:** ${blacklist.reason}`
            : "You are blacklisted from tickets.",
        }),
        ephemeral: true,
      });
    }

    // Check if user already has an open ticket
    const existingTicket = await client.db.ticket.findFirst({
      where: {
        userId: interaction.user.id,
        guildId,
        status: "open",
      },
    });

    if (existingTicket) {
      return interaction.reply({
        ...errorMessage({
          description: `You already have an open ticket: <#${existingTicket.channelId}>`,
        }),
        ephemeral: true,
      });
    }

    // Always show dropdown — categories are required
    const categories = await client.db.ticketCategory.findMany({
      where: { guildId },
      orderBy: { position: "asc" },
    });

    if (categories.length === 0) {
      return interaction.reply({
        ...errorMessage({
          description: "No ticket categories are configured.\nAsk an admin to set them up with `/ticketcategory add`.",
        }),
        ephemeral: true,
      });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("ticket_category_select")
      .setPlaceholder("📂 Choose a ticket type...")
      .addOptions(
        categories.map((cat) => ({
          label: cat.name,
          value: cat.name,
          ...(cat.description && { description: cat.description }),
          ...(cat.emoji && { emoji: cat.emoji }),
        }))
      );

    const embed = new EmbedBuilder()
      .setTitle("🎫 Create a Ticket")
      .setDescription("Select your ticket type below to get started.")
      .setColor(Colors.Primary);

    await interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
      ephemeral: true,
    });
  },
} satisfies ButtonComponent;
