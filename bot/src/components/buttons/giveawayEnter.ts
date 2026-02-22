import { EmbedBuilder } from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { Bot } from "../../client/Bot.js";
import { logger } from "../../utils/logger.js";

export default {
  customId: "giveaway_enter",

  async execute(interaction, client: Bot) {
    const messageId = interaction.message.id;
    const guildId = interaction.guildId!;

    try {
      // Find the giveaway associated with this message
      const giveaways = await client.api.getGiveaways(guildId);
      const giveaway = giveaways.find((g) => g.message_id === messageId);

      if (!giveaway) {
        await interaction.reply({
          content: "Giveaway not found.",
          ephemeral: true,
        });
        return;
      }

      if (giveaway.ended) {
        await interaction.reply({
          content: "This giveaway has ended.",
          ephemeral: true,
        });
        return;
      }

      // Check required role
      if (giveaway.required_role) {
        const member = interaction.guild?.members.cache.get(
          interaction.user.id,
        );
        if (!member?.roles.cache.has(giveaway.required_role)) {
          await interaction.reply({
            content: `You need the <@&${giveaway.required_role}> role to enter.`,
            ephemeral: true,
          });
          return;
        }
      }

      // Enter giveaway via the backend
      const result = await client.api.enterGiveaway(
        giveaway.id,
        interaction.user.id,
      );

      if (result.entered) {
        await interaction.reply({
          content: "You have entered the giveaway! Good luck!",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content:
            result.reason ?? "You have been removed from the giveaway.",
          ephemeral: true,
        });
      }
    } catch (error) {
      logger.error("Failed to process giveaway entry:", error);
      await interaction.reply({
        content: "An error occurred while processing your entry.",
        ephemeral: true,
      });
    }
  },
} satisfies ButtonComponent;
