import type { ButtonComponent } from "../../types/index.js";
import { errorMessage, successMessage } from "../../utils/index.js";

export default {
  customId: /^rr_\d+$/,

  async execute(interaction, client) {
    // Extract role ID from customId (rr_123456789)
    const roleId = interaction.customId.replace("rr_", "");

    const member = interaction.guild?.members.cache.get(interaction.user.id);
    if (!member) {
      return interaction.reply({
        ...errorMessage({ description: "Impossible de trouver ton profil membre." }),
        ephemeral: true,
      });
    }

    const role = interaction.guild?.roles.cache.get(roleId);
    if (!role) {
      return interaction.reply({
        ...errorMessage({ description: "Ce rôle n'existe plus." }),
        ephemeral: true,
      });
    }

    // Check if bot can manage this role
    const botMember = interaction.guild?.members.me;
    if (!botMember || botMember.roles.highest.position <= role.position) {
      return interaction.reply({
        ...errorMessage({ description: "Je ne peux pas gérer ce rôle (position trop haute)." }),
        ephemeral: true,
      });
    }

    try {
      if (member.roles.cache.has(roleId)) {
        // Remove role
        await member.roles.remove(roleId);
        return interaction.reply({
          content: `❌ Rôle ${role.toString()} retiré.`,
          ephemeral: true,
        });
      } else {
        // Add role
        await member.roles.add(roleId);
        return interaction.reply({
          content: `✅ Rôle ${role.toString()} ajouté !`,
          ephemeral: true,
        });
      }
    } catch (error) {
      return interaction.reply({
        ...errorMessage({ description: "Impossible de modifier tes rôles." }),
        ephemeral: true,
      });
    }
  },
} satisfies ButtonComponent;
