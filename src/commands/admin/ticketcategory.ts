import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import type { Command } from "../../types/index.js";
import { successMessage, errorMessage, Colors } from "../../utils/index.js";
import { EmbedBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ticketcategory")
    .setDescription("Gère les catégories de tickets")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Ajoute une catégorie de ticket")
        .addStringOption((opt) =>
          opt
            .setName("nom")
            .setDescription("Nom de la catégorie")
            .setRequired(true)
            .setMaxLength(50)
        )
        .addStringOption((opt) =>
          opt
            .setName("description")
            .setDescription("Description de la catégorie")
            .setRequired(false)
            .setMaxLength(100)
        )
        .addStringOption((opt) =>
          opt
            .setName("emoji")
            .setDescription("Emoji de la catégorie")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Supprime une catégorie de ticket")
        .addStringOption((opt) =>
          opt
            .setName("nom")
            .setDescription("Nom de la catégorie à supprimer")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("Liste les catégories de tickets")
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (subcommand === "add") {
      const name = interaction.options.getString("nom", true);
      const description = interaction.options.getString("description");
      const emoji = interaction.options.getString("emoji");

      // Check if category already exists
      const existing = await client.db.ticketCategory.findUnique({
        where: { guildId_name: { guildId, name } },
      });

      if (existing) {
        return interaction.reply({
          ...errorMessage({ description: `La catégorie **${name}** existe déjà.` }),
          ephemeral: true,
        });
      }

      // Create category
      await client.db.ticketCategory.create({
        data: {
          guildId,
          name,
          description,
          emoji,
        },
      });

      return interaction.reply(
        successMessage({
          description: `Catégorie **${emoji ? emoji + " " : ""}${name}** créée avec succès.`,
        })
      );
    }

    if (subcommand === "remove") {
      const name = interaction.options.getString("nom", true);

      const category = await client.db.ticketCategory.findUnique({
        where: { guildId_name: { guildId, name } },
      });

      if (!category) {
        return interaction.reply({
          ...errorMessage({ description: `La catégorie **${name}** n'existe pas.` }),
          ephemeral: true,
        });
      }

      await client.db.ticketCategory.delete({
        where: { id: category.id },
      });

      return interaction.reply(
        successMessage({
          description: `Catégorie **${name}** supprimée.`,
        })
      );
    }

    if (subcommand === "list") {
      const categories = await client.db.ticketCategory.findMany({
        where: { guildId },
        orderBy: { createdAt: "asc" },
      });

      if (categories.length === 0) {
        return interaction.reply({
          ...errorMessage({
            description: "Aucune catégorie de ticket configurée.\nUtilise `/ticketcategory add` pour en créer une.",
          }),
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("📁 Catégories de tickets")
        .setDescription(
          categories
            .map((cat, i) => {
              let line = `**${i + 1}.** ${cat.emoji ? cat.emoji + " " : ""}${cat.name}`;
              if (cat.description) line += `\n   └ *${cat.description}*`;
              return line;
            })
            .join("\n\n")
        )
        .setColor(Colors.Primary)
        .setFooter({ text: `${categories.length} catégorie(s)` });

      return interaction.reply({ embeds: [embed] });
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
