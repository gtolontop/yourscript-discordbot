import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  GuildMember,
} from "discord.js";
import type { Command } from "../../types/index.js";
import type { Bot } from "../../client/Bot.js";
import { Colors } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Show information about a user")
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("The user to look up (defaults to yourself)")
        .setRequired(false),
    ),

  async execute(interaction, client) {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const member = interaction.guild?.members.cache.get(user.id) as
      | GuildMember
      | undefined;

    // Fetch full user data
    const fetchedUser = await client.users.fetch(user.id, { force: true });

    const container = new ContainerBuilder().setAccentColor(
      member?.displayColor || Colors.Primary,
    );

    // Header
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${user.username}`),
    );

    // Avatar
    if (fetchedUser.displayAvatarURL()) {
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL(
            fetchedUser.displayAvatarURL({ size: 256 }),
          ),
        ),
      );
    }

    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
        .setDivider(true),
    );

    // General info
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent("### General Information"),
    );

    const userInfo = [
      `**ID:** \`${user.id}\``,
      `**Tag:** ${user.tag}`,
      `**Bot:** ${user.bot ? "Yes" : "No"}`,
      `**Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:D> (<t:${Math.floor(user.createdTimestamp / 1000)}:R>)`,
    ];

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(userInfo.join("\n")),
    );

    // Member-specific info
    if (member) {
      container.addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
          .setDivider(true),
      );

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent("### Server Information"),
      );

      const joinedAt = member.joinedAt
        ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:D> (<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>)`
        : "Unknown";

      const memberInfo = [
        `**Nickname:** ${member.nickname ?? "None"}`,
        `**Joined:** ${joinedAt}`,
        `**Booster:** ${member.premiumSince ? `Since <t:${Math.floor(member.premiumSince.getTime() / 1000)}:D>` : "No"}`,
      ];

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(memberInfo.join("\n")),
      );

      // Roles
      const roles = member.roles.cache
        .filter((r) => r.id !== interaction.guildId)
        .sort((a, b) => b.position - a.position)
        .map((r) => `<@&${r.id}>`)
        .slice(0, 15);

      if (roles.length > 0) {
        container.addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
        );
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### Roles (${member.roles.cache.size - 1})`,
          ),
        );
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            roles.join(" ") +
              (member.roles.cache.size - 1 > 15
                ? ` +${member.roles.cache.size - 1 - 15}`
                : ""),
          ),
        );
      }

      // Key permissions
      const keyPermissions: string[] = [];
      if (member.permissions.has("Administrator")) {
        keyPermissions.push("Administrator");
      } else {
        if (member.permissions.has("ManageGuild"))
          keyPermissions.push("Manage Server");
        if (member.permissions.has("ManageChannels"))
          keyPermissions.push("Manage Channels");
        if (member.permissions.has("ManageRoles"))
          keyPermissions.push("Manage Roles");
        if (member.permissions.has("ManageMessages"))
          keyPermissions.push("Manage Messages");
        if (member.permissions.has("BanMembers"))
          keyPermissions.push("Ban Members");
        if (member.permissions.has("KickMembers"))
          keyPermissions.push("Kick Members");
        if (member.permissions.has("ModerateMembers"))
          keyPermissions.push("Moderate Members");
      }

      if (keyPermissions.length > 0) {
        container.addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
        );
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent("### Key Permissions"),
        );
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(keyPermissions.join(" | ")),
        );
      }
    }

    // XP / Level from backend
    try {
      const userData = await client.api.getUser(user.id);
      if (userData) {
        container.addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true),
        );
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent("### Leveling"),
        );
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**Level:** ${userData.level}\n**XP:** ${userData.xp.toLocaleString()}`,
          ),
        );
      }
    } catch {
      // Silently ignore if backend is unavailable
    }

    // Footer
    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
        .setDivider(true),
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# Requested by ${interaction.user.tag}`,
      ),
    );

    return interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
} satisfies Command;
