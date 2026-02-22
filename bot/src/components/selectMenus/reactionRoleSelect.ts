import type { SelectMenuComponent } from "../../types/index.js";
import { Bot } from "../../client/Bot.js";
import { logger } from "../../utils/logger.js";

export default {
  customId: "reaction_role_select",

  async execute(interaction, client: Bot) {
    const guildId = interaction.guildId!;
    const member = interaction.guild?.members.cache.get(interaction.user.id);

    if (!member) {
      await interaction.reply({
        content: "Could not find your member data.",
        ephemeral: true,
      });
      return;
    }

    try {
      // Get the reaction roles for this guild
      const reactionRoles = await client.api.getReactionRoles(guildId);

      // Filter to only roles associated with this message
      const messageRoles = reactionRoles.filter(
        (rr) => rr.message_id === interaction.message.id,
      );

      if (messageRoles.length === 0) {
        await interaction.reply({
          content: "No roles configured for this selection.",
          ephemeral: true,
        });
        return;
      }

      const selectedRoleIds = interaction.values;
      const availableRoleIds = messageRoles.map((rr) => rr.role_id);

      const addedRoles: string[] = [];
      const removedRoles: string[] = [];

      for (const roleId of availableRoleIds) {
        const hasRole = member.roles.cache.has(roleId);
        const isSelected = selectedRoleIds.includes(roleId);

        if (isSelected && !hasRole) {
          // Add the role
          try {
            await member.roles.add(roleId);
            addedRoles.push(roleId);
          } catch {
            logger.warn(`Failed to add role ${roleId} to ${member.user.tag}`);
          }
        } else if (!isSelected && hasRole) {
          // Remove the role
          try {
            await member.roles.remove(roleId);
            removedRoles.push(roleId);
          } catch {
            logger.warn(
              `Failed to remove role ${roleId} from ${member.user.tag}`,
            );
          }
        }
      }

      // Build response
      const parts: string[] = [];

      if (addedRoles.length > 0) {
        parts.push(
          `**Added:** ${addedRoles.map((id) => `<@&${id}>`).join(", ")}`,
        );
      }

      if (removedRoles.length > 0) {
        parts.push(
          `**Removed:** ${removedRoles.map((id) => `<@&${id}>`).join(", ")}`,
        );
      }

      if (parts.length === 0) {
        parts.push("No role changes were made.");
      }

      await interaction.reply({
        content: parts.join("\n"),
        ephemeral: true,
      });
    } catch (error) {
      logger.error("Failed to process reaction role selection:", error);
      await interaction.reply({
        content: "An error occurred while updating your roles.",
        ephemeral: true,
      });
    }
  },
} satisfies SelectMenuComponent;
