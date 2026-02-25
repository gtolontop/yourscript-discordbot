import type { SelectMenuComponent } from "../../types/index.js";
import { aiEmbedSessions } from "../../commands/admin/ai.js";
import { createMessage, successMessage, errorMessage } from "../../utils/index.js";
import type { TextChannel } from "discord.js";

export default {
  customId: /^ai_embed_send_/,
  async execute(interaction, client) {
    const sessionId = interaction.customId.replace("ai_embed_send_", "");
    const session = aiEmbedSessions.get(sessionId);

    if (!session) {
      return interaction.reply({
        ...errorMessage({ description: "Cette session est expirée. Refaites `/ai embed`." }),
        ephemeral: true
      });
    }

    const channelId = interaction.values[0];
    if (!channelId) {
      return interaction.reply({
        ...errorMessage({ description: "Aucun salon sélectionné." }),
        ephemeral: true
      });
    }

    const channel = client.channels.cache.get(channelId) as TextChannel | undefined;
    if (!channel) {
      return interaction.reply({
        ...errorMessage({ description: "Salon introuvable." }),
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const embedData = session.embedData;
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

      await channel.send(msg);

      // Nettoie la session
      aiEmbedSessions.delete(sessionId);

      return interaction.editReply(
        successMessage({ description: `Embed envoyé dans <#${channel.id}> ✅` })
      );
    } catch (err: any) {
      return interaction.editReply(
        errorMessage({ description: `Erreur lors de l'envoi: ${err.message}` })
      );
    }
  },
} satisfies SelectMenuComponent;
