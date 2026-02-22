import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextChannel,
} from "discord.js";
import type { ModalComponent } from "../../types/index.js";
import { successMessage, errorMessage, Colors } from "../../utils/index.js";

export default {
  customId: /^annonce_create_/,

  async execute(interaction, client) {
    const parts = interaction.customId.split("_");
    const channelId = parts[2];
    const mention = parts[3] === "true";

    if (!channelId) {
      return interaction.reply({
        ...errorMessage({ description: "Invalid data." }),
        ephemeral: true,
      });
    }

    const channel = client.channels.cache.get(channelId) as TextChannel;
    if (!channel || !channel.isTextBased()) {
      return interaction.reply({
        ...errorMessage({ description: "Channel not found." }),
        ephemeral: true,
      });
    }

    const title = interaction.fields.getTextInputValue("annonce_title");
    const description = interaction.fields.getTextInputValue("annonce_description");
    const imageUrl = interaction.fields.getTextInputValue("annonce_image") || null;
    const footer = interaction.fields.getTextInputValue("annonce_footer") || null;

    // Build announcement with Components V2
    const container = new ContainerBuilder()
      .setAccentColor(Colors.Primary);

    // Title
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# 📢 ${title}`)
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    // Description
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(description)
    );

    // Image if provided
    if (imageUrl && isValidUrl(imageUrl)) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      );
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL(imageUrl)
        )
      );
    }

    // Footer
    if (footer) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# ${footer}`)
      );
    }

    // Timestamp
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# <t:${Math.floor(Date.now() / 1000)}:F>`)
    );

    try {
      await channel.send({
        ...(mention && { content: "@everyone" }),
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });

      await interaction.reply({
        ...successMessage({
          title: "Announcement Sent",
          description: `The announcement has been sent to <#${channelId}>`,
        }),
        ephemeral: true,
      });
    } catch (error) {
      await interaction.reply({
        ...errorMessage({ description: "Unable to send the announcement." }),
        ephemeral: true,
      });
    }
  },
} satisfies ModalComponent;

function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}
