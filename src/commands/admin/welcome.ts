import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } from "discord.js";
import type { Command } from "../../types/index.js";
import { successMessage, errorMessage, Colors } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Configurer les messages de bienvenue")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Configurer le message de bienvenue")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel pour les messages de bienvenue")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("message")
            .setDescription("Message de bienvenue (utilise {user}, {username}, {server}, {memberCount})")
            .setRequired(true)
            .setMaxLength(1000)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("disable").setDescription("Désactiver les messages de bienvenue")
    )
    .addSubcommand((sub) =>
      sub.setName("show").setDescription("Voir la configuration actuelle")
    )
    .addSubcommand((sub) =>
      sub.setName("test").setDescription("Tester le message de bienvenue")
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (subcommand === "setup") {
      const channel = interaction.options.getChannel("channel", true);
      const message = interaction.options.getString("message", true);

      await client.db.guild.upsert({
        where: { id: guildId },
        create: {
          id: guildId,
          welcomeChannel: channel.id,
          welcomeMessage: message,
        },
        update: {
          welcomeChannel: channel.id,
          welcomeMessage: message,
        },
      });

      return interaction.reply(
        successMessage({
          title: "👋 Bienvenue configuré",
          description: [
            `**Channel:** <#${channel.id}>`,
            "",
            "**Message:**",
            `\`\`\`${message}\`\`\``,
            "",
            "**Variables disponibles:**",
            "• `{user}` - Mention du membre",
            "• `{username}` - Nom du membre",
            "• `{tag}` - Tag complet (User#1234)",
            "• `{server}` - Nom du serveur",
            "• `{memberCount}` - Nombre de membres",
            "",
            "*Ajoute `{embed}` au début pour afficher en embed.*",
          ].join("\n"),
        })
      );
    }

    if (subcommand === "disable") {
      await client.db.guild.upsert({
        where: { id: guildId },
        create: { id: guildId },
        update: {
          welcomeChannel: null,
          welcomeMessage: null,
        },
      });

      return interaction.reply(
        successMessage({ description: "Messages de bienvenue désactivés." })
      );
    }

    if (subcommand === "show") {
      const config = await client.db.guild.findUnique({
        where: { id: guildId },
      });

      if (!config?.welcomeChannel || !config?.welcomeMessage) {
        return interaction.reply({
          ...errorMessage({ description: "Les messages de bienvenue ne sont pas configurés." }),
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("👋 Configuration de bienvenue")
        .setColor(Colors.Primary)
        .addFields(
          { name: "Channel", value: `<#${config.welcomeChannel}>`, inline: true },
          { name: "Message", value: `\`\`\`${config.welcomeMessage}\`\`\``, inline: false }
        );

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "test") {
      const config = await client.db.guild.findUnique({
        where: { id: guildId },
      });

      if (!config?.welcomeChannel || !config?.welcomeMessage) {
        return interaction.reply({
          ...errorMessage({ description: "Les messages de bienvenue ne sont pas configurés." }),
          ephemeral: true,
        });
      }

      const member = interaction.member!;
      const message = config.welcomeMessage
        .replace(/{user}/g, interaction.user.toString())
        .replace(/{username}/g, interaction.user.username)
        .replace(/{tag}/g, interaction.user.tag)
        .replace(/{server}/g, interaction.guild!.name)
        .replace(/{memberCount}/g, interaction.guild!.memberCount.toString());

      // Show preview
      if (config.welcomeMessage.startsWith("{embed}")) {
        const text = message.replace("{embed}", "").trim();
        const previewEmbed = new EmbedBuilder()
          .setDescription(text)
          .setColor(Colors.Success)
          .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
          .setTimestamp();

        return interaction.reply({
          content: "**Aperçu du message de bienvenue:**",
          embeds: [previewEmbed],
          ephemeral: true,
        });
      } else {
        return interaction.reply({
          content: `**Aperçu du message de bienvenue:**\n\n${message}`,
          ephemeral: true,
        });
      }
    }
  },
} satisfies Command;
