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
      .setTitle(`📝 Information provided by ${interaction.user.username}`)
      .setColor(0x5865f2)
      .setTimestamp();

    if (requestType) embed.addFields({ name: "Type of request", value: requestType });
    if (website) embed.addFields({ name: "Website", value: website });
    if (youtube) embed.addFields({ name: "YouTube", value: youtube });
    if (members) embed.addFields({ name: "Members / Followers", value: members });
    if (other) embed.addFields({ name: "Other", value: other });

    // Update the message that had the button
    if (interaction.message) {
      await interaction.message.edit({
        content: staffId !== "none" ? `<@${staffId}>, the user has provided the requested information.` : "The requested information has been provided.",
        embeds: [embed],
        components: [] // disable the button
      });
      await interaction.reply({ content: "Thanks for providing this information.", ephemeral: true });
    } else {
        await interaction.reply({
            content: staffId !== "none" ? `<@${staffId}>, here is the information:` : "Here is the information:",
            embeds: [embed]
        });
    }
  },
} satisfies ModalComponent;
