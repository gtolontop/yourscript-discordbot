import type { ModalSubmitInteraction, TextChannel } from "discord.js";
import { EmbedBuilder } from "discord.js";
import type { ModalComponent } from "../../types/index.js";
import type { Bot } from "../../client/Bot.js";
import { successMessage, errorMessage } from "../../utils/index.js";

const embedCreate: ModalComponent = {
  customId: /^embed_create_/,

  async execute(
    interaction: ModalSubmitInteraction,
    client: Bot
  ): Promise<unknown> {
    // Parse channelId and mentionEveryone from customId
    const parts = interaction.customId.split("_");
    const channelId = parts[2];
    const mentionEveryone = parts[3] === "true";

    const title = interaction.fields.getTextInputValue("embed_title");
    const description =
      interaction.fields.getTextInputValue("embed_description");
    const color = interaction.fields.getTextInputValue("embed_color") || null;
    const image = interaction.fields.getTextInputValue("embed_image") || null;
    const footer = interaction.fields.getTextInputValue("embed_footer") || null;

    const channel = client.channels.cache.get(channelId) as
      | TextChannel
      | undefined;

    if (!channel || !channel.isTextBased()) {
      return interaction.reply({
        ...errorMessage({ description: "Channel not found or invalid." }),
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder().setTitle(title).setDescription(description);

    if (color) {
      const hex = color.startsWith("#") ? color : `#${color}`;
      const parsed = parseInt(hex.replace("#", ""), 16);
      if (!isNaN(parsed)) {
        embed.setColor(parsed);
      }
    }

    if (image) {
      embed.setImage(image);
    }

    if (footer) {
      embed.setFooter({ text: footer });
    }

    embed.setTimestamp();

    try {
      const content = mentionEveryone ? "@everyone" : undefined;
      await channel.send({ content, embeds: [embed] });

      return interaction.reply({
        ...successMessage({
          description: `Embed sent to <#${channelId}>.`,
        }),
        ephemeral: true,
      });
    } catch (error) {
      console.error("Failed to send embed:", error);
      return interaction.reply({
        ...errorMessage({
          description: "Failed to send the embed. Check bot permissions.",
        }),
        ephemeral: true,
      });
    }
  },
};

export default embedCreate;
