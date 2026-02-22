import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ChannelType,
  GuildVerificationLevel,
  GuildExplicitContentFilter,
} from "discord.js";
import type { Command } from "../../types/index.js";
import { errorMessage, Colors } from "../../utils/index.js";

const verificationLevels: Record<GuildVerificationLevel, string> = {
  [GuildVerificationLevel.None]: "None",
  [GuildVerificationLevel.Low]: "Low",
  [GuildVerificationLevel.Medium]: "Medium",
  [GuildVerificationLevel.High]: "High",
  [GuildVerificationLevel.VeryHigh]: "Very High",
};

const contentFilters: Record<GuildExplicitContentFilter, string> = {
  [GuildExplicitContentFilter.Disabled]: "Disabled",
  [GuildExplicitContentFilter.MembersWithoutRoles]: "Members without roles",
  [GuildExplicitContentFilter.AllMembers]: "All members",
};

export default {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Display server information"),

  async execute(interaction, client) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        ...errorMessage({ description: "This command can only be used in a server." }),
        ephemeral: true,
      });
    }

    // Fetch full guild data
    await guild.fetch();

    const owner = await guild.fetchOwner().catch(() => null);

    const container = new ContainerBuilder().setAccentColor(Colors.Primary);

    // Header with thumbnail
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# 🏠 ${guild.name}`)
    );

    if (guild.iconURL()) {
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL(guild.iconURL({ size: 256 })!)
        )
      );
    }

    if (guild.description) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(guild.description)
      );
    }

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

    // General info
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent("### 📋 General Information")
    );

    const generalInfo = [
      `**ID:** \`${guild.id}\``,
      `**Owner:** ${owner ? `${owner.user.tag}` : "Unknown"}`,
      `**Created on:** <t:${Math.floor(guild.createdTimestamp / 1000)}:D> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`,
      `**Verification:** ${verificationLevels[guild.verificationLevel]}`,
      `**Content filter:** ${contentFilters[guild.explicitContentFilter]}`,
    ];

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(generalInfo.join("\n"))
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

    // Stats
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent("### 📊 Statistics")
    );

    const textChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).size;
    const categories = guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).size;
    const forumChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildForum).size;
    const stageChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildStageVoice).size;

    const statsInfo = [
      `**👥 Members:** ${guild.memberCount.toLocaleString()}`,
      `**🎭 Roles:** ${guild.roles.cache.size}`,
      `**😀 Emojis:** ${guild.emojis.cache.size}`,
      `**🎨 Stickers:** ${guild.stickers.cache.size}`,
      "",
      `**💬 Text channels:** ${textChannels}`,
      `**🔊 Voice channels:** ${voiceChannels}`,
      `**📁 Categories:** ${categories}`,
      forumChannels > 0 ? `**📰 Forums:** ${forumChannels}` : null,
      stageChannels > 0 ? `**🎤 Stages:** ${stageChannels}` : null,
    ].filter(Boolean);

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(statsInfo.join("\n"))
    );

    // Boost info
    if (guild.premiumSubscriptionCount && guild.premiumSubscriptionCount > 0) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent("### 💎 Boost")
      );

      const boostInfo = [
        `**Level:** ${guild.premiumTier}`,
        `**Boosts:** ${guild.premiumSubscriptionCount}`,
      ];

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(boostInfo.join("\n"))
      );
    }

    // Features
    const features = guild.features;
    if (features.length > 0) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent("### ✨ Features")
      );

      const featureNames: Record<string, string> = {
        ANIMATED_BANNER: "Animated Banner",
        ANIMATED_ICON: "Animated Icon",
        AUTO_MODERATION: "Auto Moderation",
        BANNER: "Banner",
        COMMUNITY: "Community",
        DISCOVERABLE: "Discoverable",
        INVITE_SPLASH: "Invite Splash",
        MEMBER_VERIFICATION_GATE_ENABLED: "Member Verification",
        MONETIZATION_ENABLED: "Monetization",
        MORE_STICKERS: "More Stickers",
        NEWS: "Announcement Channels",
        PARTNERED: "Partner",
        PREVIEW_ENABLED: "Preview",
        ROLE_ICONS: "Role Icons",
        VANITY_URL: "Vanity URL",
        VERIFIED: "Verified",
        WELCOME_SCREEN_ENABLED: "Welcome Screen",
      };

      const displayFeatures = features
        .filter((f) => featureNames[f])
        .map((f) => featureNames[f])
        .slice(0, 10);

      if (displayFeatures.length > 0) {
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(displayFeatures.join(" • "))
        );
      }
    }

    // Footer
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Requested by ${interaction.user.tag}`)
    );

    return interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
} satisfies Command;
