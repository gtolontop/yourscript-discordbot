import type { ButtonComponent } from "../../types/index.js";
import { successMessage, errorMessage } from "../../utils/index.js";
import { TextChannel } from "discord.js";

export default {
  customId: "ticket_claim",

  async execute(interaction, client) {
    const channel = interaction.channel as TextChannel;

    const ticket = await client.db.ticket.findUnique({
      where: { channelId: channel.id },
    });

    if (!ticket) {
      return interaction.reply({
        ...errorMessage({ description: "This channel is not a ticket." }),
        ephemeral: true,
      });
    }

    if (ticket.claimedBy) {
      return interaction.reply({
        ...errorMessage({ description: `This ticket is already being handled by <@${ticket.claimedBy}>` }),
        ephemeral: true,
      });
    }

    // Check if user is staff (has ManageMessages permission or support role)
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    const config = await client.db.guild.findUnique({
      where: { id: interaction.guildId! },
    });

    const isStaff =
      member?.permissions.has("ManageMessages") ||
      (config?.ticketSupportRole && member?.roles.cache.has(config.ticketSupportRole));

    if (!isStaff) {
      return interaction.reply({
        ...errorMessage({ description: "You do not have permission to claim this ticket." }),
        ephemeral: true,
      });
    }

    await client.db.ticket.update({
      where: { id: ticket.id },
      data: { claimedBy: interaction.user.id },
    });

    await channel.setTopic(
      `Ticket from <@${ticket.userId}> | ${ticket.subject ?? "No subject"} | Claimed by ${interaction.user.tag}`
    );

    await interaction.reply(
      successMessage({
        description: `${interaction.user.toString()} is now handling this ticket.`,
      })
    );
  },
} satisfies ButtonComponent;
