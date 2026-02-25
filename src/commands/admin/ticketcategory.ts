import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import type { Command } from "../../types/index.js";
import { successMessage, errorMessage, Colors } from "../../utils/index.js";
import { EmbedBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ticketcategory")
    .setDescription("Manage ticket categories")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a ticket category")
        .addStringOption((opt) =>
          opt.setName("nom").setDescription("Category name").setRequired(true).setMaxLength(50)
        )
        .addStringOption((opt) =>
          opt.setName("description").setDescription("Category description").setRequired(false).setMaxLength(100)
        )
        .addStringOption((opt) =>
          opt.setName("emoji").setDescription("Category emoji").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a ticket category")
        .addStringOption((opt) =>
          opt.setName("nom").setDescription("Name of the category to remove").setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("List ticket categories"))
    .addSubcommand((sub) =>
      sub
        .setName("show")
        .setDescription("Show detailed info about a category")
        .addStringOption((opt) =>
          opt.setName("nom").setDescription("Category name").setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("set_channel")
        .setDescription("Set where tickets of this category open")
        .addStringOption((opt) =>
          opt.setName("nom").setDescription("Category name").setRequired(true).setAutocomplete(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Discord Category ID")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildCategory)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("set_title")
        .setDescription("Set the modal title for this category")
        .addStringOption((opt) =>
          opt.setName("nom").setDescription("Category name").setRequired(true).setAutocomplete(true)
        )
        .addStringOption((opt) =>
          opt.setName("title").setDescription("Modal Title").setRequired(true).setMaxLength(45)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("field_add")
        .setDescription("Add a custom field to the category modal (max 5)")
        .addStringOption((opt) =>
          opt.setName("nom").setDescription("Category name").setRequired(true).setAutocomplete(true)
        )
        .addStringOption((opt) =>
          opt.setName("id").setDescription("Unique ID for the field (no spaces)").setRequired(true).setMaxLength(20)
        )
        .addStringOption((opt) =>
          opt.setName("label").setDescription("Field label").setRequired(true).setMaxLength(45)
        )
        .addBooleanOption((opt) =>
          opt.setName("required").setDescription("Is required? (default: true)").setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("style")
            .setDescription("Style (SHORT or PARAGRAPH)")
            .setRequired(false)
            .addChoices({ name: "Short", value: "SHORT" }, { name: "Paragraph", value: "PARAGRAPH" })
        )
        .addStringOption((opt) =>
          opt.setName("placeholder").setDescription("Placeholder text").setRequired(false).setMaxLength(100)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("field_remove")
        .setDescription("Remove a custom field")
        .addStringOption((opt) =>
          opt.setName("nom").setDescription("Category name").setRequired(true).setAutocomplete(true)
        )
        .addStringOption((opt) => opt.setName("id").setDescription("Field ID").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("set_position")
        .setDescription("Set the dropdown position for this category")
        .addStringOption((opt) =>
          opt.setName("nom").setDescription("Category name").setRequired(true).setAutocomplete(true)
        )
        .addIntegerOption((opt) =>
          opt.setName("position").setDescription("Position (0 = first)").setRequired(true).setMinValue(0)
        )
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (subcommand === "add") {
      const name = interaction.options.getString("nom", true);
      const description = interaction.options.getString("description");
      const emoji = interaction.options.getString("emoji");

      const existing = await client.db.ticketCategory.findUnique({
        where: { guildId_name: { guildId, name } },
      });

      if (existing) {
        return interaction.reply({
          ...errorMessage({ description: `The category **${name}** already exists.` }),
          ephemeral: true,
        });
      }

      // Get next position
      const maxPos = await client.db.ticketCategory.findFirst({
        where: { guildId },
        orderBy: { position: "desc" },
      });

      await client.db.ticketCategory.create({
        data: {
          guildId,
          name,
          description,
          emoji,
          position: (maxPos?.position ?? -1) + 1,
        },
      });

      return interaction.reply(
        successMessage({
          description: [
            `Category **${emoji ? emoji + " " : ""}${name}** created!`,
            "",
            "**Next steps:**",
            `• \`/ticketcategory set_title ${name}\` — Custom modal title`,
            `• \`/ticketcategory field_add ${name}\` — Add modal fields`,
            `• \`/ticketcategory set_channel ${name}\` — Custom ticket channel category`,
          ].join("\n"),
        })
      );
    }

    if (subcommand === "remove") {
      const name = interaction.options.getString("nom", true);
      const category = await client.db.ticketCategory.findUnique({
        where: { guildId_name: { guildId, name } },
      });

      if (!category)
        return interaction.reply({
          ...errorMessage({ description: `The category **${name}** does not exist.` }),
          ephemeral: true,
        });

      await client.db.ticketCategory.delete({ where: { id: category.id } });
      return interaction.reply(successMessage({ description: `Category **${name}** deleted.` }));
    }

    if (subcommand === "list") {
      const categories = await client.db.ticketCategory.findMany({
        where: { guildId },
        orderBy: { position: "asc" },
      });

      if (categories.length === 0) {
        return interaction.reply({
          ...errorMessage({
            description: "No ticket categories configured.\nUse `/ticketcategory add` to create one.",
          }),
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("📁 Ticket Categories")
        .setDescription(
          categories
            .map((cat, i) => {
              let fields: any[] = [];
              try { fields = JSON.parse(cat.modalFields); } catch {}

              let line = `**${i + 1}.** ${cat.emoji ? cat.emoji + " " : ""}${cat.name}`;
              if (cat.description) line += `\n   └ *${cat.description}*`;
              line += `\n   └ Modal: ${cat.modalTitle ?? "Default"} • Fields: ${fields.length || "Default"}`;
              if (cat.categoryChannelId) line += `\n   └ Opens in: <#${cat.categoryChannelId}>`;
              return line;
            })
            .join("\n\n")
        )
        .setColor(Colors.Primary)
        .setFooter({ text: `${categories.length} category/categories` });

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "show") {
      const name = interaction.options.getString("nom", true);
      const cat = await client.db.ticketCategory.findUnique({
        where: { guildId_name: { guildId, name } },
      });

      if (!cat) {
        return interaction.reply({
          ...errorMessage({ description: `Category **${name}** not found.` }),
          ephemeral: true,
        });
      }

      let fields: any[] = [];
      try {
        fields = JSON.parse(cat.modalFields);
      } catch {}

      const fieldsDesc =
        fields.length > 0
          ? fields
              .map(
                (f: any, i: number) =>
                  `**${i + 1}.** \`${f.id}\` — ${f.label} (${f.style}, ${f.required ? "required" : "optional"})`
              )
              .join("\n")
          : "*Default fields (Subject + Description)*";

      const embed = new EmbedBuilder()
        .setTitle(`📁 ${cat.emoji ? cat.emoji + " " : ""}${cat.name}`)
        .setDescription(
          [
            cat.description ? `*${cat.description}*\n` : "",
            `**Modal Title:** ${cat.modalTitle ?? `Ticket — ${cat.name}`}`,
            `**Position:** ${cat.position}`,
            `**Opens in:** ${cat.categoryChannelId ? `<#${cat.categoryChannelId}>` : "Default ticket category"}`,
            "",
            `**Modal Fields:**`,
            fieldsDesc,
          ].join("\n")
        )
        .setColor(Colors.Primary);

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "set_channel") {
      const name = interaction.options.getString("nom", true);
      const channel = interaction.options.getChannel("channel", true);

      await client.db.ticketCategory
        .update({
          where: { guildId_name: { guildId, name } },
          data: { categoryChannelId: channel.id },
        })
        .catch(() => null);

      return interaction.reply(
        successMessage({
          description: `Tickets for **${name}** will now open in <#${channel.id}>`,
        })
      );
    }

    if (subcommand === "set_title") {
      const name = interaction.options.getString("nom", true);
      const title = interaction.options.getString("title", true);

      await client.db.ticketCategory
        .update({
          where: { guildId_name: { guildId, name } },
          data: { modalTitle: title },
        })
        .catch(() => null);

      return interaction.reply(
        successMessage({
          description: `Modal title for **${name}** set to \`${title}\``,
        })
      );
    }

    if (subcommand === "field_add") {
      const name = interaction.options.getString("nom", true);
      const cat = await client.db.ticketCategory.findUnique({
        where: { guildId_name: { guildId, name } },
      });
      if (!cat)
        return interaction.reply({
          ...errorMessage({ description: "Category not found." }),
          ephemeral: true,
        });

      let fields: any[] = [];
      try {
        fields = JSON.parse(cat.modalFields);
      } catch {}

      if (fields.length >= 5)
        return interaction.reply({
          ...errorMessage({ description: "Max 5 fields allowed per modal by Discord." }),
          ephemeral: true,
        });

      const newField = {
        id: interaction.options
          .getString("id", true)
          .replace(/\s+/g, "_"),
        label: interaction.options.getString("label", true),
        required: interaction.options.getBoolean("required") ?? true,
        style: interaction.options.getString("style") ?? "SHORT",
        placeholder: interaction.options.getString("placeholder"),
      };

      fields = fields.filter((f: any) => f.id !== newField.id); // replace if exists
      fields.push(newField);

      await client.db.ticketCategory.update({
        where: { id: cat.id },
        data: { modalFields: JSON.stringify(fields) },
      });

      return interaction.reply(
        successMessage({
          description: `Field \`${newField.id}\` added to category **${name}**.\nThis category now has **${fields.length}**/5 fields.`,
        })
      );
    }

    if (subcommand === "field_remove") {
      const name = interaction.options.getString("nom", true);
      const id = interaction.options.getString("id", true);
      const cat = await client.db.ticketCategory.findUnique({
        where: { guildId_name: { guildId, name } },
      });
      if (!cat)
        return interaction.reply({
          ...errorMessage({ description: "Category not found." }),
          ephemeral: true,
        });

      let fields: any[] = [];
      try {
        fields = JSON.parse(cat.modalFields);
      } catch {}

      const newFields = fields.filter((f: any) => f.id !== id);

      if (newFields.length === fields.length) {
        return interaction.reply({
          ...errorMessage({ description: `Field \`${id}\` not found.` }),
          ephemeral: true,
        });
      }

      await client.db.ticketCategory.update({
        where: { id: cat.id },
        data: { modalFields: JSON.stringify(newFields) },
      });

      return interaction.reply(
        successMessage({
          description: `Field \`${id}\` removed from **${name}**.\nRemaining: **${newFields.length}**/5 fields.`,
        })
      );
    }

    if (subcommand === "set_position") {
      const name = interaction.options.getString("nom", true);
      const position = interaction.options.getInteger("position", true);

      await client.db.ticketCategory
        .update({
          where: { guildId_name: { guildId, name } },
          data: { position },
        })
        .catch(() => null);

      return interaction.reply(
        successMessage({
          description: `Position of **${name}** set to **${position}** in the dropdown.`,
        })
      );
    }
  },

  async autocomplete(interaction, client) {
    const focused = interaction.options.getFocused();
    const guildId = interaction.guildId!;

    const categories = await client.db.ticketCategory.findMany({
      where: { guildId },
    });

    const filtered = categories
      .filter((cat) => cat.name.toLowerCase().includes(focused.toLowerCase()))
      .slice(0, 25);

    await interaction.respond(
      filtered.map((cat) => ({
        name: cat.emoji ? `${cat.emoji} ${cat.name}` : cat.name,
        value: cat.name,
      }))
    );
  },
} satisfies Command;
