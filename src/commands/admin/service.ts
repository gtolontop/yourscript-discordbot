import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ButtonStyle,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { Command } from "../../types/index.js";
import { successMessage, errorMessage, Colors } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("service")
    .setDescription("Manage YourScript services")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a service")
        .addStringOption((opt) =>
          opt.setName("nom").setDescription("Service name").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("description").setDescription("Service description").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("emoji").setDescription("Service emoji").setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("prix").setDescription("Service price (e.g. Starting at $50)").setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("features").setDescription("Features separated by | (e.g. Design | SEO | Support)").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a service")
        .addStringOption((opt) =>
          opt.setName("nom").setDescription("Service name").setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Edit a service")
        .addStringOption((opt) =>
          opt.setName("nom").setDescription("Service name to edit").setRequired(true).setAutocomplete(true)
        )
        .addStringOption((opt) =>
          opt.setName("description").setDescription("New description").setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("emoji").setDescription("New emoji").setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("prix").setDescription("New price").setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("features").setDescription("New features separated by |").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all services")
    )
    .addSubcommand((sub) =>
      sub
        .setName("panel")
        .setDescription("Create/Update the services panel")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel for the panel")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("titre").setDescription("Panel title").setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("description").setDescription("Panel description").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("refresh").setDescription("Refresh the existing services panel")
    )
    .addSubcommand((sub) =>
      sub.setName("preset").setDescription("Load preconfigured YourScript services")
    ),

  async autocomplete(interaction, client) {
    const guildId = interaction.guildId!;
    const focused = interaction.options.getFocused().toLowerCase();

    const services = await client.db.service.findMany({
      where: { guildId },
    });

    const filtered = services
      .filter((s) => s.name.toLowerCase().includes(focused))
      .slice(0, 25);

    await interaction.respond(
      filtered.map((s) => ({ name: s.name, value: s.name }))
    );
  },

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (subcommand === "add") {
      const name = interaction.options.getString("nom", true);
      const description = interaction.options.getString("description", true);
      const emoji = interaction.options.getString("emoji");
      const price = interaction.options.getString("prix");
      const featuresStr = interaction.options.getString("features");

      const features = featuresStr
        ? featuresStr.split("|").map((f) => f.trim()).filter(Boolean)
        : [];

      const existing = await client.db.service.findUnique({
        where: { guildId_name: { guildId, name } },
      });

      if (existing) {
        return interaction.reply({
          ...errorMessage({ description: "A service with this name already exists." }),
          ephemeral: true,
        });
      }

      const count = await client.db.service.count({ where: { guildId } });

      await client.db.service.create({
        data: {
          guildId,
          name,
          description,
          emoji,
          price,
          features: JSON.stringify(features),
          position: count,
        },
      });

      return interaction.reply(
        successMessage({
          title: "Service Added",
          description: `The service **${emoji ?? "📦"} ${name}** has been added.`,
        })
      );
    }

    if (subcommand === "remove") {
      const name = interaction.options.getString("nom", true);

      const service = await client.db.service.findUnique({
        where: { guildId_name: { guildId, name } },
      });

      if (!service) {
        return interaction.reply({
          ...errorMessage({ description: "Service not found." }),
          ephemeral: true,
        });
      }

      await client.db.service.delete({ where: { id: service.id } });

      return interaction.reply(
        successMessage({
          title: "Service Removed",
          description: `The service **${name}** has been removed.`,
        })
      );
    }

    if (subcommand === "edit") {
      const name = interaction.options.getString("nom", true);
      const description = interaction.options.getString("description");
      const emoji = interaction.options.getString("emoji");
      const price = interaction.options.getString("prix");
      const featuresStr = interaction.options.getString("features");

      const service = await client.db.service.findUnique({
        where: { guildId_name: { guildId, name } },
      });

      if (!service) {
        return interaction.reply({
          ...errorMessage({ description: "Service not found." }),
          ephemeral: true,
        });
      }

      const updateData: Record<string, any> = {};
      if (description) updateData['description'] = description;
      if (emoji) updateData['emoji'] = emoji;
      if (price) updateData['price'] = price;
      if (featuresStr) {
        updateData['features'] = JSON.stringify(
          featuresStr.split("|").map((f) => f.trim()).filter(Boolean)
        );
      }

      if (Object.keys(updateData).length === 0) {
        return interaction.reply({
          ...errorMessage({ description: "No changes specified." }),
          ephemeral: true,
        });
      }

      await client.db.service.update({
        where: { id: service.id },
        data: updateData,
      });

      return interaction.reply(
        successMessage({
          title: "Service Updated",
          description: `The service **${name}** has been updated.`,
        })
      );
    }

    if (subcommand === "list") {
      const services = await client.db.service.findMany({
        where: { guildId },
        orderBy: { position: "asc" },
      });

      if (services.length === 0) {
        return interaction.reply({
          ...errorMessage({ description: "No services configured. Use `/service add` to create one." }),
          ephemeral: true,
        });
      }

      const container = new ContainerBuilder().setAccentColor(Colors.Primary);

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## 📋 Configured Services")
      );

      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      );

      for (const service of services) {
        const features = JSON.parse(service.features) as string[];
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `**${service.emoji ?? "📦"} ${service.name}**`,
              service.description,
              service.price ? `💰 ${service.price}` : null,
              features.length > 0 ? `✨ ${features.join(" • ")}` : null,
            ].filter(Boolean).join("\n")
          )
        );
        container.addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        );
      }

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# ${services.length} service(s)`)
      );

      return interaction.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (subcommand === "panel") {
      const channel = (interaction.options.getChannel("channel") ?? interaction.channel) as TextChannel;
      const customTitle = interaction.options.getString("titre");
      const customDesc = interaction.options.getString("description");

      const services = await client.db.service.findMany({
        where: { guildId },
        orderBy: { position: "asc" },
      });

      if (services.length === 0) {
        return interaction.reply({
          ...errorMessage({ description: "Add services first with `/service add`" }),
          ephemeral: true,
        });
      }

      // Professional panel with formal language
      const container = new ContainerBuilder().setAccentColor(Colors.Primary);

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# ${customTitle ?? "🚀 Our Services"}`)
      );

      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          customDesc ?? "Every project is **unique**. We create **100% custom** solutions tailored to your needs.\n\n✅ **Tailor-made** — Development adapted to your vision\n✅ **Professional quality** — Clean, optimized and maintainable code\n✅ **Fast delivery** — Deadlines met, regular communication\n✅ **Support included** — Revisions and support until satisfaction"
        )
      );

      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Select a category below to discover our offers"
        )
      );

      // Category select menu
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("service_category_select")
        .setPlaceholder("📂 Choose a category")
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel("FiveM")
            .setDescription("FiveM scripts, servers and optimization")
            .setValue("fivem")
            .setEmoji("🎮"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Discord")
            .setDescription("Discord bots, security and automation")
            .setValue("discord")
            .setEmoji("🤖"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Web & Mobile")
            .setDescription("Websites, applications and backends")
            .setValue("web")
            .setEmoji("🌐"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Minecraft")
            .setDescription("Servers, plugins, mods and launchers")
            .setValue("minecraft")
            .setEmoji("⛏️"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Design")
            .setDescription("UI/UX and mockups")
            .setValue("design")
            .setEmoji("✨"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Subscriptions")
            .setDescription("Monthly services and maintenance")
            .setValue("mensuel")
            .setEmoji("📅")
        );

      const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      // Order button
      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_create")
          .setLabel("Order a service")
          .setEmoji("🛒")
          .setStyle(ButtonStyle.Primary)
      );

      // Send the panel
      const msg = await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });

      await channel.send({
        components: [selectRow, buttonRow],
      });

      // Save panel info
      await client.db.servicePanel.upsert({
        where: { guildId },
        create: {
          guildId,
          channelId: channel.id,
          messageId: msg.id,
          title: customTitle ?? "Our Services",
          description: customDesc,
        },
        update: {
          channelId: channel.id,
          messageId: msg.id,
          title: customTitle ?? "Our Services",
          description: customDesc,
        },
      });

      return interaction.reply({
        ...successMessage({
          title: "Panel Created",
          description: `The services panel has been created in <#${channel.id}>`,
        }),
        ephemeral: true,
      });
    }

    if (subcommand === "refresh") {
      const panel = await client.db.servicePanel.findUnique({
        where: { guildId },
      });

      if (!panel || !panel.channelId || !panel.messageId) {
        return interaction.reply({
          ...errorMessage({ description: "No existing panel. Use `/service panel` to create one." }),
          ephemeral: true,
        });
      }

      const channel = client.channels.cache.get(panel.channelId) as TextChannel;
      if (!channel) {
        return interaction.reply({
          ...errorMessage({ description: "Panel channel not found." }),
          ephemeral: true,
        });
      }

      // Minimal panel - same as panel command
      const container = new ContainerBuilder().setAccentColor(Colors.Primary);

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# ${panel.title}`)
      );

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          panel.description ?? "Custom development for your projects."
        )
      );

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Select a category to see our offers"
        )
      );

      try {
        const message = await channel.messages.fetch(panel.messageId);
        await message.edit({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        });

        return interaction.reply({
          ...successMessage({
            title: "Panel Refreshed",
            description: "The services panel has been updated.",
          }),
          ephemeral: true,
        });
      } catch {
        return interaction.reply({
          ...errorMessage({ description: "Unable to find the panel message. Recreate it with `/service panel`." }),
          ephemeral: true,
        });
      }
    }

    if (subcommand === "preset") {
      const presetServices = [
        // FiveM
        { name: "FiveM Script", emoji: "🎮", description: "Custom scripts for your FiveM server.", price: "Starting at $30", features: [], category: "fivem" },
        { name: "Full FiveM Server", emoji: "🏗️", description: "Turnkey FiveM server, ready to use.", price: "Starting at $500", features: [], category: "fivem" },
        { name: "FiveM Optimization", emoji: "🚀", description: "Performance optimization for your server.", price: "Starting at $50", features: [], category: "fivem" },
        // Discord
        { name: "Custom Bot", emoji: "🤖", description: "Fully customized Discord bot tailored to your needs.", price: "Starting at $50", features: [], category: "discord" },
        { name: "Moderation Bot", emoji: "🛡️", description: "Complete moderation system for your server.", price: "Starting at $40", features: [], category: "discord" },
        { name: "Ticket Bot", emoji: "🎫", description: "Advanced ticket system with transcriptions.", price: "Starting at $30", features: [], category: "discord" },
        { name: "Economy Bot", emoji: "💰", description: "Complete economy system for your community.", price: "Starting at $40", features: [], category: "discord" },
        { name: "AI Bot", emoji: "🧠", description: "Bot with integrated artificial intelligence.", price: "Starting at $80", features: [], category: "discord" },
        { name: "Music Bot", emoji: "🎵", description: "Music bot with multi-platform support.", price: "Starting at $35", features: [], category: "discord" },
        { name: "Games Bot", emoji: "🎲", description: "Mini-games and fun systems for your server.", price: "Starting at $50", features: [], category: "discord" },
        { name: "Web Dashboard", emoji: "📊", description: "Web management panel for your Discord bot.", price: "Starting at $100", features: [], category: "discord" },
        { name: "Server Security", emoji: "🔒", description: "Advanced anti-raid and anti-spam protection.", price: "Starting at $35", features: [], category: "discord" },
        // Web & Mobile
        { name: "Showcase Website", emoji: "🌐", description: "Professional website to present your business.", price: "Starting at $100", features: [], category: "web" },
        { name: "E-commerce Website", emoji: "🛒", description: "Complete and secure online store.", price: "Starting at $250", features: [], category: "web" },
        { name: "Admin Dashboard", emoji: "📊", description: "Custom administration panel.", price: "Starting at $150", features: [], category: "web" },
        { name: "Tebex Theme", emoji: "🎨", description: "Custom theme for your Tebex store.", price: "Starting at $100", features: [], category: "web" },
        { name: "Mobile App", emoji: "📱", description: "iOS and Android mobile application.", price: "Starting at $300", features: [], category: "web" },
        { name: "Frontend", emoji: "🖥️", description: "Modern and responsive interfaces.", price: "Starting at $50", features: [], category: "web" },
        { name: "Backend", emoji: "⚙️", description: "Robust and scalable servers and APIs.", price: "Starting at $50", features: [], category: "web" },
        // Minecraft
        { name: "Minecraft Server", emoji: "⛏️", description: "Complete and configured Minecraft server.", price: "Starting at $150", features: [], category: "minecraft" },
        { name: "Custom Plugin", emoji: "🔌", description: "Custom Minecraft plugins for your server.", price: "Starting at $40", features: [], category: "minecraft" },
        { name: "Custom Mod", emoji: "🧩", description: "Custom Minecraft mods.", price: "Starting at $60", features: [], category: "minecraft" },
        { name: "Custom Launcher", emoji: "🚀", description: "Custom launcher branded for your server.", price: "Starting at $80", features: [], category: "minecraft" },
        // Design
        { name: "UI Design", emoji: "✨", description: "Mockups and user interfaces.", price: "Starting at $30", features: [], category: "design" },
        // Monthly / Subscriptions
        { name: "Monthly FiveM Dev", emoji: "📅", description: "Ongoing development for your server.", price: "Starting at $200/month", features: [], category: "mensuel" },
        { name: "Monthly Discord Dev", emoji: "🔄", description: "Maintenance and updates for your bot.", price: "Starting at $100/month", features: [], category: "mensuel" },
        { name: "Technical Support", emoji: "🛠️", description: "Priority technical assistance.", price: "Starting at $50/month", features: [], category: "mensuel" },
        { name: "Server Maintenance", emoji: "🔧", description: "Regular maintenance and updates.", price: "Starting at $80/month", features: [], category: "mensuel" },
        { name: "Managed Hosting", emoji: "☁️", description: "Hosting with full management.", price: "Starting at $30/month", features: [], category: "mensuel" },
      ];

      // Delete existing services
      await client.db.service.deleteMany({ where: { guildId } });

      // Create preset services
      for (let i = 0; i < presetServices.length; i++) {
        const s = presetServices[i]!;
        await client.db.service.create({
          data: {
            guildId,
            name: s.name,
            emoji: s.emoji,
            description: s.description,
            price: s.price,
            features: JSON.stringify(s.features),
            category: s.category,
            position: i,
          },
        });
      }

      return interaction.reply(
        successMessage({
          title: "Preconfigured Services",
          description: `**${presetServices.length} services** from YourScript have been added.\n\nUse \`/service list\` to view them or \`/service panel\` to create the panel.`,
        })
      );
    }
  },
} satisfies Command;
