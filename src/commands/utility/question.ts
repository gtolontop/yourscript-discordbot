import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types/index.js";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("question")
    .setDescription("Envoie un formulaire au membre pour obtenir plus d'informations")
    .setDefaultMemberPermissions(0), // staff only

  async execute(interaction, client) {
    const embed = new EmbedBuilder()
      .setTitle("📋 Informations requises")
      .setDescription("Afin de mieux traiter votre demande, merci de bien vouloir nous fournir quelques informations supplémentaires en cliquant sur le bouton ci-dessous.\n\n*(Sujet de la demande, Site web, YouTube, Membres...)*")
      .setColor(0x5865f2)
      .setFooter({ text: "Formulaire de renseignements" });

    const row = new ActionRowBuilder<any>().addComponents(
      new ButtonBuilder()
        .setCustomId(`askinfo_btn_${interaction.user.id}`)
        .setLabel("Fournir les informations")
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
