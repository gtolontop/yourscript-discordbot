import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
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

    // Check if categories exist
    const categories = await client.db.ticketCategory.findMany({
      where: { guildId },
    });

    if (categories.length > 0) {
      // Show select menu for category selection
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("ticket_category_select")
        .setPlaceholder("Choose a category...")
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
        .setDescription("Select your ticket category below.")
        .setColor(Colors.Primary);

      await interaction.reply({
        embeds: [embed],
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
        ephemeral: true,
      });
    } else {
      // No categories, show modal directly
      const config = await client.db.guild.findUnique({
        where: { id: guildId },
      });

      const label = config?.ticketModalLabel ?? "Subject (optional)";
      const placeholder = config?.ticketModalPlaceholder ?? "Briefly describe your issue...";
      const required = config?.ticketModalRequired ?? false;

      const modal = new ModalBuilder()
        .setCustomId("ticket_create_modal")
        .setTitle("Create a ticket");

      const subjectInput = new TextInputBuilder()
        .setCustomId("subject")
        .setLabel(label)
        .setPlaceholder(placeholder)
        .setStyle(TextInputStyle.Short)
        .setRequired(required)
        .setMaxLength(100);

      const usernameInput = new TextInputBuilder()
        .setCustomId("username")
        .setLabel("Ingame / Tebex Username")
        .setPlaceholder("e.g. john_doe")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(50);

      const ipInput = new TextInputBuilder()
        .setCustomId("server_ip")
        .setLabel("Game Server IP (if applicable)")
        .setPlaceholder("127.0.0.1:30120")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(50);

      const descInput = new TextInputBuilder()
        .setCustomId("description")
        .setLabel("Description of your issue")
        .setPlaceholder("Please describe your issue in detail...")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(subjectInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(usernameInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(ipInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descInput)
      );

      await interaction.showModal(modal);
    }
  },
} satisfies ButtonComponent;
