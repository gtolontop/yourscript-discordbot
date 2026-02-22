import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
} from "discord.js";
import type { Command } from "../../types/index.js";
import { successMessage, errorMessage, Colors } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Giveaway system")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Start a giveaway")
        .addStringOption((opt) =>
          opt
            .setName("prix")
            .setDescription("The prize to win")
            .setRequired(true)
            .setMaxLength(200)
        )
        .addStringOption((opt) =>
          opt
            .setName("duree")
            .setDescription("Duration (e.g. 1h, 2d, 30m)")
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("gagnants")
            .setDescription("Number of winners")
            .setMinValue(1)
            .setMaxValue(20)
        )
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("Required role to participate")
        )
        .addIntegerOption((opt) =>
          opt
            .setName("required_level")
            .setDescription("Minimum level to enter")
            .setMinValue(1)
        )
        .addChannelOption((opt) =>
          opt
            .setName("required_voice")
            .setDescription("Required voice channel to enter")
            .addChannelTypes(2) // Voice channel type
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel for the giveaway (default: current)")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("end")
        .setDescription("End a giveaway manually")
        .addStringOption((opt) =>
          opt
            .setName("message_id")
            .setDescription("Giveaway message ID")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("reroll")
        .setDescription("Reroll new winners")
        .addStringOption((opt) =>
          opt
            .setName("message_id")
            .setDescription("Giveaway message ID")
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("nombre")
            .setDescription("Number of winners to reroll")
            .setMinValue(1)
            .setMaxValue(20)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("View active giveaways")
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (subcommand === "start") {
      const prize = interaction.options.getString("prix", true);
      const durationStr = interaction.options.getString("duree", true);
      const winners = interaction.options.getInteger("gagnants") ?? 1;
      const requiredRole = interaction.options.getRole("role");
      const requiredLevel = interaction.options.getInteger("required_level");
      const requiredVoice = interaction.options.getChannel("required_voice");
      const channel = (interaction.options.getChannel("channel") ?? interaction.channel) as TextChannel;

      // Parse duration
      const duration = parseDuration(durationStr);
      if (!duration || duration < 60000) { // Min 1 minute
        return interaction.reply({
          ...errorMessage({ description: "Invalid duration. Use the format: 1h, 2d, 30m, etc." }),
          ephemeral: true,
        });
      }

      const endsAt = new Date(Date.now() + duration);

      const embed = new EmbedBuilder()
        .setTitle("🎉 Giveaway")
        .setDescription([
          `**Prize:** ${prize}`,
          "",
          requiredRole ? `**Required role:** ${requiredRole}` : null,
          requiredLevel ? `**Required Level:** ${requiredLevel}` : null,
          requiredVoice ? `**Required Voice:** ${requiredVoice}` : null,
          `**Winners:** ${winners}`,
          `**Ends:** <t:${Math.floor(endsAt.getTime() / 1000)}:R>`,
          "",
          "Click the button to participate!",
        ].filter(Boolean).join("\n"))
        .setColor(Colors.Primary)
        .setFooter({ text: `By ${interaction.user.tag} • 0 participants` })
        .setTimestamp(endsAt);

      const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("giveaway_enter")
          .setLabel("Enter")
          .setStyle(ButtonStyle.Success)
          .setEmoji("🎉")
      );

      const message = await channel.send({
        embeds: [embed],
        components: [button],
      });

      // Save to DB
      await (client.db as any).giveaway.create({
        data: {
          guildId,
          channelId: channel.id,
          messageId: message.id,
          hostId: interaction.user.id,
          prize,
          winners,
          requiredRole: requiredRole?.id ?? null,
          requiredLevel,
          requiredVoice: requiredVoice?.id ?? null,
          endsAt,
        },
      });

      // Schedule end
      scheduleGiveawayEnd(client, message.id, duration);

      return interaction.reply({
        ...successMessage({ description: `Giveaway started in <#${channel.id}>!` }),
        ephemeral: true,
      });
    }

    if (subcommand === "end") {
      const messageId = interaction.options.getString("message_id", true);

      const giveaway = await client.db.giveaway.findUnique({
        where: { messageId },
      });

      if (!giveaway) {
        return interaction.reply({
          ...errorMessage({ description: "Giveaway not found." }),
          ephemeral: true,
        });
      }

      if (giveaway.ended) {
        return interaction.reply({
          ...errorMessage({ description: "This giveaway has already ended." }),
          ephemeral: true,
        });
      }

      await endGiveaway(client, messageId);

      return interaction.reply(
        successMessage({ description: "Giveaway ended!" })
      );
    }

    if (subcommand === "reroll") {
      const messageId = interaction.options.getString("message_id", true);
      const count = interaction.options.getInteger("nombre") ?? 1;

      const giveaway = await client.db.giveaway.findUnique({
        where: { messageId },
      });

      if (!giveaway) {
        return interaction.reply({
          ...errorMessage({ description: "Giveaway not found." }),
          ephemeral: true,
        });
      }

      if (!giveaway.ended) {
        return interaction.reply({
          ...errorMessage({ description: "This giveaway has not ended yet." }),
          ephemeral: true,
        });
      }

      const participants = JSON.parse(giveaway.participants) as string[];
      if (participants.length === 0) {
        return interaction.reply({
          ...errorMessage({ description: "No participants in this giveaway." }),
          ephemeral: true,
        });
      }

      // Pick new winners
      const newWinners = pickWinners(participants, Math.min(count, participants.length));

      const channel = interaction.guild?.channels.cache.get(giveaway.channelId) as TextChannel;
      if (channel) {
        await channel.send({
          content: `🎉 New winners: ${newWinners.map((id) => `<@${id}>`).join(", ")}`,
          embeds: [
            new EmbedBuilder()
              .setTitle("🎊 Reroll")
              .setDescription(`**Prize:** ${giveaway.prize}`)
              .setColor(Colors.Success)
              .setTimestamp(),
          ],
        });
      }

      return interaction.reply(
        successMessage({ description: `${newWinners.length} new winner(s) rerolled!` })
      );
    }

    if (subcommand === "list") {
      const giveaways = await client.db.giveaway.findMany({
        where: { guildId, ended: false },
        orderBy: { endsAt: "asc" },
      });

      if (giveaways.length === 0) {
        return interaction.reply({
          ...errorMessage({ description: "No active giveaways." }),
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("🎉 Active Giveaways")
        .setDescription(
          giveaways.map((g, i) => {
            const participants = JSON.parse(g.participants).length;
            return `**${i + 1}.** ${g.prize}\n   └ Ends: <t:${Math.floor(g.endsAt.getTime() / 1000)}:R> | ${participants} participant(s) | [Message](https://discord.com/channels/${guildId}/${g.channelId}/${g.messageId})`;
          }).join("\n\n")
        )
        .setColor(Colors.Primary)
        .setFooter({ text: `${giveaways.length} giveaway(s)` });

      return interaction.reply({ embeds: [embed] });
    }
  },
} satisfies Command;

// Helper functions
function parseDuration(str: string): number | null {
  const regex = /^(\d+)\s*(s|m|h|d|w)$/i;
  const match = str.match(regex);
  if (!match) return null;

  const value = parseInt(match[1]!);
  const unit = match[2]!.toLowerCase();

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit]!;
}

function pickWinners(participants: string[], count: number): string[] {
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export async function endGiveaway(client: any, messageId: string): Promise<void> {
  const giveaway = await client.db.giveaway.findUnique({
    where: { messageId },
  });

  if (!giveaway || giveaway.ended) return;

  const participants = JSON.parse(giveaway.participants) as string[];
  const winnerIds = pickWinners(participants, Math.min(giveaway.winners, participants.length));

  // Update in DB
  await client.db.giveaway.update({
    where: { messageId },
    data: {
      ended: true,
      winnerIds: JSON.stringify(winnerIds),
    },
  });

  // Update message
  const guild = client.guilds.cache.get(giveaway.guildId);
  const channel = guild?.channels.cache.get(giveaway.channelId) as TextChannel;
  if (!channel) return;

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message || !message.embeds[0]) return;

  const embed = EmbedBuilder.from(message.embeds[0]);
  embed.setColor(Colors.Success);
  embed.setTitle("🎉 Giveaway Ended");

  if (winnerIds.length > 0) {
    embed.setDescription([
      `**Prize:** ${giveaway.prize}`,
      "",
      `**Winners:** ${winnerIds.map((id: string) => `<@${id}>`).join(", ")}`,
    ].join("\n"));

    await channel.send({
      content: `🎊 Congratulations ${winnerIds.map((id: string) => `<@${id}>`).join(", ")}!`,
      reply: { messageReference: messageId },
    });
  } else {
    embed.setDescription([
      `**Prize:** ${giveaway.prize}`,
      "",
      "**No participants**",
    ].join("\n"));
  }

  embed.setFooter({ text: `${participants.length} participant(s)` });

  await message.edit({
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("giveaway_ended")
          .setLabel("Ended")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      ),
    ],
  });
}

export function scheduleGiveawayEnd(client: any, messageId: string, delay: number): void {
  setTimeout(async () => {
    await endGiveaway(client, messageId);
  }, delay);
}

// Start scheduler for all active giveaways on bot ready
export async function startGiveawayScheduler(client: any): Promise<void> {
  const giveaways = await client.db.giveaway.findMany({
    where: { ended: false },
  });

  const now = Date.now();
  for (const g of giveaways) {
    const delay = g.endsAt.getTime() - now;
    if (delay > 0) {
      scheduleGiveawayEnd(client, g.messageId, delay);
    } else {
      // Should have ended, end now
      await endGiveaway(client, g.messageId);
    }
  }
}
