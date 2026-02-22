import { EmbedBuilder } from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { Bot } from "../../client/Bot.js";
import { logger } from "../../utils/logger.js";

export default {
  customId: /^ticket_claim/,

  async execute(interaction, client: Bot) {
    const guildId = interaction.guildId!;
    const channelId = interaction.channelId;

    try {
      // Find the ticket for this channel
      const tickets = await client.api.listTickets(guildId, "open");
      const ticket = tickets.tickets.find((t) => t.channel_id === channelId);

      if (!ticket) {
        await interaction.reply({
          content: "No ticket found for this channel.",
          ephemeral: true,
        });
        return;
      }

      // Check if already claimed
      if (ticket.claimed_by) {
        await interaction.reply({
          content: `This ticket is already claimed by <@${ticket.claimed_by}>.`,
          ephemeral: true,
        });
        return;
      }

      // Claim the ticket via the backend
      await client.api.claimTicket(guildId, ticket.id);

      // Update channel topic
      const channel = interaction.channel;
      if (channel && "setTopic" in channel) {
        const currentTopic = (channel as any).topic ?? "";
        await (channel as any)
          .setTopic(`${currentTopic} | Claimed by ${interaction.user.tag}`)
          .catch(() => {});
      }

      // Send confirmation embed
      const embed = new EmbedBuilder()
        .setDescription(
          `This ticket has been claimed by ${interaction.user.toString()}.`,
        )
        .setColor(0x57f287)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      logger.error("Failed to claim ticket:", error);
      await interaction.reply({
        content: "An error occurred while claiming this ticket.",
        ephemeral: true,
      });
    }
  },
} satisfies ButtonComponent;
