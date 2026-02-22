import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from "discord.js";
import type { SelectMenuComponent } from "../../types/index.js";
import { Colors } from "../../utils/index.js";

const categoryNames: Record<string, string> = {
  fivem: "FiveM",
  discord: "Discord",
  web: "Web & Mobile",
  minecraft: "Minecraft",
  design: "Design",
  mensuel: "Subscriptions",
};

const categoryEmojis: Record<string, string> = {
  fivem: "🎮",
  discord: "🤖",
  web: "🌐",
  minecraft: "⛏️",
  design: "✨",
  mensuel: "📅",
};

export default {
  customId: "service_category_select",

  async execute(interaction, client) {
    const guildId = interaction.guildId!;
    const category = interaction.values[0]!;

    const services = await client.db.service.findMany({
      where: { guildId, category },
      orderBy: { position: "asc" },
    });

    if (services.length === 0) {
      return interaction.reply({
        content: "No services available in this category.",
        ephemeral: true,
      });
    }

    const container = new ContainerBuilder().setAccentColor(Colors.Primary);

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${categoryEmojis[category] ?? "📦"} ${categoryNames[category] ?? "Other"}`
      )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

    const serviceLines = services.map(
      (s) => `${s.emoji ?? "•"} **${s.name}** — ${s.price ?? "On quote"}\n-# ${s.description}`
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(serviceLines.join("\n\n"))
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent("-# Open a ticket to order")
    );

    return interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  },
} satisfies SelectMenuComponent;
