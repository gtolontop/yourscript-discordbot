import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  ChannelType,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/index.js";
import type { Bot } from "../../client/Bot.js";
import {
  successMessage,
  errorMessage,
  createMessage,
  warningMessage,
  Colors,
} from "../../utils/index.js";

const buttonStyles: Record<string, ButtonStyle> = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
};

const data = new SlashCommandBuilder()
  .setName("role-menu")
  .setDescription("Role menu management (button-based role assignment)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Create a new role menu panel")
      .addStringOption((opt) =>
        opt
          .setName("title")
          .setDescription("Panel title")
          .setRequired(true)
          .setMaxLength(100)
      )
      .addRoleOption((opt) =>
        opt
          .setName("role")
          .setDescription("First role to add to the panel")
          .setRequired(true)
      )
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Channel for the panel (default: current)")
          .addChannelTypes(ChannelType.GuildText)
      )
      .addStringOption((opt) =>
        opt
          .setName("description")
          .setDescription("Panel description")
          .setMaxLength(1000)
      )
      .addStringOption((opt) =>
        opt
          .setName("color")
          .setDescription("Embed color (hex, e.g. #FF5733)")
          .setMaxLength(7)
      )
      .addStringOption((opt) =>
        opt.setName("label").setDescription("Button label").setMaxLength(80)
      )
      .addStringOption((opt) =>
        opt.setName("emoji").setDescription("Button emoji")
      )
      .addStringOption((opt) =>
        opt
          .setName("style")
          .setDescription("Button style")
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
      .setName("delete")
      .setDescription("Delete a role menu by message ID")
      .addStringOption((opt) =>
        opt
          .setName("message-id")
          .setDescription("Message ID of the role menu panel")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("List all role menus in the server")
  );

async function execute(
  interaction: ChatInputCommandInteraction,
  client: Bot
): Promise<unknown> {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;

  // ─── Create ─────────────────────────────────────────────────────────
  if (subcommand === "create") {
    const title = interaction.options.getString("title", true);
    const role = interaction.options.getRole("role", true);
    const channel = (interaction.options.getChannel("channel") ??
      interaction.channel) as TextChannel;
    const description =
      interaction.options.getString("description") ??
      "Click a button below to get or remove a role.";
    const colorStr = interaction.options.getString("color");
    const label = interaction.options.getString("label") ?? role.name;
    const emoji = interaction.options.getString("emoji");
    const style = interaction.options.getString("style") ?? "primary";

    // Parse color
    let color: number = Colors.Primary;
    if (colorStr) {
      const parsed = parseInt(colorStr.replace("#", ""), 16);
      if (!isNaN(parsed)) color = parsed;
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setFooter({ text: "Click a button to toggle a role" });

    // Build button
    const button = new ButtonBuilder()
      .setCustomId(`rr_${role.id}`)
      .setLabel(label)
      .setStyle(buttonStyles[style] ?? ButtonStyle.Primary);

    if (emoji) {
      button.setEmoji(emoji);
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    const message = await channel.send({
      embeds: [embed],
      components: [row],
    });

    try {
      // Save to backend
      await client.api.createReactionRoles(guildId, {
        channelId: channel.id,
        messageId: message.id,
        roles: [
          {
            roleId: role.id,
            emoji: emoji ?? "",
            label,
            style,
          },
        ],
      });

      return interaction.reply({
        ...successMessage({
          description: [
            `Role menu created in <#${channel.id}>`,
            `**Message ID:** \`${message.id}\``,
            `**Role:** ${role.toString()}`,
          ].join("\n"),
        }),
        ephemeral: true,
      });
    } catch (error) {
      console.error(error);
      await message.delete().catch(() => {});
      return interaction.reply({
        ...errorMessage({ description: "Failed to create role menu." }),
        ephemeral: true,
      });
    }
  }

  // ─── Delete ─────────────────────────────────────────────────────────
  if (subcommand === "delete") {
    const messageId = interaction.options.getString("message-id", true);

    try {
      const reactionRoles = await client.api.getReactionRoles(guildId);
      const matching = reactionRoles.filter(
        (rr) => rr.message_id === messageId
      );

      if (matching.length === 0) {
        return interaction.reply({
          ...errorMessage({
            description: "No role menu found with that message ID.",
          }),
          ephemeral: true,
        });
      }

      // Delete the message
      const channelId = matching[0]!.channel_id;
      const channel = interaction.guild?.channels.cache.get(
        channelId
      ) as TextChannel;
      if (channel) {
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (msg) await msg.delete().catch(() => {});
      }

      // Delete from backend
      await client.api.deleteReactionRoles(guildId, messageId);

      return interaction.reply(
        successMessage({
          description: `Role menu deleted (${matching.length} role(s) removed).`,
        })
      );
    } catch (error) {
      console.error(error);
      return interaction.reply({
        ...errorMessage({ description: "Failed to delete role menu." }),
        ephemeral: true,
      });
    }
  }

  // ─── List ───────────────────────────────────────────────────────────
  if (subcommand === "list") {
    try {
      const reactionRoles = await client.api.getReactionRoles(guildId);

      if (reactionRoles.length === 0) {
        return interaction.reply(
          warningMessage({ description: "No role menus configured." })
        );
      }

      // Group by message
      const byMessage = new Map<
        string,
        typeof reactionRoles
      >();
      for (const rr of reactionRoles) {
        const key = `${rr.channel_id}-${rr.message_id}`;
        if (!byMessage.has(key)) byMessage.set(key, []);
        byMessage.get(key)!.push(rr);
      }

      const lines = Array.from(byMessage.entries()).map(([key, roles]) => {
        const [channelId, messageId] = key.split("-");
        const rolesList = roles.map((r) => `<@&${r.role_id}>`).join(", ");
        return `**<#${channelId}>** (\`${messageId}\`)\n  ${rolesList}`;
      });

      const embed = new EmbedBuilder()
        .setTitle("Role Menus")
        .setDescription(lines.join("\n\n"))
        .setColor(Colors.Primary)
        .setFooter({
          text: `${reactionRoles.length} role(s) across ${byMessage.size} panel(s)`,
        });

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      return interaction.reply({
        ...errorMessage({ description: "Failed to fetch role menus." }),
        ephemeral: true,
      });
    }
  }

  return interaction.reply({
    ...errorMessage({ description: "Unknown subcommand." }),
    ephemeral: true,
  });
}

export default { data, execute } satisfies Command;
