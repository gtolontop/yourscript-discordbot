import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { Colors } from "../../utils/index.js";

export default {
  customId: "service_details",

  async execute(interaction, client) {
    const guildId = interaction.guildId!;

    const services = await client.db.service.findMany({
      where: { guildId },
      orderBy: { position: "asc" },
    });

    if (services.length === 0) {
      return interaction.reply({
        content: "No services available.",
        ephemeral: true,
      });
    }

    const container = new ContainerBuilder().setAccentColor(Colors.Primary);

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent("# Service Details")
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

    for (const service of services) {
      const features = JSON.parse(service.features) as string[];

      const content = [
        `### ${service.emoji ?? "📦"} ${service.name}`,
        service.description,
        "",
        service.price ? `**Price:** ${service.price}` : null,
        features.length > 0 ? `\n${features.map((f) => `• ${f}`).join("\n")}` : null,
      ].filter(Boolean).join("\n");

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(content)
      );

      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      );
    }

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent("-# Open a ticket to order")
    );

    return interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  },
} satisfies ButtonComponent;
