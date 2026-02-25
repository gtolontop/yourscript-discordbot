import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
} from "discord.js";
import type { ModalComponent } from "../../types/index.js";
import { aiEmbedSessions } from "../../commands/admin/ai.js";
import { createMessage, errorMessage } from "../../utils/index.js";

export default {
  customId: /^ai_embed_modify_modal_/,
  async execute(interaction, client) {
    const sessionId = interaction.customId.replace("ai_embed_modify_modal_", "");
    const session = aiEmbedSessions.get(sessionId);

    if (!session) {
      return interaction.reply({
        ...errorMessage({ description: "Cette session est expirée. Refaites `/ai embed`." }),
        ephemeral: true
      });
    }

    const modifyPrompt = interaction.fields.getTextInputValue("prompt");

    await interaction.deferReply({ ephemeral: true });

    if (!client.aiNamespace || client.aiNamespace.sockets.size === 0) {
      return interaction.editReply(errorMessage({ description: "AI selfbot non connecté." }));
    }

    const aiSocket = Array.from(client.aiNamespace.sockets.values())[0]!;
    const timeout = setTimeout(() => {
      interaction.editReply(errorMessage({ description: "AI request timed out after 15 seconds." }));
    }, 15000);

    aiSocket.emit("query:modifyEmbed" as any, {
      prompt: modifyPrompt,
      currentEmbedData: session.embedData
    }, async (result: any) => {
      clearTimeout(timeout);

      if (result.error) {
        return interaction.editReply(errorMessage({ description: `AI Failed: ${result.error}` }));
      }

      try {
        const embedData = result.embed;
        let numericColor: number | undefined;
        if (embedData.color) {
          const c = parseInt(embedData.color.replace("#", ""), 16);
          if (!isNaN(c)) numericColor = c;
        }

        const msg = createMessage({
          title: embedData.title,
          description: embedData.description || "Generated without description",
          ...(numericColor !== undefined ? { color: numericColor } : { color: "Primary" as const }),
          ...(embedData.footer && { footer: embedData.footer }),
          ...(embedData.fields && { fields: embedData.fields })
        });

        // Met à jour la session en mémoire
        session.embedData = embedData;
        session.prompt = modifyPrompt;

        // Affiche la nouvelle version
        await interaction.editReply({ ...msg });

        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`ai_embed_modify_${sessionId}`)
            .setLabel("Modifier encore")
            .setEmoji("✏️")
            .setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId(`ai_embed_send_${sessionId}`)
            .setPlaceholder("Sélectionnez le salon d'envoi")
            .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        );

        await interaction.followUp({
          content: "-# Que souhaitez-vous faire avec cet embed ?",
          components: [row1, row2],
          ephemeral: true
        });
      } catch (err: any) {
        return interaction.editReply(errorMessage({ description: `Erreur: ${err.message}` }));
      }
    });
  },
} satisfies ModalComponent;
