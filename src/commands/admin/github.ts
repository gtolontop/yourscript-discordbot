import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import type { Command } from "../../types/index.js";
import { successMessage, errorMessage, Colors } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("github")
    .setDescription("GitHub Integration")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((sub) =>
      sub
        .setName("export")
        .setDescription("Export this ticket as a GitHub issue")
        .addStringOption((opt) =>
          opt
            .setName("repo")
            .setDescription("Owner/Repo (e.g. gtolontop/yorkdev-bot)")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("title")
            .setDescription("Issue Title")
            .setRequired(false)
        )
    ),

  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "export") {
      const repo = interaction.options.getString("repo", true);
      const titleOverride = interaction.options.getString("title");

      // Verify we are in a ticket
      const ticket = await client.db.ticket.findUnique({
        where: { channelId: interaction.channelId },
      });

      if (!ticket) {
        return interaction.reply({
          ...errorMessage({ description: "This command can only be used inside a ticket channel." }),
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: false });

      const title = titleOverride || `Ticket #${ticket.number}: ${ticket.subject || "Issue Report"}`;

      // In a real scenario, this would call GitHub API using an env variable GITHUB_TOKEN.
      // E.g.: await axios.post(`https://api.github.com/repos/${repo}/issues`, { title, body })
      
      const issueUrl = `https://github.com/${repo}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent("Exported from Ticket #" + ticket.number)}`;

      return interaction.editReply({
        ...successMessage({
          description: `Generated GitHub Issue Link: [Click here to create](${issueUrl})\n*(A dedicated API token needs to be configured in .env to auto-post)*`,
        }),
      });
    }
  },
} satisfies Command;
