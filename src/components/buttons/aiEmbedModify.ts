import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { aiEmbedSessions } from "../../commands/admin/ai.js";
import { errorMessage } from "../../utils/index.js";

export default {
  customId: /^ai_embed_modify_(?!modal)/,
  async execute(interaction) {
    const sessionId = interaction.customId.replace("ai_embed_modify_", "");
    const session = aiEmbedSessions.get(sessionId);

    if (!session) {
      return interaction.reply({
        ...errorMessage({ description: "Cette session est expirée. Refaites `/ai embed`." }),
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`ai_embed_modify_modal_${sessionId}`)
      .setTitle("Modifier l'embed");

    const promptInput = new TextInputBuilder()
      .setCustomId("prompt")
      .setLabel("Que souhaitez-vous modifier ?")
      .setPlaceholder("ex: Change la couleur en rouge, ajoute un footer...")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(promptInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  },
} satisfies ButtonComponent;
