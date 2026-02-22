import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import type { Command } from "../../types/index.js";
import { createMessage, successMessage, errorMessage } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("team")
    .setDescription("Manage team members")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a team member")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("Discord user").setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("role")
            .setDescription("Team role")
            .setRequired(true)
            .addChoices(
              { name: "Owner", value: "owner" },
              { name: "Manager", value: "manager" },
              { name: "Developer", value: "developer" },
              { name: "Designer", value: "designer" },
              { name: "Support", value: "support" }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName("specialties")
            .setDescription("Specialties separated by commas (e.g. fivem,discord,web)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a team member")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("Discord user").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all team members")
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Edit a team member")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("Discord user").setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("role")
            .setDescription("New team role")
            .setRequired(false)
            .addChoices(
              { name: "Owner", value: "owner" },
              { name: "Manager", value: "manager" },
              { name: "Developer", value: "developer" },
              { name: "Designer", value: "designer" },
              { name: "Support", value: "support" }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName("specialties")
            .setDescription("New specialties (comma separated)")
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName("available").setDescription("Available for assignments").setRequired(false)
        )
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    switch (sub) {
      case "add": {
        const user = interaction.options.getUser("user", true);
        const role = interaction.options.getString("role", true);
        const specialtiesStr = interaction.options.getString("specialties");
        const specialties = specialtiesStr
          ? JSON.stringify(specialtiesStr.split(",").map((s) => s.trim().toLowerCase()))
          : "[]";

        // Check if already exists
        const existing = await client.db.teamMember.findUnique({
          where: { guildId_userId: { guildId, userId: user.id } },
        });

        if (existing) {
          return interaction.reply(
            errorMessage({ description: `${user.toString()} is already a team member.` })
          );
        }

        await client.db.teamMember.create({
          data: {
            guildId,
            userId: user.id,
            name: user.displayName ?? user.username,
            role,
            specialties,
          },
        });

        const roleEmoji: Record<string, string> = {
          owner: "👑",
          manager: "📊",
          developer: "💻",
          designer: "🎨",
          support: "🎧",
        };

        return interaction.reply(
          successMessage({
            description: `${roleEmoji[role] ?? "👤"} ${user.toString()} added as **${role}**${specialtiesStr ? ` (${specialtiesStr})` : ""}.`,
          })
        );
      }

      case "remove": {
        const user = interaction.options.getUser("user", true);

        const member = await client.db.teamMember.findUnique({
          where: { guildId_userId: { guildId, userId: user.id } },
        });

        if (!member) {
          return interaction.reply(
            errorMessage({ description: `${user.toString()} is not a team member.` })
          );
        }

        await client.db.teamMember.delete({
          where: { guildId_userId: { guildId, userId: user.id } },
        });

        return interaction.reply(
          successMessage({ description: `${user.toString()} removed from the team.` })
        );
      }

      case "list": {
        const members = await client.db.teamMember.findMany({
          where: { guildId },
          orderBy: { createdAt: "asc" },
        });

        if (members.length === 0) {
          return interaction.reply(
            createMessage({
              title: "Team",
              description: "No team members. Use `/team add` to add someone.",
              color: "Info",
            })
          );
        }

        const roleEmoji: Record<string, string> = {
          owner: "👑",
          manager: "📊",
          developer: "💻",
          designer: "🎨",
          support: "🎧",
        };

        const lines = members.map((m) => {
          const emoji = roleEmoji[m.role] ?? "👤";
          const specs = JSON.parse(m.specialties || "[]") as string[];
          const specsStr = specs.length > 0 ? ` (${specs.join(", ")})` : "";
          const status = m.available ? "🟢" : "🔴";
          return `${status} ${emoji} <@${m.userId}> — **${m.role}**${specsStr}`;
        });

        return interaction.reply(
          createMessage({
            title: "Team",
            description: lines.join("\n"),
            color: "Info",
            footer: `${members.length} member(s)`,
          })
        );
      }

      case "edit": {
        const user = interaction.options.getUser("user", true);
        const role = interaction.options.getString("role");
        const specialtiesStr = interaction.options.getString("specialties");
        const available = interaction.options.getBoolean("available");

        const member = await client.db.teamMember.findUnique({
          where: { guildId_userId: { guildId, userId: user.id } },
        });

        if (!member) {
          return interaction.reply(
            errorMessage({ description: `${user.toString()} is not a team member.` })
          );
        }

        const updateData: any = {};
        if (role) updateData.role = role;
        if (specialtiesStr !== null && specialtiesStr !== undefined) {
          updateData.specialties = JSON.stringify(
            specialtiesStr.split(",").map((s) => s.trim().toLowerCase())
          );
        }
        if (available !== null && available !== undefined) {
          updateData.available = available;
        }

        if (Object.keys(updateData).length === 0) {
          return interaction.reply(
            errorMessage({ description: "No changes specified." })
          );
        }

        await client.db.teamMember.update({
          where: { guildId_userId: { guildId, userId: user.id } },
          data: updateData,
        });

        const changes = [];
        if (role) changes.push(`Role: **${role}**`);
        if (specialtiesStr) changes.push(`Specialties: ${specialtiesStr}`);
        if (available !== null && available !== undefined) changes.push(`Available: ${available ? "Yes" : "No"}`);

        return interaction.reply(
          successMessage({
            description: `Updated ${user.toString()}:\n${changes.join("\n")}`,
          })
        );
      }
    }
  },
} satisfies Command;
