import { Events, type Interaction } from "discord.js";
import type { Event } from "../types/index.js";
import { logger, errorMessage } from "../utils/index.js";
import { LogService } from "../services/LogService.js";

export default {
  name: Events.InteractionCreate,
  async execute(client, interaction: Interaction) {
    const user = `${interaction.user.tag} (${interaction.user.id})`;
    const guild = interaction.guild ? `${interaction.guild.name} (${interaction.guild.id})` : "DM";
    const channel = interaction.channel && "name" in interaction.channel ? `#${interaction.channel.name}` : `#${interaction.channelId}`;
    const logService = new LogService(client);

    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        logger.warn(`Unknown command: /${interaction.commandName} | ${user} | ${guild}`);
        return;
      }

      // Build full command string with options
      const options = interaction.options.data.map((opt) => {
        if (opt.type === 1) {
          const subOpts = opt.options?.map((o) => `${o.name}:${o.value}`).join(" ") ?? "";
          return `${opt.name} ${subOpts}`.trim();
        }
        return `${opt.name}:${opt.value}`;
      }).join(" ");

      const fullCmd = `/${interaction.commandName}${options ? " " + options : ""}`;
      logger.cmd(`${fullCmd} | ${user} | ${guild} | ${channel}`);

      const start = Date.now();

      try {
        await command.execute(interaction, client);
        const duration = Date.now() - start;
        logger.cmd(`/${interaction.commandName} OK (${duration}ms) | ${user}`);
        if (interaction.guild) logService.logCommand(interaction.guild, interaction.user, fullCmd, "OK", duration);
      } catch (error) {
        const duration = Date.now() - start;
        logger.error(`/${interaction.commandName} FAILED (${duration}ms) | ${user} | ${guild}`, error);
        if (interaction.guild) logService.logCommand(interaction.guild, interaction.user, fullCmd, "FAILED", duration);

        const reply = errorMessage({
          description: "An error occurred while executing this command.",
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
        logger.error(`Autocomplete error: /${interaction.commandName} | ${user} | ${guild}`, error);
      }
    }

    // Handle buttons
    if (interaction.isButton()) {
      logger.cmd(`[BTN] ${interaction.customId} | ${user} | ${guild} | ${channel}`);

      let button = client.buttons.get(interaction.customId);
      if (!button) {
        const prefix = interaction.customId.split("_").slice(0, 2).join("_");
        button = client.buttons.get(prefix);
      }
      if (!button) {
        for (const [key, btn] of client.buttons) {
          if (btn.customId instanceof RegExp && btn.customId.test(interaction.customId)) {
            button = btn;
            break;
          }
        }
      }

      if (!button) {
        logger.warn(`[BTN] No handler found: ${interaction.customId} | ${user} | ${guild}`);
        return;
      }

      const start = Date.now();

      try {
        await button.execute(interaction, client);
        const duration = Date.now() - start;
        logger.cmd(`[BTN] ${interaction.customId} OK (${duration}ms) | ${user}`);
        if (interaction.guild) logService.logButton(interaction.guild, interaction.user, interaction.customId, "OK", duration);
      } catch (error) {
        const duration = Date.now() - start;
        logger.error(`[BTN] ${interaction.customId} FAILED (${duration}ms) | ${user} | ${guild}`, error);
        if (interaction.guild) logService.logButton(interaction.guild, interaction.user, interaction.customId, "FAILED", duration);
      }
    }

    // Handle modals
    if (interaction.isModalSubmit()) {
      logger.cmd(`[MODAL] ${interaction.customId} | ${user} | ${guild} | ${channel}`);

      let modal = client.modals.get(interaction.customId);
      if (!modal) {
        const prefix = interaction.customId.split("_").slice(0, 2).join("_");
        modal = client.modals.get(prefix);
      }
      if (!modal) {
        for (const [key, m] of client.modals) {
          if (m.customId instanceof RegExp && m.customId.test(interaction.customId)) {
            modal = m;
            break;
          }
        }
      }

      if (!modal) {
        logger.warn(`[MODAL] No handler found: ${interaction.customId} | ${user} | ${guild}`);
        return;
      }

      const start = Date.now();

      try {
        await modal.execute(interaction, client);
        const duration = Date.now() - start;
        logger.cmd(`[MODAL] ${interaction.customId} OK (${duration}ms) | ${user}`);
        if (interaction.guild) logService.logModal(interaction.guild, interaction.user, interaction.customId, "OK", duration);
      } catch (error) {
        const duration = Date.now() - start;
        logger.error(`[MODAL] ${interaction.customId} FAILED (${duration}ms) | ${user} | ${guild}`, error);
        if (interaction.guild) logService.logModal(interaction.guild, interaction.user, interaction.customId, "FAILED", duration);
      }
    }

    // Handle select menus
    if (interaction.isAnySelectMenu()) {
      const values = interaction.values.join(", ");
      logger.cmd(`[MENU] ${interaction.customId} (${values}) | ${user} | ${guild} | ${channel}`);

      let selectMenu = client.selectMenus.get(interaction.customId);
      if (!selectMenu) {
        for (const [key, sm] of client.selectMenus) {
          if (sm.customId instanceof RegExp && sm.customId.test(interaction.customId)) {
            selectMenu = sm;
            break;
          }
        }
      }

      if (!selectMenu) {
        logger.warn(`[MENU] No handler found: ${interaction.customId} | ${user} | ${guild}`);
        return;
      }

      const start = Date.now();

      try {
        await selectMenu.execute(interaction, client);
        const duration = Date.now() - start;
        logger.cmd(`[MENU] ${interaction.customId} OK (${duration}ms) | ${user}`);
        if (interaction.guild) logService.logSelectMenu(interaction.guild, interaction.user, interaction.customId, interaction.values, "OK", duration);
      } catch (error) {
        const duration = Date.now() - start;
        logger.error(`[MENU] ${interaction.customId} FAILED (${duration}ms) | ${user} | ${guild}`, error);
        if (interaction.guild) logService.logSelectMenu(interaction.guild, interaction.user, interaction.customId, interaction.values, "FAILED", duration);
      }
    }
  },
} satisfies Event<"interactionCreate">;
