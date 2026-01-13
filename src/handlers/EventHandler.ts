import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Bot } from "../client/Bot.js";
import type { Event } from "../types/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadEvents(client: Bot): Promise<void> {
  const eventsPath = join(__dirname, "..", "events");
  const eventFiles = readdirSync(eventsPath).filter(
    (file) => file.endsWith(".ts") || file.endsWith(".js")
  );

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
      console.log(`  ✓ Loaded event: ${event.name}${event.once ? " (once)" : ""}`);
    } else {
      console.warn(`  ✗ Invalid event file: ${file}`);
    }
  }

  console.log(`✓ Loaded ${eventFiles.length} events`);
}
