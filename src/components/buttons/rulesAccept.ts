import type { ButtonComponent } from "../../types/index.js";
import { successMessage, errorMessage } from "../../utils/index.js";

export default {
  customId: "rules_accept",

  async execute(interaction, client) {
    // Check if there's a configured "verified" role
    const guildConfig = await client.db.guild.findUnique({
      where: { id: interaction.guildId! },
    });

    // Try to find a role named "Vérifié" or "Verified" or use a configured one
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({
        ...errorMessage({ description: "Server error." }),
        ephemeral: true,
      });
    }

    // Look for common verified role names
    const verifiedRole = guild.roles.cache.find(
      (r) =>
        r.name.toLowerCase() === "vérifié" ||
        r.name.toLowerCase() === "verified" ||
        r.name.toLowerCase() === "membre" ||
        r.name.toLowerCase() === "member"
    );

    if (verifiedRole) {
      const member = guild.members.cache.get(interaction.user.id);
      if (member) {
        if (member.roles.cache.has(verifiedRole.id)) {
          return interaction.reply({
            ...successMessage({
              description: "You have already accepted the rules!",
            }),
            ephemeral: true,
          });
        }

        try {
          await member.roles.add(verifiedRole);
          return interaction.reply({
            ...successMessage({
              title: "Welcome!",
              description: `You have accepted the rules and received the role ${verifiedRole.name}!`,
            }),
            ephemeral: true,
          });
        } catch {
          return interaction.reply({
            ...errorMessage({ description: "Unable to give you the role. Contact an administrator." }),
            ephemeral: true,
          });
        }
      }
    }

    // No role found, just confirm
    return interaction.reply({
      ...successMessage({
        title: "Rules Accepted",
        description: "Thank you for reading and accepting the rules!",
      }),
      ephemeral: true,
    });
  },
} satisfies ButtonComponent;
