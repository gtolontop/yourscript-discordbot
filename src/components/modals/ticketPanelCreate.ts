import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import type { ModalComponent } from "../../types/index.js";
import { Colors } from "../../utils/index.js";

export default {
  customId: "ticket_panel_create",

  async execute(interaction, client) {
    const title = interaction.fields.getTextInputValue("panel_title");
    const description = interaction.fields.getTextInputValue("panel_description");

    const embed = new EmbedBuilder()
      .setTitle(`🎫 ${title}`)
      .setDescription(description)
      .setColor(Colors.Primary);

    // Check if categories exist
    const categories = await client.db.ticketCategory.findMany({
      where: { guildId: interaction.guildId! },
      orderBy: { position: "asc" },
    });

    let components: ActionRowBuilder<any>[] = [];

    if (categories.length > 0) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("ticket_category_select")
        .setPlaceholder("Choose a ticket category...")
        .addOptions(
          categories.map((cat) => ({
            label: cat.name,
            value: cat.name,
            ...(cat.description && { description: cat.description }),
            ...(cat.emoji && { emoji: cat.emoji }),
          }))
        );
       components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
    } else {
        const buttonText = interaction.fields.getTextInputValue("panel_button_text");
        const buttonEmoji = interaction.fields.getTextInputValue("panel_button_emoji") || "🎫";

        components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("ticket_create")
            .setLabel(buttonText)
            .setStyle(ButtonStyle.Primary)
            .setEmoji(buttonEmoji)
        ));
    }

    // Send panel to channel
    if (interaction.channel && 'send' in interaction.channel) {
      await interaction.channel.send({
        embeds: [embed],
        components,
      });
    }

    await interaction.reply({
      content: "✅ Ticket panel sent!",
      ephemeral: true,
    });
  },
} satisfies ModalComponent;
