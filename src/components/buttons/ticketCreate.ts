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
            ? `Tu es blacklist des tickets.\n**Raison:** ${blacklist.reason}`
            : "Tu es blacklist des tickets.",
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
        .setPlaceholder("Choisis une catégorie...")
        .addOptions(
          categories.map((cat) => ({
            label: cat.name,
            value: cat.name,
            description: cat.description || undefined,
            emoji: cat.emoji || undefined,
          }))
        );

      const embed = new EmbedBuilder()
        .setTitle("🎫 Créer un ticket")
        .setDescription("Sélectionne la catégorie de ton ticket ci-dessous.")
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

      const label = config?.ticketModalLabel ?? "Sujet (optionnel)";
      const placeholder = config?.ticketModalPlaceholder ?? "Décris brièvement ton problème...";
      const required = config?.ticketModalRequired ?? false;

      const modal = new ModalBuilder()
        .setCustomId("ticket_create_modal")
        .setTitle("Créer un ticket");

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
    }
  },
} satisfies ButtonComponent;
