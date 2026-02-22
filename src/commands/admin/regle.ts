import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import type { Command } from "../../types/index.js";
import { successMessage, errorMessage, Colors } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("regle")
    .setDescription("Manage server rules")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a rule")
        .addIntegerOption((opt) =>
          opt.setName("numero").setDescription("Rule number").setRequired(true).setMinValue(1)
        )
        .addStringOption((opt) =>
          opt.setName("titre").setDescription("Rule title").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("description").setDescription("Rule description").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a rule")
        .addIntegerOption((opt) =>
          opt.setName("numero").setDescription("Rule number").setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Edit a rule")
        .addIntegerOption((opt) =>
          opt.setName("numero").setDescription("Rule number to edit").setRequired(true).setMinValue(1)
        )
        .addStringOption((opt) =>
          opt.setName("titre").setDescription("New title").setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("description").setDescription("New description").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all rules")
    )
    .addSubcommand((sub) =>
      sub
        .setName("send")
        .setDescription("Send the rules")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel for the rules")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("titre").setDescription("Rules title").setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("footer").setDescription("Rules footer").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("refresh").setDescription("Refresh existing rules")
    )
    .addSubcommand((sub) =>
      sub.setName("preset").setDescription("Load preconfigured rules")
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (subcommand === "add") {
      const number = interaction.options.getInteger("numero", true);
      const title = interaction.options.getString("titre", true);
      const description = interaction.options.getString("description", true);

      const existing = await client.db.rule.findUnique({
        where: { guildId_number: { guildId, number } },
      });

      if (existing) {
        return interaction.reply({
          ...errorMessage({ description: `Rule #${number} already exists. Use \`/regle edit\` to modify it.` }),
          ephemeral: true,
        });
      }

      await client.db.rule.create({
        data: {
          guildId,
          number,
          title,
          description,
        },
      });

      return interaction.reply(
        successMessage({
          title: "Rule Added",
          description: `**Rule ${number}:** ${title}`,
        })
      );
    }

    if (subcommand === "remove") {
      const number = interaction.options.getInteger("numero", true);

      const rule = await client.db.rule.findUnique({
        where: { guildId_number: { guildId, number } },
      });

      if (!rule) {
        return interaction.reply({
          ...errorMessage({ description: `Rule #${number} does not exist.` }),
          ephemeral: true,
        });
      }

      await client.db.rule.delete({ where: { id: rule.id } });

      return interaction.reply(
        successMessage({
          title: "Rule Removed",
          description: `Rule #${number} has been removed.`,
        })
      );
    }

    if (subcommand === "edit") {
      const number = interaction.options.getInteger("numero", true);
      const title = interaction.options.getString("titre");
      const description = interaction.options.getString("description");

      const rule = await client.db.rule.findUnique({
        where: { guildId_number: { guildId, number } },
      });

      if (!rule) {
        return interaction.reply({
          ...errorMessage({ description: `Rule #${number} does not exist.` }),
          ephemeral: true,
        });
      }

      const updateData: Record<string, string> = {};
      if (title) updateData['title'] = title;
      if (description) updateData['description'] = description;

      if (Object.keys(updateData).length === 0) {
        return interaction.reply({
          ...errorMessage({ description: "No changes specified." }),
          ephemeral: true,
        });
      }

      await client.db.rule.update({
        where: { id: rule.id },
        data: updateData,
      });

      return interaction.reply(
        successMessage({
          title: "Rule Updated",
          description: `Rule #${number} has been updated.`,
        })
      );
    }

    if (subcommand === "list") {
      const rules = await client.db.rule.findMany({
        where: { guildId },
        orderBy: { number: "asc" },
      });

      if (rules.length === 0) {
        return interaction.reply({
          ...errorMessage({ description: "No rules configured. Use `/regle add` to create one." }),
          ephemeral: true,
        });
      }

      const container = new ContainerBuilder().setAccentColor(Colors.Primary);

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## 📜 Rules List")
      );

      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      );

      for (const rule of rules) {
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**${rule.number}.** ${rule.title}\n${rule.description}`
          )
        );
        container.addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        );
      }

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# ${rules.length} rule(s)`)
      );

      return interaction.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (subcommand === "send") {
      const channel = (interaction.options.getChannel("channel") ?? interaction.channel) as TextChannel;
      const customTitle = interaction.options.getString("titre");
      const customFooter = interaction.options.getString("footer");

      const rules = await client.db.rule.findMany({
        where: { guildId },
        orderBy: { number: "asc" },
      });

      if (rules.length === 0) {
        return interaction.reply({
          ...errorMessage({ description: "Add rules first with `/regle add`" }),
          ephemeral: true,
        });
      }

      // Build the rules panel
      const container = new ContainerBuilder().setAccentColor(Colors.Warning);

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# 📜 ${customTitle ?? "Server Rules"}`)
      );

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "By joining this server, you agree to follow the rules below."
        )
      );

      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );

      for (const rule of rules) {
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### 📌 Rule ${rule.number}: ${rule.title}\n${rule.description}`
          )
        );
        container.addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        );
      }

      // Footer
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          customFooter ?? "-# Failure to follow these rules may result in sanctions."
        )
      );

      // Send the panel
      const msg = await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });

      // Optional: Send accept button
      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("rules_accept")
          .setLabel("✅ I accept the rules")
          .setStyle(ButtonStyle.Success)
      );

      await channel.send({
        content: "-# Click the button to confirm that you have read and accepted the rules.",
        components: [buttonRow],
      });

      // Save panel info
      await client.db.rulesPanel.upsert({
        where: { guildId },
        create: {
          guildId,
          channelId: channel.id,
          messageId: msg.id,
          title: customTitle ?? "Server Rules",
          footer: customFooter,
        },
        update: {
          channelId: channel.id,
          messageId: msg.id,
          title: customTitle ?? "Server Rules",
          footer: customFooter,
        },
      });

      return interaction.reply({
        ...successMessage({
          title: "Rules Sent",
          description: `The rules have been sent in <#${channel.id}>`,
        }),
        ephemeral: true,
      });
    }

    if (subcommand === "refresh") {
      const panel = await client.db.rulesPanel.findUnique({
        where: { guildId },
      });

      if (!panel || !panel.channelId || !panel.messageId) {
        return interaction.reply({
          ...errorMessage({ description: "No existing rules. Use `/regle send` to create them." }),
          ephemeral: true,
        });
      }

      const channel = client.channels.cache.get(panel.channelId) as TextChannel;
      if (!channel) {
        return interaction.reply({
          ...errorMessage({ description: "Rules channel not found." }),
          ephemeral: true,
        });
      }

      const rules = await client.db.rule.findMany({
        where: { guildId },
        orderBy: { number: "asc" },
      });

      // Build updated panel
      const container = new ContainerBuilder().setAccentColor(Colors.Warning);

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# 📜 ${panel.title}`)
      );

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "By joining this server, you agree to follow the rules below."
        )
      );

      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );

      for (const rule of rules) {
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### 📌 Rule ${rule.number}: ${rule.title}\n${rule.description}`
          )
        );
        container.addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        );
      }

      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          panel.footer ?? "-# Failure to follow these rules may result in sanctions."
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
            title: "Rules Refreshed",
            description: "The rules have been updated.",
          }),
          ephemeral: true,
        });
      } catch {
        return interaction.reply({
          ...errorMessage({ description: "Unable to find the rules message. Recreate it with `/regle send`." }),
          ephemeral: true,
        });
      }
    }

    if (subcommand === "preset") {
      const presetRules = [
        { number: 1, title: "Respect", description: "Respect all server members. Insults, harassment and toxic behavior are prohibited." },
        { number: 2, title: "Spam & Advertising", description: "Spam, advertising and self-promotion are prohibited without prior authorization." },
        { number: 3, title: "Appropriate Content", description: "All NSFW, illegal or shocking content is strictly prohibited." },
        { number: 4, title: "Channels", description: "Use the appropriate channels for your messages. Avoid off-topic content." },
        { number: 5, title: "Username", description: "Your username must be appropriate and mentionable. No excessive special characters." },
        { number: 6, title: "Conflicts", description: "Resolve your conflicts privately. Public disputes are not tolerated." },
        { number: 7, title: "Staff", description: "Respect staff decisions. For any dispute, contact an administrator privately." },
      ];

      // Delete existing rules
      await client.db.rule.deleteMany({ where: { guildId } });

      // Create preset rules
      await client.db.rule.createMany({
        data: presetRules.map((r) => ({ guildId, ...r })),
      });

      return interaction.reply(
        successMessage({
          title: "Preconfigured Rules",
          description: `**${presetRules.length} rules** have been added.\n\nUse \`/regle list\` to view them or \`/regle send\` to send the rules.`,
        })
      );
    }
  },
} satisfies Command;
