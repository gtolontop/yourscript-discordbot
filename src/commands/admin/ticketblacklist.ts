import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "../../types/index.js";
import { successMessage, errorMessage, Colors } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ticketblacklist")
    .setDescription("Gère la blacklist des tickets")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Ajoute un utilisateur à la blacklist")
        .addUserOption((opt) =>
          opt
            .setName("utilisateur")
            .setDescription("L'utilisateur à blacklist")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("raison")
            .setDescription("Raison de la blacklist")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Retire un utilisateur de la blacklist")
        .addUserOption((opt) =>
          opt
            .setName("utilisateur")
            .setDescription("L'utilisateur à retirer")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("Liste les utilisateurs blacklistés")
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
          ...errorMessage({ description: `${user} est déjà blacklisté.` }),
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
          description: `${user} a été ajouté à la blacklist des tickets.${reason ? `\n**Raison:** ${reason}` : ""}`,
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
          ...errorMessage({ description: `${user} n'est pas blacklisté.` }),
          ephemeral: true,
        });
      }

      await client.db.ticketBlacklist.delete({
        where: { id: blacklist.id },
      });

      return interaction.reply(
        successMessage({
          description: `${user} a été retiré de la blacklist des tickets.`,
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
          ...errorMessage({ description: "Aucun utilisateur blacklisté." }),
          ephemeral: true,
        });
      }

      const lines = await Promise.all(
        blacklisted.map(async (bl, i) => {
          const user = await client.users.fetch(bl.userId).catch(() => null);
          const addedBy = await client.users.fetch(bl.addedBy).catch(() => null);
          let line = `**${i + 1}.** ${user?.tag ?? bl.userId}`;
          if (bl.reason) line += `\n   └ Raison: *${bl.reason}*`;
          line += `\n   └ Par: ${addedBy?.tag ?? bl.addedBy}`;
          return line;
        })
      );

      const embed = new EmbedBuilder()
        .setTitle("🚫 Blacklist des tickets")
        .setDescription(lines.join("\n\n"))
        .setColor(Colors.Error)
        .setFooter({ text: `${blacklisted.length} utilisateur(s)` });

      return interaction.reply({ embeds: [embed] });
    }
  },
} satisfies Command;
