import { EmbedBuilder, type ModalSubmitInteraction } from "discord.js";
import type { Modal } from "../../types/index.js";
import { aiQuestionnaireCache } from "../../utils/questionnaireCache.js";

export default {
  customId: /^modal_ai_questionnaire_/,
  execute: async (interaction: ModalSubmitInteraction) => {
    // Acknowledge right away so the user doesn't get timeout error
    await interaction.deferUpdate();
    
    const channelId = interaction.customId.replace("modal_ai_questionnaire_", "");
    
    // Safety check that this is in the right channel
    if (interaction.channelId !== channelId) {
      return interaction.followUp({
        content: "Error: Channel mismatch.",
        ephemeral: true
      });
    }

    const questions = aiQuestionnaireCache.get(channelId);
    if (!questions) {
      return interaction.followUp({
        content: "This questionnaire is no longer active.",
        ephemeral: true
      });
    }

    const answers: { question: string, answer: string }[] = [];
    
    // Parse the answers
    const safeQuestions = questions.slice(0, 5);
    safeQuestions.forEach((q, i) => {
      try {
        const value = interaction.fields.getTextInputValue(`q_${i}`);
        if (value) {
          answers.push({ question: q, answer: value });
        }
      } catch (e) {
        // Field wasn't found or filled
      }
    });

    if (answers.length === 0) {
      return interaction.followUp({
        content: "No answers provided.",
        ephemeral: true
      });
    }

    // Build embed summarising answers so the AI and Staff can read it easily
    const embed = new EmbedBuilder()
      .setTitle("📋 Submitted Information")
      .setColor(0x5865f2)
      .setAuthor({ 
        name: interaction.user.username, 
        iconURL: interaction.user.displayAvatarURL()
      });

    answers.forEach(a => {
      embed.addFields({
        name: a.question.substring(0, 256),
        value: a.answer.substring(0, 1024),
        inline: false
      });
    });

    // Remove buttons from the original message so it can't be clicked again
    if (interaction.message) {
      await interaction.message.edit({ components: [] }).catch(() => {});
    }

    // Send the answers to the channel
    await interaction.followUp({ 
      content: "Here is the information I have provided:", 
      embeds: [embed] 
    });

    // Clear the cache since it's used
    aiQuestionnaireCache.delete(channelId);
  },
} satisfies Modal;
