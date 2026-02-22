import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import type { SelectMenuComponent } from "../../types/index.js";

export default {
  customId: "ticket_category_select",

  async execute(interaction, client) {
    const category = interaction.values[0];
    const guildId = interaction.guildId!;

    // Get modal config
    const config = await client.db.guild.findUnique({
      where: { id: guildId },
    });

    const label = config?.ticketModalLabel ?? "Subject (optional)";
    const placeholder = config?.ticketModalPlaceholder ?? "Briefly describe your issue...";
    const required = config?.ticketModalRequired ?? false;

    // Show modal with category encoded in customId
    const modal = new ModalBuilder()
      .setCustomId(`ticket_create_modal_${category}`)
      .setTitle(`Ticket - ${category}`);

    const subjectInput = new TextInputBuilder()
      .setCustomId("subject")
      .setLabel(label)
      .setPlaceholder(placeholder)
      .setStyle(TextInputStyle.Short)
      .setRequired(required)
      .setMaxLength(100);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(subjectInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  },
} satisfies SelectMenuComponent;
