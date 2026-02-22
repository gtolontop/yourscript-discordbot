import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Bot } from "../client/Bot.js";
import type { Event } from "../types/index.js";
import { logger } from "../utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadEvents(client: Bot): Promise<void> {
  const eventsPath = join(__dirname, "..", "events");
  let eventFiles: string[];

  try {
    eventFiles = readdirSync(eventsPath).filter(
      (file) => file.endsWith(".ts") || file.endsWith(".js"),
    );
  } catch {
    logger.warn("No events directory found, skipping event loading");
    return;
  }

  for (const file of eventFiles) {
    const filePath = join(eventsPath, file);
    const module = await import(`file://${filePath}`);
    const event: Event = module.default;

    if (event?.name) {
      if (event.once) {
        client.once(event.name, (...args) => event.execute(client, ...args));
      } else {
        client.on(event.name, (...args) => event.execute(client, ...args));
      }
      logger.debug(
        `Loaded event: ${event.name}${event.once ? " (once)" : ""}`,
      );
    } else {
      logger.warn(`Invalid event file: ${file}`);
    }
  }

  logger.info(`Loaded ${eventFiles.length} events`);
}
