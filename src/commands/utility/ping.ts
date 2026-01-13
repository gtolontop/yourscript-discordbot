import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types/index.js";
import { createMessage, Colors } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Affiche la latence du bot"),

  async execute(interaction, client) {
    const sent = await interaction.deferReply({ fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    await interaction.editReply(
      createMessage({
        title: "Pong !",
        description: `**Latence:** ${latency}ms\n**API Discord:** ${apiLatency}ms`,
        color: latency < 200 ? "Success" : latency < 500 ? "Warning" : "Error",
      })
    );
  },
} satisfies Command;
