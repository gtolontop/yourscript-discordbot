import {
  type Interaction,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type AutocompleteInteraction,
  Collection,
} from "discord.js";
import type { Event } from "../types/index.js";
import { Bot } from "../client/Bot.js";
import { logger } from "../utils/logger.js";

const COOLDOWN_DEFAULT_MS = 3000;

async function handleCommand(
  interaction: ChatInputCommandInteraction,
  client: Bot,
): Promise<void> {
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  // Cooldown check
  if (!client.cooldowns.has(interaction.commandName)) {
    client.cooldowns.set(interaction.commandName, new Collection());
  }

  const now = Date.now();
  const timestamps = client.cooldowns.get(interaction.commandName)!;
  const cooldownAmount = COOLDOWN_DEFAULT_MS;

  if (timestamps.has(interaction.user.id)) {
    const expirationTime = timestamps.get(interaction.user.id)! + cooldownAmount;

    if (now < expirationTime) {
      const remaining = ((expirationTime - now) / 1000).toFixed(1);
      await interaction.reply({
        content: `Please wait ${remaining}s before using this command again.`,
        ephemeral: true,
      });
      return;
    }
  }

  timestamps.set(interaction.user.id, now);
  setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

  try {
    await command.execute(interaction, client);
  } catch (error) {
    logger.error(`Error executing command ${interaction.commandName}:`, error);

    const reply = {
      content: "An error occurred while executing this command.",
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
}

async function handleButton(
  interaction: ButtonInteraction,
  client: Bot,
): Promise<void> {
  // Try exact match first
  let button = client.buttons.get(interaction.customId);

  // If no exact match, try regex matching
  if (!button) {
    for (const [key, btn] of client.buttons) {
      if (btn.customId instanceof RegExp && btn.customId.test(interaction.customId)) {
        button = btn;
        break;
      }
      // Also check if the stored key is a regex source
      try {
        const regex = new RegExp(key);
        if (regex.test(interaction.customId)) {
          button = btn;
          break;
        }
      } catch {
        // Not a valid regex, skip
      }
    }
  }

  if (!button) return;

  try {
    await button.execute(interaction, client);
  } catch (error) {
    logger.error(`Error handling button ${interaction.customId}:`, error);

    const reply = {
      content: "An error occurred while processing this button.",
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
}

async function handleModal(
  interaction: ModalSubmitInteraction,
  client: Bot,
): Promise<void> {
  // Try exact match first
  let modal = client.modals.get(interaction.customId);

  // If no exact match, try regex matching
  if (!modal) {
    for (const [key, m] of client.modals) {
      if (m.customId instanceof RegExp && m.customId.test(interaction.customId)) {
        modal = m;
        break;
      }
      try {
        const regex = new RegExp(key);
        if (regex.test(interaction.customId)) {
          modal = m;
          break;
        }
      } catch {
        // Not a valid regex, skip
      }
    }
  }

  if (!modal) return;

  try {
    await modal.execute(interaction, client);
  } catch (error) {
    logger.error(`Error handling modal ${interaction.customId}:`, error);

    const reply = {
      content: "An error occurred while processing this form.",
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
}

async function handleSelectMenu(
  interaction: StringSelectMenuInteraction,
  client: Bot,
): Promise<void> {
  // Try exact match first
  let selectMenu = client.selectMenus.get(interaction.customId);

  // If no exact match, try regex matching
  if (!selectMenu) {
    for (const [key, sm] of client.selectMenus) {
      if (sm.customId instanceof RegExp && sm.customId.test(interaction.customId)) {
        selectMenu = sm;
        break;
      }
      try {
        const regex = new RegExp(key);
        if (regex.test(interaction.customId)) {
          selectMenu = sm;
          break;
        }
      } catch {
        // Not a valid regex, skip
      }
    }
  }

  if (!selectMenu) return;

  try {
    await selectMenu.execute(interaction, client);
  } catch (error) {
    logger.error(`Error handling select menu ${interaction.customId}:`, error);

    const reply = {
      content: "An error occurred while processing this selection.",
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
}

async function handleAutocomplete(
  interaction: AutocompleteInteraction,
  client: Bot,
): Promise<void> {
  const command = client.commands.get(interaction.commandName);
  if (!command?.autocomplete) return;

  try {
    await command.autocomplete(interaction, client);
  } catch (error) {
    logger.error(
      `Error handling autocomplete for ${interaction.commandName}:`,
      error,
    );
  }
}

export default {
  name: "interactionCreate",

  async execute(client: Bot, interaction: Interaction) {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction, client);
    } else if (interaction.isButton()) {
      await handleButton(interaction, client);
    } else if (interaction.isModalSubmit()) {
      await handleModal(interaction, client);
    } else if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction, client);
    } else if (interaction.isAutocomplete()) {
      await handleAutocomplete(interaction, client);
    }
  },
} satisfies Event<"interactionCreate">;
