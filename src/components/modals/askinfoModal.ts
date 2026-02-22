import { EmbedBuilder } from "discord.js";
import type { ModalComponent } from "../../types/index.js";

export default {
  customId: "askinfo_modal",

  async execute(interaction, client) {
    const parts = interaction.customId.split("_");
    const staffId = parts[2] || "none";

    const requestType = interaction.fields.getTextInputValue("request_type");
    const website = interaction.fields.getTextInputValue("website");
    const youtube = interaction.fields.getTextInputValue("youtube");
    const members = interaction.fields.getTextInputValue("members");
    const other = interaction.fields.getTextInputValue("other");

    const embed = new EmbedBuilder()
      .setTitle(`📝 Informations fournies par ${interaction.user.username}`)
      .setColor(0x5865f2)
      .setTimestamp();

    if (requestType) embed.addFields({ name: "Type de demande", value: requestType });
    if (website) embed.addFields({ name: "Site web", value: website });
    if (youtube) embed.addFields({ name: "YouTube", value: youtube });
    if (members) embed.addFields({ name: "Membres / Followers", value: members });
    if (other) embed.addFields({ name: "Autres", value: other });

    // Update the message that had the button
    if (interaction.message) {
      await interaction.message.edit({
        content: staffId !== "none" ? `<@${staffId}>, le membre a fourni les informations requises.` : "Les informations requises ont été fournies.",
        embeds: [embed],
        components: [] // disable the button
      });
      await interaction.reply({ content: "Merci d'avoir fourni ces informations.", ephemeral: true });
    } else {
        await interaction.reply({
            content: staffId !== "none" ? `<@${staffId}>, voici les infos:` : "Voici les infos:",
            embeds: [embed]
        });
    }
  },
} satisfies ModalComponent;
