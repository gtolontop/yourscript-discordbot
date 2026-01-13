import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "../../types/index.js";
import { successMessage, errorMessage, Colors } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("autorole")
    .setDescription("Système d'auto-role à l'arrivée")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Ajouter un rôle automatique")
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("Le rôle à donner automatiquement")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Retirer un rôle automatique")
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("Le rôle à retirer de la liste")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("Voir les rôles automatiques")
    )
    .addSubcommand((sub) =>
      sub.setName("clear").setDescription("Supprimer tous les rôles automatiques")
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (subcommand === "add") {
      const role = interaction.options.getRole("role", true);

      // Check if role can be managed
      const botMember = interaction.guild?.members.me;
      if (!botMember || botMember.roles.highest.position <= role.position) {
        return interaction.reply({
          ...errorMessage({ description: "Je ne peux pas gérer ce rôle (position trop haute)." }),
          ephemeral: true,
        });
      }

      // Check if already exists
      const existing = await client.db.autoRole.findUnique({
        where: { guildId_roleId: { guildId, roleId: role.id } },
      });

      if (existing) {
        return interaction.reply({
          ...errorMessage({ description: "Ce rôle est déjà dans la liste." }),
          ephemeral: true,
        });
      }

      await client.db.autoRole.create({
        data: { guildId, roleId: role.id },
      });

      return interaction.reply(
        successMessage({
          description: `${role.toString()} sera donné automatiquement aux nouveaux membres.`,
        })
      );
    }

    if (subcommand === "remove") {
      const role = interaction.options.getRole("role", true);

      const autoRole = await client.db.autoRole.findUnique({
        where: { guildId_roleId: { guildId, roleId: role.id } },
      });

      if (!autoRole) {
        return interaction.reply({
          ...errorMessage({ description: "Ce rôle n'est pas dans la liste." }),
          ephemeral: true,
        });
      }

      await client.db.autoRole.delete({
        where: { id: autoRole.id },
      });

      return interaction.reply(
        successMessage({
          description: `${role.toString()} retiré de la liste des auto-roles.`,
        })
      );
    }

    if (subcommand === "list") {
      const autoRoles = await client.db.autoRole.findMany({
        where: { guildId },
      });

      if (autoRoles.length === 0) {
        return interaction.reply({
          ...errorMessage({ description: "Aucun auto-role configuré." }),
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("🤖 Auto-roles")
        .setDescription(
          autoRoles.map((ar, i) => `**${i + 1}.** <@&${ar.roleId}>`).join("\n")
        )
        .setColor(Colors.Primary)
        .setFooter({ text: `${autoRoles.length} rôle(s)` });

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "clear") {
      const deleted = await client.db.autoRole.deleteMany({
        where: { guildId },
      });

      return interaction.reply(
        successMessage({
          description: `${deleted.count} auto-role(s) supprimé(s).`,
        })
      );
    }
  },
} satisfies Command;
