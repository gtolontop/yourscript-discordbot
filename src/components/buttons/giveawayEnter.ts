import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { errorMessage, Colors } from "../../utils/index.js";

export default {
  customId: "giveaway_enter",

  async execute(interaction, client) {
    const messageId = interaction.message.id;

    const giveaway = await client.db.giveaway.findUnique({
      where: { messageId },
    });

    if (!giveaway) {
      return interaction.reply({
        ...errorMessage({ description: "Giveaway introuvable." }),
        ephemeral: true,
      });
    }

    if (giveaway.ended) {
      return interaction.reply({
        ...errorMessage({ description: "Ce giveaway est terminé." }),
        ephemeral: true,
      });
    }

    // Check required role
    if (giveaway.requiredRole) {
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      if (!member?.roles.cache.has(giveaway.requiredRole)) {
        return interaction.reply({
          ...errorMessage({
            description: `Tu dois avoir le rôle <@&${giveaway.requiredRole}> pour participer.`,
          }),
          ephemeral: true,
        });
      }
    }

    const participants = JSON.parse(giveaway.participants) as string[];
    const isParticipating = participants.includes(interaction.user.id);

    if (isParticipating) {
      // Remove participation
      const newParticipants = participants.filter((id) => id !== interaction.user.id);

      await client.db.giveaway.update({
        where: { messageId },
        data: { participants: JSON.stringify(newParticipants) },
      });

      // Update embed
      const embed = EmbedBuilder.from(interaction.message.embeds[0]);
      embed.setFooter({
        text: `Par ${(await client.users.fetch(giveaway.hostId)).tag} • ${newParticipants.length} participants`,
      });

      await interaction.update({ embeds: [embed] });

      return interaction.followUp({
        content: "Tu ne participes plus au giveaway.",
        ephemeral: true,
      });
    } else {
      // Add participation
      participants.push(interaction.user.id);

      await client.db.giveaway.update({
        where: { messageId },
        data: { participants: JSON.stringify(participants) },
      });

      // Update embed
      const embed = EmbedBuilder.from(interaction.message.embeds[0]);
      embed.setFooter({
        text: `Par ${(await client.users.fetch(giveaway.hostId)).tag} • ${participants.length} participants`,
      });

      await interaction.update({ embeds: [embed] });

      return interaction.followUp({
        content: "🎉 Tu participes maintenant au giveaway !",
        ephemeral: true,
      });
    }
  },
} satisfies ButtonComponent;
