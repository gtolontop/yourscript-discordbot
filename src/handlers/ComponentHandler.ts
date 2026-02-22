import { readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Bot } from "../client/Bot.js";
import type { ButtonComponent, ModalComponent, SelectMenuComponent } from "../types/index.js";
import { logger } from "../utils/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadComponents(client: Bot): Promise<void> {
  const componentsPath = join(__dirname, "..", "components");

  await loadButtons(client, componentsPath);
  await loadModals(client, componentsPath);
  await loadSelectMenus(client, componentsPath);
}

async function loadButtons(client: Bot, basePath: string): Promise<void> {
  const buttonsPath = join(basePath, "buttons");
  if (!existsSync(buttonsPath)) return;

  const files = readdirSync(buttonsPath).filter(
    (file) => file.endsWith(".ts") || file.endsWith(".js")
  );

  for (const file of files) {
    const filePath = join(buttonsPath, file);
    const module = await import(`file://${filePath}`);
    const button: ButtonComponent = module.default;

    if (button?.customId) {
      const id = button.customId instanceof RegExp
        ? button.customId.source
        : button.customId;
      client.buttons.set(id, button);
      logger.info(`  Loaded button: ${id}`);
    }
  }

  logger.info(`Loaded ${client.buttons.size} buttons`);
}

async function loadModals(client: Bot, basePath: string): Promise<void> {
  const modalsPath = join(basePath, "modals");
  if (!existsSync(modalsPath)) return;

  const files = readdirSync(modalsPath).filter(
    (file) => file.endsWith(".ts") || file.endsWith(".js")
  );

  for (const file of files) {
    const filePath = join(modalsPath, file);
    const module = await import(`file://${filePath}`);
    const modal: ModalComponent = module.default;

    if (modal?.customId) {
      const id = modal.customId instanceof RegExp
        ? modal.customId.source
        : modal.customId;
      client.modals.set(id, modal);
      logger.info(`  Loaded modal: ${id}`);
    }
  }

  logger.info(`Loaded ${client.modals.size} modals`);
}

async function loadSelectMenus(client: Bot, basePath: string): Promise<void> {
  const selectMenusPath = join(basePath, "selectMenus");
  if (!existsSync(selectMenusPath)) return;

  const files = readdirSync(selectMenusPath).filter(
    (file) => file.endsWith(".ts") || file.endsWith(".js")
  );

  for (const file of files) {
    const filePath = join(selectMenusPath, file);
    const module = await import(`file://${filePath}`);
    const selectMenu: SelectMenuComponent = module.default;

    if (selectMenu?.customId) {
      const id = selectMenu.customId instanceof RegExp
        ? selectMenu.customId.source
        : selectMenu.customId;
      client.selectMenus.set(id, selectMenu);
      logger.info(`  Loaded select menu: ${id}`);
    }
  }

  logger.info(`Loaded ${client.selectMenus.size} select menus`);
}
