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
    .setDescription("Système de reaction roles")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Créer un panneau de reaction roles")
        .addStringOption((opt) =>
          opt
            .setName("titre")
            .setDescription("Titre du panneau")
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption((opt) =>
          opt
            .setName("description")
            .setDescription("Description du panneau")
            .setRequired(false)
            .setMaxLength(1000)
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel pour le panneau (défaut: actuel)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Ajouter un bouton de rôle à un panneau existant")
        .addStringOption((opt) =>
          opt
            .setName("message_id")
            .setDescription("ID du message du panneau")
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("Le rôle à ajouter")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("label")
            .setDescription("Texte du bouton")
            .setRequired(false)
            .setMaxLength(80)
        )
        .addStringOption((opt) =>
          opt
            .setName("emoji")
            .setDescription("Emoji du bouton")
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("style")
            .setDescription("Style du bouton")
            .setRequired(false)
            .addChoices(
              { name: "Bleu (Primary)", value: "primary" },
              { name: "Gris (Secondary)", value: "secondary" },
              { name: "Vert (Success)", value: "success" },
              { name: "Rouge (Danger)", value: "danger" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Retirer un rôle d'un panneau")
        .addStringOption((opt) =>
          opt
            .setName("message_id")
            .setDescription("ID du message du panneau")
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("Le rôle à retirer")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("Voir tous les panneaux de reaction roles")
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (subcommand === "create") {
      const title = interaction.options.getString("titre", true);
      const description = interaction.options.getString("description") ?? "Clique sur un bouton pour obtenir/retirer un rôle.";
      const channel = (interaction.options.getChannel("channel") ?? interaction.channel) as TextChannel;

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(Colors.Primary)
        .setFooter({ text: "Utilise /reactionrole add pour ajouter des rôles" });

      const message = await channel.send({ embeds: [embed] });

      return interaction.reply({
        ...successMessage({
          description: `Panneau créé dans <#${channel.id}>\n**ID:** \`${message.id}\`\n\nUtilise \`/reactionrole add\` pour ajouter des boutons.`,
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
          ...errorMessage({ description: "Ce rôle est déjà sur ce panneau." }),
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
          ...errorMessage({ description: "Message introuvable." }),
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
          ...errorMessage({ description: "Limite de 25 boutons par panneau atteinte." }),
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
          description: `Bouton ajouté pour le rôle ${role.toString()}`,
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
          ...errorMessage({ description: "Ce rôle n'est pas sur ce panneau." }),
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
          description: `Bouton retiré pour le rôle ${role.toString()}`,
        })
      );
    }

    if (subcommand === "list") {
      const reactionRoles = await client.db.reactionRole.findMany({
        where: { guildId },
      });

      if (reactionRoles.length === 0) {
        return interaction.reply({
          ...errorMessage({ description: "Aucun reaction role configuré." }),
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
        .setFooter({ text: `${reactionRoles.length} rôle(s) configuré(s)` });

      return interaction.reply({ embeds: [embed] });
    }
  },
} satisfies Command;

function buildButtonRows(roles: { roleId: string; emoji: string; label: string; style: string }[]): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();

  for (const role of roles) {
    const button = new ButtonBuilder()
      .setCustomId(`rr_${role.roleId}`)
      .setLabel(role.label)
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
