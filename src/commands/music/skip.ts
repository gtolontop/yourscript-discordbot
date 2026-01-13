import { SlashCommandBuilder, GuildMember } from "discord.js";
import { useQueue } from "discord-player";
import type { Command } from "../../types/index.js";
import { errorMessage, successMessage } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Passe à la musique suivante"),

  async execute(interaction) {
    const member = interaction.member as GuildMember;
    const queue = useQueue(interaction.guildId!);

    if (!queue?.isPlaying()) {
      return interaction.reply({
        ...errorMessage({ description: "Aucune musique en cours." }),
        ephemeral: true,
      });
    }

    const currentTrack = queue.currentTrack;
    queue.node.skip();

    await interaction.reply(
      successMessage({
        description: `Skipped **${currentTrack?.title ?? "la musique"}**`,
      })
    );
  },
} satisfies Command;
