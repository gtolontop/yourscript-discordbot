import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  TextChannel,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/index.js";
import type { Bot } from "../../client/Bot.js";
import {
  successMessage,
  errorMessage,
  createMessage,
  warningMessage,
} from "../../utils/index.js";

const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Ticket management system")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName("setup")
      .setDescription("Set up the ticket system")
      .addChannelOption((opt) =>
        opt
          .setName("category")
          .setDescription("Category for ticket channels")
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(true)
      )
      .addChannelOption((opt) =>
        opt
          .setName("transcripts")
          .setDescription("Channel for ticket transcripts")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .addChannelOption((opt) =>
        opt
          .setName("review")
          .setDescription("Channel for staff reviews")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .addRoleOption((opt) =>
        opt
          .setName("support-role")
          .setDescription("Role that can view and manage tickets")
      )
  )
  .addSubcommand((sub) =>
    sub.setName("close").setDescription("Close the current ticket channel")
  )
  .addSubcommand((sub) =>
    sub.setName("claim").setDescription("Claim the current ticket")
  )
  .addSubcommand((sub) =>
    sub
      .setName("priority")
      .setDescription("Set the priority of the current ticket")
      .addStringOption((opt) =>
        opt
          .setName("level")
          .setDescription("Priority level")
          .setRequired(true)
          .addChoices(
            { name: "Low", value: "low" },
            { name: "Normal", value: "normal" },
            { name: "High", value: "high" },
            { name: "Urgent", value: "urgent" }
          )
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName("category")
      .setDescription("Manage ticket categories")
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Add a ticket category")
          .addStringOption((opt) =>
            opt
              .setName("name")
              .setDescription("Category name")
              .setRequired(true)
              .setMaxLength(50)
          )
          .addStringOption((opt) =>
            opt
              .setName("emoji")
              .setDescription("Category emoji")
              .setMaxLength(10)
          )
          .addStringOption((opt) =>
            opt
              .setName("description")
              .setDescription("Category description")
              .setMaxLength(200)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Remove a ticket category")
          .addStringOption((opt) =>
            opt
              .setName("name")
              .setDescription("Name of the category to remove")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub.setName("list").setDescription("List all ticket categories")
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName("blacklist")
      .setDescription("Manage ticket blacklist")
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Blacklist a user from creating tickets")
          .addUserOption((opt) =>
            opt
              .setName("user")
              .setDescription("User to blacklist")
              .setRequired(true)
          )
          .addStringOption((opt) =>
            opt.setName("reason").setDescription("Reason for blacklisting")
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Remove a user from the ticket blacklist")
          .addUserOption((opt) =>
            opt
              .setName("user")
              .setDescription("User to remove from blacklist")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("list")
          .setDescription("List all blacklisted users")
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("panel")
      .setDescription("Send a ticket panel embed with a create button")
  );

async function execute(
  interaction: ChatInputCommandInteraction,
  client: Bot
): Promise<unknown> {
  const guildId = interaction.guildId!;
  const subcommandGroup = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();

  // ─── Setup ──────────────────────────────────────────────────────────
  if (subcommand === "setup" && !subcommandGroup) {
    const category = interaction.options.getChannel("category", true);
    const transcripts = interaction.options.getChannel("transcripts", true);
    const review = interaction.options.getChannel("review", true);
    const supportRole = interaction.options.getRole("support-role");

    try {
      await client.api.updateGuildConfig(guildId, {
        ticket_category_id: category.id,
        ticket_transcript_channel: transcripts.id,
        ticket_review_channel: review.id,
        ticket_support_role: supportRole?.id ?? null,
      });

      return interaction.reply(
        successMessage({
          title: "Ticket System Configured",
          description: [
            `**Category:** ${category.name}`,
            `**Transcripts:** <#${transcripts.id}>`,
            `**Staff reviews:** <#${review.id}>`,
            supportRole ? `**Support role:** ${supportRole.name}` : null,
            "",
            "Use `/ticket panel` to create a ticket panel.",
          ]
            .filter(Boolean)
            .join("\n"),
        })
      );
    } catch (error) {
      console.error(error);
      return interaction.reply({
        ...errorMessage({ description: "Failed to configure ticket system." }),
        ephemeral: true,
      });
    }
  }

  // ─── Panel ──────────────────────────────────────────────────────────
  if (subcommand === "panel" && !subcommandGroup) {
    const config = await client.api.getGuildConfig(guildId);

    if (!config.ticket_category_id) {
      return interaction.reply({
        ...errorMessage({
          description:
            "Set up the ticket system first with `/ticket setup`.",
        }),
        ephemeral: true,
      });
    }

    // Show modal to configure the panel
    const modal = new ModalBuilder()
      .setCustomId("ticket_panel_create")
      .setTitle("Create Ticket Panel");

    const titleInput = new TextInputBuilder()
      .setCustomId("panel_title")
      .setLabel("Panel title")
      .setPlaceholder("Support")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const descInput = new TextInputBuilder()
      .setCustomId("panel_description")
      .setLabel("Description")
      .setPlaceholder("Click the button below to create a ticket...")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    const buttonTextInput = new TextInputBuilder()
      .setCustomId("panel_button_text")
      .setLabel("Button text")
      .setPlaceholder("Create Ticket")
      .setValue("Create Ticket")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const buttonEmojiInput = new TextInputBuilder()
      .setCustomId("panel_button_emoji")
      .setLabel("Button emoji (optional)")
      .setPlaceholder("🎫")
      .setValue("🎫")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(10);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(buttonTextInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(buttonEmojiInput)
    );

    return interaction.showModal(modal);
  }

  // ─── Close ──────────────────────────────────────────────────────────
  if (subcommand === "close" && !subcommandGroup) {
    const channel = interaction.channel as TextChannel;

    try {
      const { tickets } = await client.api.listTickets(guildId, "open");
      const ticket = tickets.find((t) => t.channel_id === channel.id);

      if (!ticket) {
        return interaction.reply({
          ...errorMessage({
            description: "This channel is not an open ticket.",
          }),
          ephemeral: true,
        });
      }

      await interaction.reply(
        warningMessage({ description: "Closing ticket..." })
      );

      await client.api.closeTicket(guildId, ticket.id, interaction.user.id);

      // Delete the channel after a short delay
      setTimeout(async () => {
        try {
          await channel.delete();
        } catch {
          // Channel may already be deleted
        }
      }, 5000);

      return;
    } catch (error) {
      console.error(error);
      return interaction.reply({
        ...errorMessage({ description: "Failed to close ticket." }),
        ephemeral: true,
      });
    }
  }

  // ─── Claim ──────────────────────────────────────────────────────────
  if (subcommand === "claim" && !subcommandGroup) {
    const channel = interaction.channel as TextChannel;

    try {
      const { tickets } = await client.api.listTickets(guildId, "open");
      const ticket = tickets.find((t) => t.channel_id === channel.id);

      if (!ticket) {
        return interaction.reply({
          ...errorMessage({
            description: "This channel is not an open ticket.",
          }),
          ephemeral: true,
        });
      }

      if (ticket.claimed_by) {
        return interaction.reply({
          ...errorMessage({
            description: `This ticket is already claimed by <@${ticket.claimed_by}>.`,
          }),
          ephemeral: true,
        });
      }

      await client.api.claimTicket(guildId, ticket.id);

      await channel.setTopic(
        `Ticket by <@${ticket.user_id}> | ${ticket.subject ?? "No subject"} | Claimed by ${interaction.user.tag}`
      );

      return interaction.reply(
        successMessage({
          description: `${interaction.user.toString()} has claimed this ticket.`,
        })
      );
    } catch (error) {
      console.error(error);
      return interaction.reply({
        ...errorMessage({ description: "Failed to claim ticket." }),
        ephemeral: true,
      });
    }
  }

  // ─── Priority ───────────────────────────────────────────────────────
  if (subcommand === "priority" && !subcommandGroup) {
    const channel = interaction.channel as TextChannel;
    const priority = interaction.options.getString("level", true);

    try {
      const { tickets } = await client.api.listTickets(guildId, "open");
      const ticket = tickets.find((t) => t.channel_id === channel.id);

      if (!ticket) {
        return interaction.reply({
          ...errorMessage({
            description: "This channel is not an open ticket.",
          }),
          ephemeral: true,
        });
      }

      await client.api.updateTicketPriority(guildId, ticket.id, priority);

      const priorityLabels: Record<string, string> = {
        low: "Low",
        normal: "Normal",
        high: "High",
        urgent: "Urgent",
      };

      // Rename channel with priority prefix for urgent/high
      if (priority === "urgent" || priority === "high") {
        const prefix = priority === "urgent" ? "urgent" : "high";
        const baseName = channel.name
          .replace(/^(urgent|high)-/, "");
        await channel.setName(`${prefix}-${baseName}`).catch(() => {});
      } else {
        const baseName = channel.name
          .replace(/^(urgent|high)-/, "");
        await channel.setName(baseName).catch(() => {});
      }

      return interaction.reply(
        successMessage({
          description: `Priority set to **${priorityLabels[priority]}**.`,
        })
      );
    } catch (error) {
      console.error(error);
      return interaction.reply({
        ...errorMessage({ description: "Failed to set priority." }),
        ephemeral: true,
      });
    }
  }

  // ─── Category Add ──────────────────────────────────────────────────
  if (subcommandGroup === "category" && subcommand === "add") {
    const name = interaction.options.getString("name", true);
    const emoji = interaction.options.getString("emoji");
    const description = interaction.options.getString("description");

    try {
      await client.api.createTicketCategory(guildId, {
        name,
        emoji: emoji ?? undefined,
        description: description ?? undefined,
      });

      return interaction.reply(
        successMessage({
          description: `Ticket category **${emoji ? `${emoji} ` : ""}${name}** has been created.`,
        })
      );
    } catch (error) {
      console.error(error);
      return interaction.reply({
        ...errorMessage({ description: "Failed to create ticket category." }),
        ephemeral: true,
      });
    }
  }

  // ─── Category Remove ───────────────────────────────────────────────
  if (subcommandGroup === "category" && subcommand === "remove") {
    const name = interaction.options.getString("name", true);

    try {
      const categories = await client.api.getTicketCategories(guildId);
      const category = categories.find(
        (c) => c.name.toLowerCase() === name.toLowerCase()
      );

      if (!category) {
        return interaction.reply({
          ...errorMessage({
            description: `No ticket category found with name **${name}**.`,
          }),
          ephemeral: true,
        });
      }

      await client.api.deleteTicketCategory(guildId, category.id);

      return interaction.reply(
        successMessage({
          description: `Ticket category **${name}** has been removed.`,
        })
      );
    } catch (error) {
      console.error(error);
      return interaction.reply({
        ...errorMessage({ description: "Failed to remove ticket category." }),
        ephemeral: true,
      });
    }
  }

  // ─── Category List ─────────────────────────────────────────────────
  if (subcommandGroup === "category" && subcommand === "list") {
    try {
      const categories = await client.api.getTicketCategories(guildId);

      if (categories.length === 0) {
        return interaction.reply(
          warningMessage({
            description:
              "No ticket categories configured. Use `/ticket category add` to create one.",
          })
        );
      }

      const lines = categories.map(
        (c, i) =>
          `**${i + 1}.** ${c.emoji ? `${c.emoji} ` : ""}${c.name}${c.description ? ` - ${c.description}` : ""}`
      );

      return interaction.reply(
        createMessage({
          title: "Ticket Categories",
          description: lines.join("\n"),
          color: "Primary",
        })
      );
    } catch (error) {
      console.error(error);
      return interaction.reply({
        ...errorMessage({
          description: "Failed to fetch ticket categories.",
        }),
        ephemeral: true,
      });
    }
  }

  // ─── Blacklist Add ─────────────────────────────────────────────────
  if (subcommandGroup === "blacklist" && subcommand === "add") {
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason");

    try {
      const existing = await client.api.checkTicketBlacklist(guildId, user.id);

      if (existing) {
        return interaction.reply({
          ...errorMessage({
            description: `${user.toString()} is already blacklisted from tickets.`,
          }),
          ephemeral: true,
        });
      }

      await client.api.addTicketBlacklist(guildId, {
        userId: user.id,
        reason: reason ?? undefined,
        addedBy: interaction.user.id,
      });

      return interaction.reply(
        successMessage({
          description: `${user.toString()} has been blacklisted from creating tickets.${reason ? `\n**Reason:** ${reason}` : ""}`,
        })
      );
    } catch (error) {
      console.error(error);
      return interaction.reply({
        ...errorMessage({ description: "Failed to blacklist user." }),
        ephemeral: true,
      });
    }
  }

  // ─── Blacklist Remove ──────────────────────────────────────────────
  if (subcommandGroup === "blacklist" && subcommand === "remove") {
    const user = interaction.options.getUser("user", true);

    try {
      const blacklistEntry = await client.api.checkTicketBlacklist(
        guildId,
        user.id
      );

      if (!blacklistEntry) {
        return interaction.reply({
          ...errorMessage({
            description: `${user.toString()} is not blacklisted from tickets.`,
          }),
          ephemeral: true,
        });
      }

      await client.api.removeTicketBlacklist(guildId, blacklistEntry.id);

      return interaction.reply(
        successMessage({
          description: `${user.toString()} has been removed from the ticket blacklist.`,
        })
      );
    } catch (error) {
      console.error(error);
      return interaction.reply({
        ...errorMessage({
          description: "Failed to remove user from blacklist.",
        }),
        ephemeral: true,
      });
    }
  }

  // ─── Blacklist List ────────────────────────────────────────────────
  if (subcommandGroup === "blacklist" && subcommand === "list") {
    try {
      // The checkTicketBlacklist method internally fetches the full list
      // from GET /api/v1/guilds/{guildId}/ticket-blacklist.
      // We access the private get() method to retrieve the complete list.
      const blacklist = await (client.api as any).get(
        `/api/v1/guilds/${guildId}/ticket-blacklist`
      ) as Array<{
        id: number;
        user_id: string;
        reason: string | null;
        added_by: string;
        created_at: string;
      }>;

      if (!blacklist || blacklist.length === 0) {
        return interaction.reply(
          warningMessage({ description: "No blacklisted users." })
        );
      }

      const lines = blacklist.map(
        (entry, i) =>
          `**${i + 1}.** <@${entry.user_id}>${entry.reason ? ` - ${entry.reason}` : ""} (by <@${entry.added_by}>)`
      );

      return interaction.reply(
        createMessage({
          title: "Ticket Blacklist",
          description: lines.join("\n"),
          color: "Primary",
        })
      );
    } catch (error) {
      console.error(error);
      return interaction.reply({
        ...errorMessage({ description: "Failed to fetch blacklist." }),
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
