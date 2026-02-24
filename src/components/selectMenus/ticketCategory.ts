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

    // Fetch the specific category config
    const category = await client.db.ticketCategory.findUnique({
      where: { guildId_name: { guildId, name: categoryName } },
    });

    if (!category) {
      return interaction.reply({
        ...errorMessage({ description: "Category not found or deleted." }),
        ephemeral: true,
      });
    }

    // Build the modal for this specific category
    const modalTitle = category.modalTitle ?? `Ticket — ${category.name}`;
    const modal = new ModalBuilder()
      .setCustomId(`ticket_create_modal_${category.name}`)
      .setTitle(modalTitle.substring(0, 45)); // Discord max 45 chars

    // Parse custom fields for this category
    let fieldsConfig: any[] = [];
    try {
      if (category.modalFields) {
        fieldsConfig = JSON.parse(category.modalFields);
      }
    } catch (e) {
      // JSON parse error — fall through to defaults
    }

    if (fieldsConfig.length > 0) {
      // Use the category-specific custom fields
      for (const field of fieldsConfig.slice(0, 5)) {
        const textInput = new TextInputBuilder()
          .setCustomId(field.id)
          .setLabel(field.label)
          .setStyle(
            field.style === "PARAGRAPH"
              ? TextInputStyle.Paragraph
              : TextInputStyle.Short
          )
          .setRequired(field.required ?? false)
          .setMaxLength(field.maxLength ?? 1000);

        if (field.placeholder) {
          textInput.setPlaceholder(field.placeholder);
        }

        if (field.minLength) {
          textInput.setMinLength(field.minLength);
        }

        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(textInput)
        );
      }
    } else {
      // Fallback: default fields when no custom fields are configured
      const subjectInput = new TextInputBuilder()
        .setCustomId("subject")
        .setLabel("Subject")
        .setPlaceholder("Briefly describe your issue...")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(100);

      const descInput = new TextInputBuilder()
        .setCustomId("description")
        .setLabel("Description")
        .setPlaceholder("Please describe your issue in detail...")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(subjectInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descInput)
      );
    }

    await interaction.showModal(modal);
  },
} satisfies SelectMenuComponent;
