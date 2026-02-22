import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  OverwriteType,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/index.js";
import type { Bot } from "../../client/Bot.js";
import {
  successMessage,
  createMessage,
  errorMessage,
  warningMessage,
  Colors,
} from "../../utils/index.js";

const data = new SlashCommandBuilder()
  .setName("config")
  .setDescription("Configure the bot for this server")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub.setName("show").setDescription("Show all current settings")
  )
  .addSubcommand((sub) =>
    sub.setName("dashboard").setDescription("Get the web dashboard URL")
  )
  .addSubcommandGroup((group) =>
    group
      .setName("logs")
      .setDescription("Configure log channels")
      .addSubcommand((sub) =>
        sub
          .setName("setup")
          .setDescription("Auto-create a log category with all log channels")
      )
      .addSubcommand((sub) =>
        sub
          .setName("delete")
          .setDescription("Remove all log channels and the log category")
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("xp")
      .setDescription("Configure the XP / leveling system")
      .addIntegerOption((opt) =>
        opt
          .setName("min")
          .setDescription("Minimum XP per message")
          .setMinValue(1)
          .setMaxValue(100)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("max")
          .setDescription("Maximum XP per message")
          .setMinValue(1)
          .setMaxValue(100)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("cooldown")
          .setDescription("Cooldown in seconds between XP gains")
          .setMinValue(0)
          .setMaxValue(300)
      )
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Channel for level-up announcements")
          .addChannelTypes(ChannelType.GuildText)
      )
      .addStringOption((opt) =>
        opt
          .setName("message")
          .setDescription("Level-up message ({user}, {level})")
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("tickets")
      .setDescription("Configure the ticket system")
      .addChannelOption((opt) =>
        opt
          .setName("category")
          .setDescription("Category for ticket channels")
          .addChannelTypes(ChannelType.GuildCategory)
      )
      .addRoleOption((opt) =>
        opt.setName("support-role").setDescription("Support staff role")
      )
      .addChannelOption((opt) =>
        opt
          .setName("transcript-channel")
          .setDescription("Channel for ticket transcripts")
          .addChannelTypes(ChannelType.GuildText)
      )
      .addChannelOption((opt) =>
        opt
          .setName("review-channel")
          .setDescription("Channel for staff reviews")
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("suggestions")
      .setDescription("Configure the suggestion system")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Channel for suggestions")
          .addChannelTypes(ChannelType.GuildText)
      )
      .addChannelOption((opt) =>
        opt
          .setName("approved-channel")
          .setDescription("Channel for approved suggestions")
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName("welcome")
      .setDescription("Configure welcome messages")
      .addSubcommand((sub) =>
        sub
          .setName("setup")
          .setDescription("Set up the welcome channel and message")
          .addChannelOption((opt) =>
            opt
              .setName("channel")
              .setDescription("Welcome channel")
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(true)
          )
          .addStringOption((opt) =>
            opt
              .setName("message")
              .setDescription(
                "Welcome message ({user}, {server}, {membercount})"
              )
          )
      )
      .addSubcommand((sub) =>
        sub.setName("disable").setDescription("Disable welcome messages")
      )
      .addSubcommand((sub) =>
        sub
          .setName("test")
          .setDescription("Send a test welcome message in the current channel")
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("leave")
      .setDescription("Configure leave messages")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Channel for leave messages")
          .addChannelTypes(ChannelType.GuildText)
      )
      .addStringOption((opt) =>
        opt
          .setName("message")
          .setDescription("Leave message ({user}, {server}, {membercount})")
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName("autorole")
      .setDescription("Configure auto-roles assigned on member join")
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Add an auto-role")
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
          .setDescription("Remove an auto-role")
          .addRoleOption((opt) =>
            opt
              .setName("role")
              .setDescription("The role to stop assigning")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub.setName("list").setDescription("List all configured auto-roles")
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("music")
      .setDescription("Configure music settings")
      .addBooleanOption((opt) =>
        opt
          .setName("always-on")
          .setDescription("Keep the bot permanently in a voice channel")
      )
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Voice channel for always-on mode")
          .addChannelTypes(ChannelType.GuildVoice)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("automod")
      .setDescription("Configure automod settings")
      .addBooleanOption((opt) =>
        opt.setName("spam").setDescription("Enable/disable spam detection")
      )
      .addIntegerOption((opt) =>
        opt
          .setName("spam-threshold")
          .setDescription("Number of messages before triggering spam")
          .setMinValue(2)
          .setMaxValue(20)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("spam-interval")
          .setDescription("Time window in seconds for spam detection")
          .setMinValue(1)
          .setMaxValue(30)
      )
      .addBooleanOption((opt) =>
        opt.setName("links").setDescription("Enable/disable link filtering")
      )
      .addStringOption((opt) =>
        opt
          .setName("links-whitelist")
          .setDescription("Whitelisted domains (comma-separated)")
      )
      .addBooleanOption((opt) =>
        opt.setName("caps").setDescription("Enable/disable caps filtering")
      )
      .addIntegerOption((opt) =>
        opt
          .setName("caps-threshold")
          .setDescription("Percentage of caps to trigger (50-100)")
          .setMinValue(50)
          .setMaxValue(100)
      )
      .addBooleanOption((opt) =>
        opt
          .setName("wordfilter")
          .setDescription("Enable/disable word filter")
      )
      .addStringOption((opt) =>
        opt
          .setName("wordfilter-words")
          .setDescription("Filtered words (comma-separated)")
      )
  );

async function execute(
  interaction: ChatInputCommandInteraction,
  client: Bot
): Promise<unknown> {
  const guildId = interaction.guildId!;
  const guild = interaction.guild!;

  const subcommandGroup = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();

  // ─── Dashboard ──────────────────────────────────────────────────────
  if (subcommand === "dashboard") {
    const webUrl =
      process.env["WEB_URL"] ??
      `http://localhost:${process.env["WEB_PORT"] ?? 3000}`;
    return interaction.reply(
      createMessage({
        title: "Dashboard",
        description: [
          `Access the web dashboard to configure the bot more easily.`,
          "",
          `**[Open Dashboard](${webUrl}/dashboard/${guildId})**`,
          "",
          `> You need the **Administrator** or **Manage Messages** permission to access it.`,
        ].join("\n"),
        color: "Primary",
      })
    );
  }

  // ─── Show ───────────────────────────────────────────────────────────
  if (subcommand === "show") {
    const config = await client.api.getGuildConfig(guildId);
    const webUrl =
      process.env["WEB_URL"] ??
      `http://localhost:${process.env["WEB_PORT"] ?? 3000}`;

    const sections = [
      "**Logs**",
      config.log_category_id
        ? `Configured (${config.all_logs_channel ? `<#${config.all_logs_channel}>` : "category set"})`
        : "Not configured",
      "",
      "**Tickets**",
      config.ticket_category_id
        ? `Category: <#${config.ticket_category_id}>`
        : "Not configured",
      config.ticket_support_role
        ? `Support role: <@&${config.ticket_support_role}>`
        : "",
      "",
      "**XP**",
      `Min: ${config.xp_min} | Max: ${config.xp_max} | Cooldown: ${config.xp_cooldown}s`,
      config.level_up_channel ? `Channel: <#${config.level_up_channel}>` : "",
      "",
      "**Welcome**",
      config.welcome_channel
        ? `<#${config.welcome_channel}>`
        : "Not configured",
      "",
      "**Leave**",
      config.leave_channel
        ? `<#${config.leave_channel}>`
        : "Not configured",
      "",
      "**Suggestions**",
      config.suggestion_channel
        ? `<#${config.suggestion_channel}>`
        : "Not configured",
      "",
      "**Music**",
      config.music_always_on
        ? `Always-on: ${config.music_always_on_channel ? `<#${config.music_always_on_channel}>` : "enabled"}`
        : "Always-on: disabled",
      "",
      "**Automod**",
      `Spam: ${config.automod_spam_enabled ? "on" : "off"} | Links: ${config.automod_links_enabled ? "on" : "off"} | Caps: ${config.automod_caps_enabled ? "on" : "off"} | Word filter: ${config.automod_wordfilter_enabled ? "on" : "off"}`,
      "",
      `**[Dashboard](${webUrl}/dashboard/${guildId})**`,
    ];

    return interaction.reply(
      createMessage({
        title: `Configuration for ${guild.name}`,
        description: sections.filter(Boolean).join("\n"),
        color: "Primary",
      })
    );
  }

  // ─── Logs Setup ─────────────────────────────────────────────────────
  if (subcommandGroup === "logs" && subcommand === "setup") {
    await interaction.deferReply();

    try {
      const existingConfig = await client.api.getGuildConfig(guildId);

      // Check if category exists, create if not
      let category = existingConfig.log_category_id
        ? guild.channels.cache.get(existingConfig.log_category_id)
        : null;

      if (!category) {
        category = await guild.channels.create({
          name: "Logs",
          type: ChannelType.GuildCategory,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              type: OverwriteType.Role,
              deny: ["ViewChannel"],
            },
            {
              id: client.user!.id,
              type: OverwriteType.Member,
              allow: ["ViewChannel", "SendMessages", "EmbedLinks"],
            },
          ],
        });
      }

      const logChannels = [
        { name: "all-logs", key: "all_logs_channel", desc: "All logs" },
        { name: "mod-logs", key: "mod_logs_channel", desc: "Moderation" },
        { name: "message-logs", key: "msg_logs_channel", desc: "Messages" },
        { name: "voice-logs", key: "voice_logs_channel", desc: "Voice" },
        { name: "member-logs", key: "member_logs_channel", desc: "Members" },
        { name: "server-logs", key: "server_logs_channel", desc: "Server" },
        {
          name: "dashboard-logs",
          key: "dashboard_logs_channel",
          desc: "Dashboard",
        },
      ];

      const updateData: Record<string, string | null> = {
        log_category_id: category.id,
      };
      const createdChannels: string[] = [];
      const existingChannels: string[] = [];

      for (const { name, key, desc } of logChannels) {
        const existingId = (existingConfig as any)?.[key];
        const existingChannel = existingId
          ? guild.channels.cache.get(existingId)
          : null;

        if (existingChannel) {
          updateData[key] = existingChannel.id;
          existingChannels.push(`<#${existingChannel.id}> - ${desc}`);
        } else {
          const newChannel = await guild.channels.create({
            name,
            type: ChannelType.GuildText,
            parent: category.id,
          });
          updateData[key] = newChannel.id;
          createdChannels.push(`<#${newChannel.id}> - ${desc}`);
        }
      }

      await client.api.updateGuildConfig(guildId, updateData as any);

      const description = [`**Category:** ${category.name}`, ""];

      if (createdChannels.length > 0) {
        description.push("**Created channels:**");
        description.push(...createdChannels);
      }

      if (existingChannels.length > 0) {
        if (createdChannels.length > 0) description.push("");
        description.push("**Existing channels:**");
        description.push(...existingChannels);
      }

      return interaction.editReply(
        successMessage({
          title:
            createdChannels.length > 0
              ? "Logs updated"
              : "Logs already configured",
          description: description.join("\n"),
        })
      );
    } catch (error) {
      console.error(error);
      return interaction.editReply(
        errorMessage({ description: "Failed to create log channels." })
      );
    }
  }

  // ─── Logs Delete ────────────────────────────────────────────────────
  if (subcommandGroup === "logs" && subcommand === "delete") {
    await interaction.deferReply();

    const config = await client.api.getGuildConfig(guildId);

    if (!config.log_category_id) {
      return interaction.editReply(
        errorMessage({ description: "No log category is currently configured." })
      );
    }

    try {
      const channelIds = [
        config.all_logs_channel,
        config.mod_logs_channel,
        config.msg_logs_channel,
        config.voice_logs_channel,
        config.member_logs_channel,
        config.server_logs_channel,
        config.dashboard_logs_channel,
      ].filter(Boolean) as string[];

      for (const channelId of channelIds) {
        const channel = guild.channels.cache.get(channelId);
        if (channel) await channel.delete().catch(() => {});
      }

      const categoryChannel = guild.channels.cache.get(config.log_category_id);
      if (categoryChannel) await categoryChannel.delete().catch(() => {});

      await client.api.updateGuildConfig(guildId, {
        log_category_id: null,
        all_logs_channel: null,
        mod_logs_channel: null,
        msg_logs_channel: null,
        voice_logs_channel: null,
        member_logs_channel: null,
        server_logs_channel: null,
        dashboard_logs_channel: null,
      });

      return interaction.editReply(
        successMessage({
          description:
            "The log category and all its channels have been deleted.",
        })
      );
    } catch (error) {
      console.error(error);
      return interaction.editReply(
        errorMessage({ description: "Failed to delete log channels." })
      );
    }
  }

  // ─── XP ─────────────────────────────────────────────────────────────
  if (subcommand === "xp") {
    const min = interaction.options.getInteger("min");
    const max = interaction.options.getInteger("max");
    const cooldown = interaction.options.getInteger("cooldown");
    const channel = interaction.options.getChannel("channel");
    const message = interaction.options.getString("message");

    const updateData: Record<string, unknown> = {};
    if (min !== null) updateData.xp_min = min;
    if (max !== null) updateData.xp_max = max;
    if (cooldown !== null) updateData.xp_cooldown = cooldown;
    if (channel) updateData.level_up_channel = channel.id;
    if (message) updateData.level_up_message = message;

    if (Object.keys(updateData).length === 0) {
      const config = await client.api.getGuildConfig(guildId);
      return interaction.reply(
        createMessage({
          title: "XP Configuration",
          description: [
            `**XP per message:** ${config.xp_min} - ${config.xp_max}`,
            `**Cooldown:** ${config.xp_cooldown} seconds`,
            `**Level-up channel:** ${config.level_up_channel ? `<#${config.level_up_channel}>` : "Not set"}`,
            `**Message:** ${config.level_up_message || "GG {user}, you are now level **{level}**!"}`,
          ].join("\n"),
          color: "Primary",
        })
      );
    }

    await client.api.updateGuildConfig(guildId, updateData as any);

    return interaction.reply(
      successMessage({
        title: "XP Configured",
        description: "XP settings have been updated.",
      })
    );
  }

  // ─── Tickets ────────────────────────────────────────────────────────
  if (subcommand === "tickets") {
    const category = interaction.options.getChannel("category");
    const supportRole = interaction.options.getRole("support-role");
    const transcript = interaction.options.getChannel("transcript-channel");
    const review = interaction.options.getChannel("review-channel");

    const updateData: Record<string, unknown> = {};
    if (category) updateData.ticket_category_id = category.id;
    if (supportRole) updateData.ticket_support_role = supportRole.id;
    if (transcript) updateData.ticket_transcript_channel = transcript.id;
    if (review) updateData.ticket_review_channel = review.id;

    if (Object.keys(updateData).length === 0) {
      const config = await client.api.getGuildConfig(guildId);
      return interaction.reply(
        createMessage({
          title: "Ticket Configuration",
          description: [
            `**Category:** ${config.ticket_category_id ? `<#${config.ticket_category_id}>` : "Not set"}`,
            `**Support role:** ${config.ticket_support_role ? `<@&${config.ticket_support_role}>` : "Not set"}`,
            `**Transcripts:** ${config.ticket_transcript_channel ? `<#${config.ticket_transcript_channel}>` : "Not set"}`,
            `**Staff reviews:** ${config.ticket_review_channel ? `<#${config.ticket_review_channel}>` : "Not set"}`,
          ].join("\n"),
          color: "Primary",
        })
      );
    }

    await client.api.updateGuildConfig(guildId, updateData as any);

    return interaction.reply(
      successMessage({
        title: "Tickets Configured",
        description: "Ticket settings have been updated.",
      })
    );
  }

  // ─── Suggestions ────────────────────────────────────────────────────
  if (subcommand === "suggestions") {
    const channel = interaction.options.getChannel("channel");
    const approved = interaction.options.getChannel("approved-channel");

    const updateData: Record<string, unknown> = {};
    if (channel) updateData.suggestion_channel = channel.id;
    if (approved) updateData.suggestion_approved_channel = approved.id;

    if (Object.keys(updateData).length === 0) {
      const config = await client.api.getGuildConfig(guildId);
      return interaction.reply(
        createMessage({
          title: "Suggestion Configuration",
          description: [
            `**Suggestions channel:** ${config.suggestion_channel ? `<#${config.suggestion_channel}>` : "Not set"}`,
            `**Approved channel:** ${config.suggestion_approved_channel ? `<#${config.suggestion_approved_channel}>` : "Not set"}`,
          ].join("\n"),
          color: "Primary",
        })
      );
    }

    await client.api.updateGuildConfig(guildId, updateData as any);

    return interaction.reply(
      successMessage({
        title: "Suggestions Configured",
        description: "Suggestion settings have been updated.",
      })
    );
  }

  // ─── Welcome Setup ──────────────────────────────────────────────────
  if (subcommandGroup === "welcome" && subcommand === "setup") {
    const channel = interaction.options.getChannel("channel", true);
    const message = interaction.options.getString("message");

    const updateData: Record<string, unknown> = {
      welcome_channel: channel.id,
    };
    if (message) updateData.welcome_message = message;

    await client.api.updateGuildConfig(guildId, updateData as any);

    return interaction.reply(
      successMessage({
        title: "Welcome Configured",
        description: [
          `**Channel:** <#${channel.id}>`,
          message ? `**Message:** ${message}` : null,
          "",
          "Use `/config welcome test` to preview the message.",
        ]
          .filter(Boolean)
          .join("\n"),
      })
    );
  }

  // ─── Welcome Disable ───────────────────────────────────────────────
  if (subcommandGroup === "welcome" && subcommand === "disable") {
    await client.api.updateGuildConfig(guildId, {
      welcome_channel: null,
      welcome_message: null,
    });

    return interaction.reply(
      successMessage({
        description: "Welcome messages have been disabled.",
      })
    );
  }

  // ─── Welcome Test ───────────────────────────────────────────────────
  if (subcommandGroup === "welcome" && subcommand === "test") {
    const config = await client.api.getGuildConfig(guildId);

    if (!config.welcome_channel) {
      return interaction.reply({
        ...errorMessage({
          description:
            "Welcome messages are not configured. Use `/config welcome setup` first.",
        }),
        ephemeral: true,
      });
    }

    const message =
      config.welcome_message ?? "Welcome {user} to **{server}**!";
    const formatted = message
      .replace(/{user}/g, interaction.user.toString())
      .replace(/{server}/g, guild.name)
      .replace(/{membercount}/g, guild.memberCount.toString());

    return interaction.reply(
      createMessage({
        title: "Welcome Message Preview",
        description: formatted,
        color: "Primary",
      })
    );
  }

  // ─── Leave ──────────────────────────────────────────────────────────
  if (subcommand === "leave") {
    const channel = interaction.options.getChannel("channel");
    const message = interaction.options.getString("message");

    const updateData: Record<string, unknown> = {};
    if (channel) updateData.leave_channel = channel.id;
    if (message) updateData.leave_message = message;

    if (Object.keys(updateData).length === 0) {
      const config = await client.api.getGuildConfig(guildId);
      return interaction.reply(
        createMessage({
          title: "Leave Configuration",
          description: [
            `**Channel:** ${config.leave_channel ? `<#${config.leave_channel}>` : "Not set"}`,
            `**Message:** ${config.leave_message || "Not set"}`,
          ].join("\n"),
          color: "Primary",
        })
      );
    }

    await client.api.updateGuildConfig(guildId, updateData as any);

    return interaction.reply(
      successMessage({
        title: "Leave Configured",
        description: "Leave message settings have been updated.",
      })
    );
  }

  // ─── Autorole Add ──────────────────────────────────────────────────
  if (subcommandGroup === "autorole" && subcommand === "add") {
    const role = interaction.options.getRole("role", true);

    try {
      const existing = await client.api.getAutoRoles(guildId);
      if (existing.some((ar) => ar.role_id === role.id)) {
        return interaction.reply({
          ...errorMessage({
            description: `${role.toString()} is already an auto-role.`,
          }),
          ephemeral: true,
        });
      }

      await client.api.createAutoRole(guildId, { roleId: role.id });

      return interaction.reply(
        successMessage({
          description: `${role.toString()} will now be assigned automatically to new members.`,
        })
      );
    } catch (error) {
      console.error(error);
      return interaction.reply({
        ...errorMessage({ description: "Failed to add auto-role." }),
        ephemeral: true,
      });
    }
  }

  // ─── Autorole Remove ───────────────────────────────────────────────
  if (subcommandGroup === "autorole" && subcommand === "remove") {
    const role = interaction.options.getRole("role", true);

    try {
      const existing = await client.api.getAutoRoles(guildId);
      const autoRole = existing.find((ar) => ar.role_id === role.id);

      if (!autoRole) {
        return interaction.reply({
          ...errorMessage({
            description: `${role.toString()} is not configured as an auto-role.`,
          }),
          ephemeral: true,
        });
      }

      await client.api.deleteAutoRole(guildId, autoRole.id);

      return interaction.reply(
        successMessage({
          description: `${role.toString()} has been removed from auto-roles.`,
        })
      );
    } catch (error) {
      console.error(error);
      return interaction.reply({
        ...errorMessage({ description: "Failed to remove auto-role." }),
        ephemeral: true,
      });
    }
  }

  // ─── Autorole List ─────────────────────────────────────────────────
  if (subcommandGroup === "autorole" && subcommand === "list") {
    try {
      const autoRoles = await client.api.getAutoRoles(guildId);

      if (autoRoles.length === 0) {
        return interaction.reply(
          warningMessage({ description: "No auto-roles configured." })
        );
      }

      const lines = autoRoles.map(
        (ar, i) => `**${i + 1}.** <@&${ar.role_id}>`
      );

      return interaction.reply(
        createMessage({
          title: "Auto-Roles",
          description: lines.join("\n"),
          color: "Primary",
        })
      );
    } catch (error) {
      console.error(error);
      return interaction.reply({
        ...errorMessage({ description: "Failed to fetch auto-roles." }),
        ephemeral: true,
      });
    }
  }

  // ─── Music ──────────────────────────────────────────────────────────
  if (subcommand === "music") {
    const alwaysOn = interaction.options.getBoolean("always-on");
    const channel = interaction.options.getChannel("channel");

    const updateData: Record<string, unknown> = {};
    if (alwaysOn !== null) updateData.music_always_on = alwaysOn ? 1 : 0;
    if (channel) updateData.music_always_on_channel = channel.id;

    if (Object.keys(updateData).length === 0) {
      const config = await client.api.getGuildConfig(guildId);
      return interaction.reply(
        createMessage({
          title: "Music Configuration",
          description: [
            `**Always-on:** ${config.music_always_on ? "Enabled" : "Disabled"}`,
            `**Channel:** ${config.music_always_on_channel ? `<#${config.music_always_on_channel}>` : "Not set"}`,
          ].join("\n"),
          color: "Primary",
        })
      );
    }

    await client.api.updateGuildConfig(guildId, updateData as any);

    return interaction.reply(
      successMessage({
        title: "Music Configured",
        description: "Music settings have been updated.",
      })
    );
  }

  // ─── Automod ────────────────────────────────────────────────────────
  if (subcommand === "automod") {
    const spam = interaction.options.getBoolean("spam");
    const spamThreshold = interaction.options.getInteger("spam-threshold");
    const spamInterval = interaction.options.getInteger("spam-interval");
    const links = interaction.options.getBoolean("links");
    const linksWhitelist = interaction.options.getString("links-whitelist");
    const caps = interaction.options.getBoolean("caps");
    const capsThreshold = interaction.options.getInteger("caps-threshold");
    const wordfilter = interaction.options.getBoolean("wordfilter");
    const wordfilterWords = interaction.options.getString("wordfilter-words");

    const updateData: Record<string, unknown> = {};
    if (spam !== null) updateData.automod_spam_enabled = spam ? 1 : 0;
    if (spamThreshold !== null)
      updateData.automod_spam_threshold = spamThreshold;
    if (spamInterval !== null) updateData.automod_spam_interval = spamInterval;
    if (links !== null) updateData.automod_links_enabled = links ? 1 : 0;
    if (linksWhitelist !== null)
      updateData.automod_links_whitelist = linksWhitelist;
    if (caps !== null) updateData.automod_caps_enabled = caps ? 1 : 0;
    if (capsThreshold !== null)
      updateData.automod_caps_threshold = capsThreshold;
    if (wordfilter !== null)
      updateData.automod_wordfilter_enabled = wordfilter ? 1 : 0;
    if (wordfilterWords !== null)
      updateData.automod_wordfilter_words = wordfilterWords;

    if (Object.keys(updateData).length === 0) {
      const config = await client.api.getGuildConfig(guildId);
      return interaction.reply(
        createMessage({
          title: "Automod Configuration",
          description: [
            "**Spam Detection**",
            `Enabled: ${config.automod_spam_enabled ? "Yes" : "No"}`,
            `Threshold: ${config.automod_spam_threshold} messages`,
            `Interval: ${config.automod_spam_interval}s`,
            "",
            "**Link Filtering**",
            `Enabled: ${config.automod_links_enabled ? "Yes" : "No"}`,
            `Whitelist: ${config.automod_links_whitelist || "None"}`,
            "",
            "**Caps Filtering**",
            `Enabled: ${config.automod_caps_enabled ? "Yes" : "No"}`,
            `Threshold: ${config.automod_caps_threshold}%`,
            "",
            "**Word Filter**",
            `Enabled: ${config.automod_wordfilter_enabled ? "Yes" : "No"}`,
            `Words: ${config.automod_wordfilter_words ? config.automod_wordfilter_words.split(",").length + " word(s)" : "None"}`,
          ].join("\n"),
          color: "Primary",
        })
      );
    }

    await client.api.updateGuildConfig(guildId, updateData as any);

    return interaction.reply(
      successMessage({
        title: "Automod Configured",
        description: "Automod settings have been updated.",
      })
    );
  }

  return interaction.reply({
    ...errorMessage({ description: "Unknown subcommand." }),
    ephemeral: true,
  });
}

export default { data, execute } satisfies Command;
