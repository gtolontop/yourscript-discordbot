import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, type ButtonInteraction } from "discord.js";
import type { Button } from "../../types/index.js";
import { aiQuestionnaireCache } from "../../utils/questionnaireCache.js";

export default {
  customId: "btn_ai_questionnaire",
  execute: async (interaction: ButtonInteraction) => {
    const questions = aiQuestionnaireCache.get(interaction.channelId);

    if (!questions || questions.length === 0) {
      return interaction.reply({
        content: "This questionnaire is no longer active or the AI forgot the questions.",
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`modal_ai_questionnaire_${interaction.channelId}`)
      .setTitle("Additional Information");

    // Can only have max 5 questions in Discord Modals
    const safeQuestions = questions.slice(0, 5);

    safeQuestions.forEach((q, i) => {
      const input = new TextInputBuilder()
        .setCustomId(`q_${i}`)
        .setLabel(q.substring(0, 45)) // Label max length is 45 chars
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Your answer...")
        .setRequired(true);

      const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
      modal.addComponents(row);
    });

    await interaction.showModal(modal);
  },
} satisfies Button;
