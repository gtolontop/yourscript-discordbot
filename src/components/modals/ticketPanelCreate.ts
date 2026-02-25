import {
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import type { ModalComponent } from "../../types/index.js";
import { Colors, errorMessage } from "../../utils/index.js";

export default {
  customId: "ticket_panel_create",

  async execute(interaction, client) {
    const title = interaction.fields.getTextInputValue("panel_title");
    const description = interaction.fields.getTextInputValue("panel_description");

    // Always fetch categories — panel MUST use dropdown
    const categories = await client.db.ticketCategory.findMany({
      where: { guildId: interaction.guildId! },
      orderBy: { position: "asc" },
    });

    if (categories.length === 0) {
      return interaction.reply({
        ...errorMessage({
          description:
            "You need at least one ticket category to create a panel.\nUse `/ticketcategory add` to create one first.",
        }),
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`🎫 ${title}`)
      .setDescription(description)
      .setColor(Colors.Primary)
      .setFooter({ text: "Select a category below to open a ticket" });

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

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    // Send panel to channel
    if (interaction.channel && "send" in interaction.channel) {
      await interaction.channel.send({
        embeds: [embed],
        components: [row],
      });
    }

    await interaction.reply({
      content: "✅ Ticket panel sent with dropdown!",
      ephemeral: true,
    });
  },
} satisfies ModalComponent;
