import {
  ChannelType,
  OverwriteType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type TextChannel,
} from "discord.js";
import type { ModalComponent } from "../../types/index.js";
import { Bot } from "../../client/Bot.js";
import { logger } from "../../utils/logger.js";

export default {
  customId: /^ticket_modal/,

  async execute(interaction, client: Bot) {
    const guildId = interaction.guildId!;
    const guild = interaction.guild!;
    const user = interaction.user;

    // Get subject from modal fields
    const subject = interaction.fields.getTextInputValue("subject") || null;

    // Extract category from customId if present (ticket_modal_CategoryName)
    const parts = interaction.customId.split("_");
    const category = parts.length > 2 ? parts.slice(2).join("_") : null;

    await interaction.deferReply({ ephemeral: true });

    try {
      // Fetch guild config
      const config = await client.api.getGuildConfig(guildId);

      if (!config.ticket_category_id) {
        await interaction.editReply({
          content:
            "Ticket system is not configured. An administrator needs to set the ticket category.",
        });
        return;
      }

      // Get current ticket count and increment
      const ticketNumber = config.ticket_counter + 1;

      // Build permission overwrites
      const permissionOverwrites: Array<{
        id: string;
        type: OverwriteType;
        allow?: string[];
        deny?: string[];
      }> = [
        {
          id: guild.roles.everyone.id,
          type: OverwriteType.Role,
          deny: ["ViewChannel"],
        },
        {
          id: user.id,
          type: OverwriteType.Member,
          allow: [
            "ViewChannel",
            "SendMessages",
            "AttachFiles",
            "ReadMessageHistory",
          ],
        },
        {
          id: client.user!.id,
          type: OverwriteType.Member,
          allow: [
            "ViewChannel",
            "SendMessages",
            "ManageChannels",
            "ManageMessages",
          ],
        },
      ];

      // Add support role if configured
      if (config.ticket_support_role) {
        permissionOverwrites.push({
          id: config.ticket_support_role,
          type: OverwriteType.Role,
          allow: [
            "ViewChannel",
            "SendMessages",
            "AttachFiles",
            "ReadMessageHistory",
          ],
        });
      }

      // Create channel name
      const channelName = category
        ? `${category.toLowerCase()}-${ticketNumber.toString().padStart(4, "0")}`
        : `ticket-${ticketNumber.toString().padStart(4, "0")}`;

      // Create the Discord channel
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: config.ticket_category_id,
        topic: `Ticket by ${user.tag} | ${category ?? "General"} | ${subject ?? "No subject"}`,
        permissionOverwrites: permissionOverwrites as any,
      });

      // Save ticket via the backend
      await client.api.createTicket({
        guildId,
        number: ticketNumber,
        channelId: channel.id,
        userId: user.id,
        category: category ?? undefined,
        subject: subject ?? undefined,
      });

      // Update ticket counter in guild config
      await client.api.updateGuildConfig(guildId, {
        ticket_counter: ticketNumber,
      });

      // Build welcome embed
      const welcomeEmbed = new EmbedBuilder()
        .setTitle(
          `Ticket #${ticketNumber.toString().padStart(4, "0")}`,
        )
        .setDescription(
          [
            `Welcome ${user.toString()}!`,
            "",
            category ? `**Category:** ${category}` : null,
            subject ? `**Subject:** ${subject}` : null,
            `**Priority:** Normal`,
            "",
            "A staff member will respond to you shortly.",
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .setColor(0x5865f2)
        .setFooter({
          text: "Staff: Use the buttons below or /ticket",
        })
        .setTimestamp();

      // Build action buttons
      const ticketButtons =
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("ticket_claim")
            .setLabel("Claim")
            .setStyle(ButtonStyle.Success)
            .setEmoji("✋"),
          new ButtonBuilder()
            .setCustomId("ticket_close")
            .setLabel("Close")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("🔒"),
        );

      // Send welcome message with ping
      const pingContent = config.ticket_support_role
        ? `<@${user.id}> <@&${config.ticket_support_role}>`
        : `<@${user.id}>`;

      await channel.send({
        content: pingContent,
        embeds: [welcomeEmbed],
        components: [ticketButtons],
      });

      // Reply to the user
      await interaction.editReply({
        content: `Your ticket has been created: ${channel.toString()}`,
      });
    } catch (error) {
      logger.error("Failed to create ticket from modal:", error);
      await interaction.editReply({
        content: "An error occurred while creating your ticket.",
      });
    }
  },
} satisfies ModalComponent;
