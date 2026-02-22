import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "../../types/index.js";
import { successMessage, errorMessage, Colors } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ticketblacklist")
    .setDescription("Manage the ticket blacklist")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a user to the blacklist")
        .addUserOption((opt) =>
          opt
            .setName("utilisateur")
            .setDescription("The user to blacklist")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("raison")
            .setDescription("Reason for the blacklist")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a user from the blacklist")
        .addUserOption((opt) =>
          opt
            .setName("utilisateur")
            .setDescription("The user to remove")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List blacklisted users")
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (subcommand === "add") {
      const user = interaction.options.getUser("utilisateur", true);
      const reason = interaction.options.getString("raison");

      // Check if already blacklisted
      const existing = await client.db.ticketBlacklist.findUnique({
        where: { guildId_userId: { guildId, userId: user.id } },
      });

      if (existing) {
        return interaction.reply({
          ...errorMessage({ description: `${user} is already blacklisted.` }),
          ephemeral: true,
        });
      }

      // Add to blacklist
      await client.db.ticketBlacklist.create({
        data: {
          guildId,
          userId: user.id,
          reason,
          addedBy: interaction.user.id,
        },
      });

      return interaction.reply(
        successMessage({
          description: `${user} has been added to the ticket blacklist.${reason ? `\n**Reason:** ${reason}` : ""}`,
        })
      );
    }

    if (subcommand === "remove") {
      const user = interaction.options.getUser("utilisateur", true);

      const blacklist = await client.db.ticketBlacklist.findUnique({
        where: { guildId_userId: { guildId, userId: user.id } },
      });

      if (!blacklist) {
        return interaction.reply({
          ...errorMessage({ description: `${user} is not blacklisted.` }),
          ephemeral: true,
        });
      }

      await client.db.ticketBlacklist.delete({
        where: { id: blacklist.id },
      });

      return interaction.reply(
        successMessage({
          description: `${user} has been removed from the ticket blacklist.`,
        })
      );
    }

    if (subcommand === "list") {
      const blacklisted = await client.db.ticketBlacklist.findMany({
        where: { guildId },
        orderBy: { createdAt: "desc" },
      });

      if (blacklisted.length === 0) {
        return interaction.reply({
          ...errorMessage({ description: "No blacklisted users." }),
          ephemeral: true,
        });
      }

      const lines = await Promise.all(
        blacklisted.map(async (bl, i) => {
          const user = await client.users.fetch(bl.userId).catch(() => null);
          const addedBy = await client.users.fetch(bl.addedBy).catch(() => null);
          let line = `**${i + 1}.** ${user?.tag ?? bl.userId}`;
          if (bl.reason) line += `\n   └ Reason: *${bl.reason}*`;
          line += `\n   └ By: ${addedBy?.tag ?? bl.addedBy}`;
          return line;
        })
      );

      const embed = new EmbedBuilder()
        .setTitle("🚫 Ticket Blacklist")
        .setDescription(lines.join("\n\n"))
        .setColor(Colors.Error)
        .setFooter({ text: `${blacklisted.length} user(s)` });

      return interaction.reply({ embeds: [embed] });
    }
  },
} satisfies Command;
