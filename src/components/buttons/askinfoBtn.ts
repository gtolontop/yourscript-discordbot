import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";
import type { ButtonComponent } from "../../types/index.js";

export default {
  customId: "askinfo_btn",

  async execute(interaction, client) {
    const parts = interaction.customId.split("_");
    const staffId = parts[2] || "none";

    // Create modal
    const modal = new ModalBuilder()
      .setCustomId(`askinfo_modal_${staffId}`)
      .setTitle("Additional Information");

    const reqTypeInput = new TextInputBuilder()
      .setCustomId("request_type")
      .setLabel("Type of request / Giveaway")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("e.g. Partnership, Giveaway, etc.")
      .setRequired(true);

    const websiteInput = new TextInputBuilder()
      .setCustomId("website")
      .setLabel("Website (Optional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const youtubeInput = new TextInputBuilder()
      .setCustomId("youtube")
      .setLabel("YouTube Channel (Optional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const membersInput = new TextInputBuilder()
      .setCustomId("members")
      .setLabel("Members / Followers Count")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("e.g. 1500 Discord Members")
      .setRequired(false);

    const otherInput = new TextInputBuilder()
      .setCustomId("other")
      .setLabel("Other relevant information")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(reqTypeInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(websiteInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(youtubeInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(membersInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(otherInput)
    );

    await interaction.showModal(modal);
  },
} satisfies ButtonComponent;
