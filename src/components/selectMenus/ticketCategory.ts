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
  },
} satisfies SelectMenuComponent;
