import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import type { SelectMenuComponent } from "../../types/index.js";
import { errorMessage } from "../../utils/index.js";

export default {
  customId: "ticket_category_select",

  async execute(interaction, client) {
    const categoryName = interaction.values[0] as string;
    const guildId = interaction.guildId!;

    // Fetch the specific category config
    const category = await client.db.ticketCategory.findUnique({
      where: { guildId_name: { guildId, name: categoryName } },
    });

    if (!category) {
       return interaction.reply({
         ...errorMessage({ description: "Category not found or deleted." }),
         ephemeral: true
       });
    }

    // Get global config for fallback
    const config = await client.db.guild.findUnique({
      where: { id: guildId },
    });

    const modalTitle = category.modalTitle ?? `Ticket - ${category.name}`;
    const modal = new ModalBuilder()
      .setCustomId(`ticket_create_modal_${category.name}`)
      .setTitle(modalTitle.substring(0, 45)); // Discord max 45 chars for title

    let fieldsConfig: any[] = [];
    try {
      if (category.modalFields) {
        fieldsConfig = JSON.parse(category.modalFields);
      }
    } catch (e) {
      // JSON parse error
    }

    // If we have custom fields defined for this category
    if (fieldsConfig.length > 0) {
      for (const field of fieldsConfig.slice(0, 5)) { // Max 5 fields in Discord modals
        const textInput = new TextInputBuilder()
          .setCustomId(field.id)
          .setLabel(field.label)
          .setStyle(field.style === "PARAGRAPH" ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setRequired(field.required ?? false)
          .setMaxLength(field.maxLength ?? 1000);

        if (field.placeholder) {
          textInput.setPlaceholder(field.placeholder);
        }

        if (field.minLength) {
          textInput.setMinLength(field.minLength);
        }

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(textInput));
      }
    } else {
      // Fallback to globally configured fields or hardcoded defaults
      const label = config?.ticketModalLabel ?? "Subject (optional)";
      const placeholder = config?.ticketModalPlaceholder ?? "Briefly describe your issue...";
      const required = config?.ticketModalRequired ?? false;

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

      const infoInput = new TextInputBuilder()
        .setCustomId("extra_info")
        .setLabel("Details (Server IP, Order ID...)")
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
        new ActionRowBuilder<TextInputBuilder>().addComponents(infoInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descInput)
      );
    }

    await interaction.showModal(modal);
  },
} satisfies SelectMenuComponent;
