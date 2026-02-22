import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import type { SelectMenuComponent } from "../../types/index.js";
import { Bot } from "../../client/Bot.js";
import { logger } from "../../utils/logger.js";

export default {
  customId: "ticket_category_select",

  async execute(interaction, client: Bot) {
    const category = interaction.values[0];
    const guildId = interaction.guildId!;

    try {
      // Get modal config from the guild config
      const config = await client.api.getGuildConfig(guildId);

      const label = config.ticket_modal_label || "Subject (optional)";
      const placeholder =
        config.ticket_modal_placeholder ||
        "Briefly describe your issue...";
      const required = config.ticket_modal_required === 1;

      // Show modal with category encoded in customId
      const modal = new ModalBuilder()
        .setCustomId(`ticket_modal_${category}`)
        .setTitle(`Ticket - ${category}`);

      const subjectInput = new TextInputBuilder()
        .setCustomId("subject")
        .setLabel(label)
        .setPlaceholder(placeholder)
        .setStyle(TextInputStyle.Short)
        .setRequired(required)
        .setMaxLength(100);

      const row =
        new ActionRowBuilder<TextInputBuilder>().addComponents(subjectInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
    } catch (error) {
      logger.error("Failed to show ticket category modal:", error);
      await interaction.reply({
        content: "An error occurred while processing your selection.",
        ephemeral: true,
      });
    }
  },
} satisfies SelectMenuComponent;
