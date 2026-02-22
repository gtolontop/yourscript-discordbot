import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "../../types/index.js";
import { successMessage, errorMessage, Colors } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("autorole")
    .setDescription("Auto-role system on member join")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add an auto role")
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("The role to assign automatically")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove an auto role")
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("The role to remove from the list")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("View auto roles")
    )
    .addSubcommand((sub) =>
      sub.setName("clear").setDescription("Delete all auto roles")
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
          ...errorMessage({ description: "I cannot manage this role (position too high)." }),
          ephemeral: true,
        });
      }

      // Check if already exists
      const existing = await client.db.autoRole.findUnique({
        where: { guildId_roleId: { guildId, roleId: role.id } },
      });

      if (existing) {
        return interaction.reply({
          ...errorMessage({ description: "This role is already in the list." }),
          ephemeral: true,
        });
      }

      await client.db.autoRole.create({
        data: { guildId, roleId: role.id },
      });

      return interaction.reply(
        successMessage({
          description: `${role.toString()} will be automatically assigned to new members.`,
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
          ...errorMessage({ description: "This role is not in the list." }),
          ephemeral: true,
        });
      }

      await client.db.autoRole.delete({
        where: { id: autoRole.id },
      });

      return interaction.reply(
        successMessage({
          description: `${role.toString()} removed from the auto-roles list.`,
        })
      );
    }

    if (subcommand === "list") {
      const autoRoles = await client.db.autoRole.findMany({
        where: { guildId },
      });

      if (autoRoles.length === 0) {
        return interaction.reply({
          ...errorMessage({ description: "No auto roles configured." }),
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("🤖 Auto-roles")
        .setDescription(
          autoRoles.map((ar, i) => `**${i + 1}.** <@&${ar.roleId}>`).join("\n")
        )
        .setColor(Colors.Primary)
        .setFooter({ text: `${autoRoles.length} role(s)` });

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "clear") {
      const deleted = await client.db.autoRole.deleteMany({
        where: { guildId },
      });

      return interaction.reply(
        successMessage({
          description: `${deleted.count} auto-role(s) deleted.`,
        })
      );
    }
  },
} satisfies Command;
