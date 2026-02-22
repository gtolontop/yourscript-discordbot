import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types/index.js";
import type { Bot } from "../../client/Bot.js";
import { createMessage } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Show the bot's latency"),

  async execute(interaction, client) {
    const sent = await interaction.deferReply({ fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    await interaction.editReply(
      createMessage({
        title: "Pong!",
        description: `**Latency:** ${latency}ms\n**Discord API:** ${apiLatency}ms`,
        color:
          latency < 200 ? "Success" : latency < 500 ? "Warning" : "Error",
      }),
    );
  },
} satisfies Command;
