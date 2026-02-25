import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types/index.js";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("question")
    .setDescription("Sends a form to the member to ask for more information")
    .setDefaultMemberPermissions(0), // staff only

  async execute(interaction, client) {
    const embed = new EmbedBuilder()
      .setTitle("📋 Required Information")
      .setDescription("In order for us to better process your request, please provide some additional information by clicking the button below.\n\n*(Reason, Website, YouTube, Follower count, etc.)*")
      .setColor(0x5865f2)
      .setFooter({ text: "Information Form" });

    const row = new ActionRowBuilder<any>().addComponents(
      new ButtonBuilder()
        .setCustomId(`askinfo_btn_${interaction.user.id}`)
        .setLabel("Provide Information")
        .setEmoji("📝")
        .setStyle(ButtonStyle.Primary)
    );

    // Reply visible not only to staff, so ephemeral = false
    await interaction.reply({
      embeds: [embed],
      components: [row]
    });
  },
} satisfies Command;
