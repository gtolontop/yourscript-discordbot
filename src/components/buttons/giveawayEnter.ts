import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { errorMessage, Colors } from "../../utils/index.js";

export default {
  customId: "giveaway_enter",

  async execute(interaction, client) {
    const messageId = interaction.message.id;

    const giveaway = await client.db.giveaway.findUnique({
      where: { messageId },
    }) as any;

    if (!giveaway) {
      return interaction.reply({
        ...errorMessage({ description: "Giveaway not found." }),
        ephemeral: true,
      });
    }

    if (giveaway.ended) {
      return interaction.reply({
        ...errorMessage({ description: "This giveaway has ended." }),
        ephemeral: true,
      });
    }

    // Check required role
    if (giveaway.requiredRole) {
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      if (!member?.roles.cache.has(giveaway.requiredRole)) {
        return interaction.reply({
          ...errorMessage({
            description: `You must have the <@&${giveaway.requiredRole}> role to participate.`,
          }),
          ephemeral: true,
        });
      }
    }

    // Check required level
    if (giveaway.requiredLevel) {
      const userDb = await client.db.user.findUnique({ where: { id: interaction.user.id } });
      const userLevel = userDb?.level ?? 0;
      if (userLevel < giveaway.requiredLevel) {
        return interaction.reply({
          ...errorMessage({
            description: `You need to be at least **Level ${giveaway.requiredLevel}** to enter this giveaway. (You are Level ${userLevel})`,
          }),
          ephemeral: true,
        });
      }
    }

    // Check required voice channel
    if (giveaway.requiredVoice) {
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      if (member?.voice.channelId !== giveaway.requiredVoice) {
        return interaction.reply({
          ...errorMessage({
            description: `You must be in the <#${giveaway.requiredVoice}> voice channel to participate!`,
          }),
          ephemeral: true,
        });
      }
    }

    const participants = JSON.parse(giveaway.participants) as string[];
    const isParticipating = participants.includes(interaction.user.id);

    if (!interaction.message.embeds[0]) {
      return interaction.reply({
        ...errorMessage({ description: "Embed not found." }),
        ephemeral: true,
      });
    }

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
        text: `By ${(await client.users.fetch(giveaway.hostId)).tag} • ${newParticipants.length} participants`,
      });

      await interaction.update({ embeds: [embed] });

      return interaction.followUp({
        content: "You are no longer participating in the giveaway.",
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
        content: "🎉 You are now participating in the giveaway!",
        ephemeral: true,
      });
    }
  },
} satisfies ButtonComponent;
