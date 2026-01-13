import { Events, type Interaction } from "discord.js";
import type { Event } from "../types/index.js";
import { logger, errorMessage } from "../utils/index.js";

export default {
  name: Events.InteractionCreate,
  async execute(client, interaction: Interaction) {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        logger.warn(`Command not found: ${interaction.commandName}`);
        return;
      }

      try {
        await command.execute(interaction, client);
      } catch (error) {
        logger.error(`Error executing command ${interaction.commandName}:`, error);

        const reply = errorMessage({
          description: "Une erreur s'est produite lors de l'exécution de cette commande.",
        });

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ ...reply, ephemeral: true });
        } else {
          await interaction.reply({ ...reply, ephemeral: true });
        }
      }
    }

    // Handle autocomplete
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);

      if (!command?.autocomplete) return;

      try {
        await command.autocomplete(interaction, client);
      } catch (error) {
        logger.error(`Error in autocomplete for ${interaction.commandName}:`, error);
      }
    }

    // Handle buttons
    if (interaction.isButton()) {
      // Try exact match first
      let button = client.buttons.get(interaction.customId);

      // Try prefix match (for dynamic IDs like review_accept_123)
      if (!button) {
        const prefix = interaction.customId.split("_").slice(0, 2).join("_");
        button = client.buttons.get(prefix);
      }

      // Try regex match
      if (!button) {
        for (const [key, btn] of client.buttons) {
          if (btn.customId instanceof RegExp && btn.customId.test(interaction.customId)) {
            button = btn;
            break;
          }
        }
      }

      if (!button) return;

      try {
        await button.execute(interaction, client);
      } catch (error) {
        logger.error(`Error executing button ${interaction.customId}:`, error);
      }
    }

    // Handle modals
    if (interaction.isModalSubmit()) {
      // Try exact match first
      let modal = client.modals.get(interaction.customId);

      // Try prefix match (for dynamic IDs like review_publish_123)
      if (!modal) {
        const prefix = interaction.customId.split("_").slice(0, 2).join("_");
        modal = client.modals.get(prefix);
      }

      // Try regex match
      if (!modal) {
        for (const [key, m] of client.modals) {
          if (m.customId instanceof RegExp && m.customId.test(interaction.customId)) {
            modal = m;
            break;
          }
        }
      }

      if (!modal) return;

      try {
        await modal.execute(interaction, client);
      } catch (error) {
        logger.error(`Error executing modal ${interaction.customId}:`, error);
      }
    }

    // Handle select menus
    if (interaction.isAnySelectMenu()) {
      // Try exact match first
      let selectMenu = client.selectMenus.get(interaction.customId);

      // Try regex match
      if (!selectMenu) {
        for (const [key, sm] of client.selectMenus) {
          if (sm.customId instanceof RegExp && sm.customId.test(interaction.customId)) {
            selectMenu = sm;
            break;
          }
        }
      }

      if (!selectMenu) return;

      try {
        await selectMenu.execute(interaction, client);
      } catch (error) {
        logger.error(`Error executing select menu ${interaction.customId}:`, error);
      }
    }
  },
} satisfies Event<"interactionCreate">;
