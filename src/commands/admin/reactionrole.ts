import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
} from "discord.js";
import type { Command } from "../../types/index.js";
import { successMessage, errorMessage, Colors } from "../../utils/index.js";

const buttonStyles: Record<string, ButtonStyle> = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
};

export default {
  data: new SlashCommandBuilder()
    .setName("reactionrole")
    .setDescription("Reaction role system")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a reaction role panel")
        .addStringOption((opt) =>
          opt
            .setName("titre")
            .setDescription("Panel title")
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption((opt) =>
          opt
            .setName("description")
            .setDescription("Panel description")
            .setRequired(false)
            .setMaxLength(1000)
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel for the panel (default: current)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a role button to an existing panel")
        .addStringOption((opt) =>
          opt
            .setName("message_id")
            .setDescription("Panel message ID")
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("The role to add")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("label")
            .setDescription("Button text")
            .setRequired(false)
            .setMaxLength(80)
        )
        .addStringOption((opt) =>
          opt
            .setName("emoji")
            .setDescription("Button emoji")
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("style")
            .setDescription("Button style")
            .setRequired(false)
            .addChoices(
              { name: "Blue (Primary)", value: "primary" },
              { name: "Gray (Secondary)", value: "secondary" },
              { name: "Green (Success)", value: "success" },
              { name: "Red (Danger)", value: "danger" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a role from a panel")
        .addStringOption((opt) =>
          opt
            .setName("message_id")
            .setDescription("Panel message ID")
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("The role to remove")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("View all reaction role panels")
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (subcommand === "create") {
      const title = interaction.options.getString("titre", true);
      const description = interaction.options.getString("description") ?? "Click a button to get/remove a role.";
      const channel = (interaction.options.getChannel("channel") ?? interaction.channel) as TextChannel;

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(Colors.Primary)
        .setFooter({ text: "Use /reactionrole add to add roles" });

      const message = await channel.send({ embeds: [embed] });

      return interaction.reply({
        ...successMessage({
          description: `Panel created in <#${channel.id}>\n**ID:** \`${message.id}\`\n\nUse \`/reactionrole add\` to add buttons.`,
        }),
        ephemeral: true,
      });
    }

    if (subcommand === "add") {
      const messageId = interaction.options.getString("message_id", true);
      const role = interaction.options.getRole("role", true);
      const label = interaction.options.getString("label") ?? role.name;
      const emoji = interaction.options.getString("emoji");
      const style = interaction.options.getString("style") ?? "primary";

      // Check if role already exists on this message
      const existing = await client.db.reactionRole.findFirst({
        where: { messageId, roleId: role.id },
      });

      if (existing) {
        return interaction.reply({
          ...errorMessage({ description: "This role is already on this panel." }),
          ephemeral: true,
        });
      }

      // Find the message
      let targetMessage;
      for (const [, channel] of interaction.guild!.channels.cache) {
        if (channel.isTextBased()) {
          targetMessage = await (channel as TextChannel).messages.fetch(messageId).catch(() => null);
          if (targetMessage) break;
        }
      }

      if (!targetMessage) {
        return interaction.reply({
          ...errorMessage({ description: "Message not found." }),
          ephemeral: true,
        });
      }

      // Get existing reaction roles for this message
      const existingRoles = await client.db.reactionRole.findMany({
        where: { messageId },
      });

      // Check button limit (5 per row, 5 rows max = 25 buttons)
      if (existingRoles.length >= 25) {
        return interaction.reply({
          ...errorMessage({ description: "Limit of 25 buttons per panel reached." }),
          ephemeral: true,
        });
      }

      // Save to DB
      await client.db.reactionRole.create({
        data: {
          guildId,
          channelId: targetMessage.channelId,
          messageId,
          roleId: role.id,
          emoji: emoji ?? "",
          label,
          style,
        },
      });

      // Rebuild buttons
      const allRoles = [...existingRoles, { roleId: role.id, emoji: emoji ?? "", label, style }];
      const rows = buildButtonRows(allRoles);

      await targetMessage.edit({ components: rows });

      return interaction.reply(
        successMessage({
          description: `Button added for role ${role.toString()}`,
        })
      );
    }

    if (subcommand === "remove") {
      const messageId = interaction.options.getString("message_id", true);
      const role = interaction.options.getRole("role", true);

      const reactionRole = await client.db.reactionRole.findFirst({
        where: { messageId, roleId: role.id },
      });

      if (!reactionRole) {
        return interaction.reply({
          ...errorMessage({ description: "This role is not on this panel." }),
          ephemeral: true,
        });
      }

      // Delete from DB
      await client.db.reactionRole.delete({
        where: { id: reactionRole.id },
      });

      // Find the message and rebuild buttons
      let targetMessage;
      for (const [, channel] of interaction.guild!.channels.cache) {
        if (channel.isTextBased()) {
          targetMessage = await (channel as TextChannel).messages.fetch(messageId).catch(() => null);
          if (targetMessage) break;
        }
      }

      if (targetMessage) {
        const remainingRoles = await client.db.reactionRole.findMany({
          where: { messageId },
        });

        const rows = buildButtonRows(remainingRoles);
        await targetMessage.edit({ components: rows });
      }

      return interaction.reply(
        successMessage({
          description: `Button removed for role ${role.toString()}`,
        })
      );
    }

    if (subcommand === "list") {
      const reactionRoles = await client.db.reactionRole.findMany({
        where: { guildId },
      });

      if (reactionRoles.length === 0) {
        return interaction.reply({
          ...errorMessage({ description: "No reaction roles configured." }),
          ephemeral: true,
        });
      }

      // Group by message
      const byMessage = new Map<string, typeof reactionRoles>();
      for (const rr of reactionRoles) {
        const key = `${rr.channelId}-${rr.messageId}`;
        if (!byMessage.has(key)) byMessage.set(key, []);
        byMessage.get(key)!.push(rr);
      }

      const lines = Array.from(byMessage.entries()).map(([key, roles]) => {
        const [channelId, messageId] = key.split("-");
        const rolesList = roles.map((r) => `<@&${r.roleId}>`).join(", ");
        return `**<#${channelId}>** (${messageId})\n└ ${rolesList}`;
      });

      const embed = new EmbedBuilder()
        .setTitle("🎭 Reaction Roles")
        .setDescription(lines.join("\n\n"))
        .setColor(Colors.Primary)
        .setFooter({ text: `${reactionRoles.length} role(s) configured` });

      return interaction.reply({ embeds: [embed] });
    }
  },
} satisfies Command;

function buildButtonRows(roles: { roleId: string; emoji: string; label: string | null; style: string }[]): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();

  for (const role of roles) {
    const button = new ButtonBuilder()
      .setCustomId(`rr_${role.roleId}`)
      .setLabel(role.label ?? "Role")
      .setStyle(buttonStyles[role.style] ?? ButtonStyle.Primary);

    if (role.emoji) {
      button.setEmoji(role.emoji);
    }

    currentRow.addComponents(button);

    if (currentRow.components.length === 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
    }
  }

  if (currentRow.components.length > 0) {
    rows.push(currentRow);
  }

  return rows;
}
