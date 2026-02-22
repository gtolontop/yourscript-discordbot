import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  ChannelType,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/index.js";
import type { Bot } from "../../client/Bot.js";
import { successMessage, errorMessage, warningMessage, Colors } from "../../utils/index.js";

const data = new SlashCommandBuilder()
  .setName("giveaway")
  .setDescription("Giveaway management system")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Create a new giveaway")
      .addStringOption((opt) =>
        opt
          .setName("prize")
          .setDescription("The prize to give away")
          .setRequired(true)
          .setMaxLength(200)
      )
      .addStringOption((opt) =>
        opt
          .setName("duration")
          .setDescription("Duration (e.g. 1h, 2d, 30m)")
          .setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("winners")
          .setDescription("Number of winners (default: 1)")
          .setMinValue(1)
          .setMaxValue(20)
      )
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Channel for the giveaway (default: current)")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      )
      .addRoleOption((opt) =>
        opt
          .setName("required-role")
          .setDescription("Role required to enter the giveaway")
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("end")
      .setDescription("End a giveaway early")
      .addStringOption((opt) =>
        opt
          .setName("message-id")
          .setDescription("Message ID of the giveaway")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("reroll")
      .setDescription("Reroll the winners of a giveaway")
      .addStringOption((opt) =>
        opt
          .setName("message-id")
          .setDescription("Message ID of the giveaway")
          .setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("count")
          .setDescription("Number of winners to reroll")
          .setMinValue(1)
          .setMaxValue(20)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("List all active giveaways")
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("Delete a giveaway")
      .addStringOption((opt) =>
        opt
          .setName("message-id")
          .setDescription("Message ID of the giveaway")
          .setRequired(true)
      )
  );

async function execute(
  interaction: ChatInputCommandInteraction,
  client: Bot
): Promise<unknown> {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;

  // ─── Create ─────────────────────────────────────────────────────────
  if (subcommand === "create") {
    const prize = interaction.options.getString("prize", true);
    const durationStr = interaction.options.getString("duration", true);
    const winners = interaction.options.getInteger("winners") ?? 1;
    const requiredRole = interaction.options.getRole("required-role");
    const channel = (interaction.options.getChannel("channel") ??
      interaction.channel) as TextChannel;

    // Parse duration
    const duration = parseDuration(durationStr);
    if (!duration || duration < 60000) {
      return interaction.reply({
        ...errorMessage({
          description:
            "Invalid duration. Use the format: 1h, 2d, 30m, etc. (minimum 1 minute).",
        }),
        ephemeral: true,
      });
    }

    const endsAt = new Date(Date.now() + duration);

    const embed = new EmbedBuilder()
      .setTitle("Giveaway")
      .setDescription(
        [
          `**Prize:** ${prize}`,
          "",
          requiredRole ? `**Required role:** ${requiredRole}` : null,
          `**Winners:** ${winners}`,
          `**Ends:** <t:${Math.floor(endsAt.getTime() / 1000)}:R>`,
          "",
          "Click the button below to enter!",
        ]
          .filter(Boolean)
          .join("\n")
      )
      .setColor(Colors.Primary)
      .setFooter({
        text: `Hosted by ${interaction.user.tag} | 0 participants`,
      })
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

    try {
      await client.api.createGiveaway(guildId, {
        channelId: channel.id,
        messageId: message.id,
        hostId: interaction.user.id,
        prize,
        winners,
        requiredRole: requiredRole?.id,
        endsAt: endsAt.toISOString(),
      });

      // Schedule end
      scheduleGiveawayEnd(client, guildId, message.id, duration);

      return interaction.reply({
        ...successMessage({
          description: `Giveaway created in <#${channel.id}>!`,
        }),
        ephemeral: true,
      });
    } catch (error) {
      console.error(error);
      await message.delete().catch(() => {});
      return interaction.reply({
        ...errorMessage({ description: "Failed to create giveaway." }),
        ephemeral: true,
      });
    }
  }

  // ─── End ────────────────────────────────────────────────────────────
  if (subcommand === "end") {
    const messageId = interaction.options.getString("message-id", true);

    try {
      const giveaways = await client.api.getGiveaways(guildId);
      const giveaway = giveaways.find((g) => g.message_id === messageId);

      if (!giveaway) {
        return interaction.reply({
          ...errorMessage({ description: "Giveaway not found." }),
          ephemeral: true,
        });
      }

      if (giveaway.ended) {
        return interaction.reply({
          ...errorMessage({
            description: "This giveaway has already ended.",
          }),
          ephemeral: true,
        });
      }

      await endGiveaway(client, guildId, giveaway);

      return interaction.reply(
        successMessage({ description: "Giveaway ended!" })
      );
    } catch (error) {
      console.error(error);
      return interaction.reply({
        ...errorMessage({ description: "Failed to end giveaway." }),
        ephemeral: true,
      });
    }
  }

  // ─── Reroll ─────────────────────────────────────────────────────────
  if (subcommand === "reroll") {
    const messageId = interaction.options.getString("message-id", true);
    const count = interaction.options.getInteger("count") ?? 1;

    try {
      const giveaways = await client.api.getGiveaways(guildId);
      const giveaway = giveaways.find((g) => g.message_id === messageId);

      if (!giveaway) {
        return interaction.reply({
          ...errorMessage({ description: "Giveaway not found." }),
          ephemeral: true,
        });
      }

      if (!giveaway.ended) {
        return interaction.reply({
          ...errorMessage({
            description: "This giveaway has not ended yet.",
          }),
          ephemeral: true,
        });
      }

      const participants = JSON.parse(giveaway.participants) as string[];
      if (participants.length === 0) {
        return interaction.reply({
          ...errorMessage({
            description: "No participants in this giveaway.",
          }),
          ephemeral: true,
        });
      }

      const newWinners = pickWinners(
        participants,
        Math.min(count, participants.length)
      );

      const channel = interaction.guild?.channels.cache.get(
        giveaway.channel_id
      ) as TextChannel;
      if (channel) {
        await channel.send({
          content: `Congratulations ${newWinners.map((id) => `<@${id}>`).join(", ")}!`,
          embeds: [
            new EmbedBuilder()
              .setTitle("Giveaway Reroll")
              .setDescription(`**Prize:** ${giveaway.prize}`)
              .setColor(Colors.Success)
              .setTimestamp(),
          ],
        });
      }

      return interaction.reply(
        successMessage({
          description: `${newWinners.length} new winner(s) selected!`,
        })
      );
    } catch (error) {
      console.error(error);
      return interaction.reply({
        ...errorMessage({ description: "Failed to reroll giveaway." }),
        ephemeral: true,
      });
    }
  }

  // ─── List ───────────────────────────────────────────────────────────
  if (subcommand === "list") {
    try {
      const giveaways = await client.api.getGiveaways(guildId);
      const active = giveaways.filter((g) => !g.ended);

      if (active.length === 0) {
        return interaction.reply({
          ...warningMessage({ description: "No active giveaways." }),
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("Active Giveaways")
        .setDescription(
          active
            .map((g, i) => {
              const participants = JSON.parse(g.participants).length;
              const endsAt = Math.floor(
                new Date(g.ends_at).getTime() / 1000
              );
              return `**${i + 1}.** ${g.prize}\n   Ends: <t:${endsAt}:R> | ${participants} participant(s) | [Message](https://discord.com/channels/${guildId}/${g.channel_id}/${g.message_id})`;
            })
            .join("\n\n")
        )
        .setColor(Colors.Primary)
        .setFooter({ text: `${active.length} giveaway(s)` });

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      return interaction.reply({
        ...errorMessage({ description: "Failed to fetch giveaways." }),
        ephemeral: true,
      });
    }
  }

  // ─── Delete ─────────────────────────────────────────────────────────
  if (subcommand === "delete") {
    const messageId = interaction.options.getString("message-id", true);

    try {
      const giveaways = await client.api.getGiveaways(guildId);
      const giveaway = giveaways.find((g) => g.message_id === messageId);

      if (!giveaway) {
        return interaction.reply({
          ...errorMessage({ description: "Giveaway not found." }),
          ephemeral: true,
        });
      }

      // Try to delete the giveaway message
      const channel = interaction.guild?.channels.cache.get(
        giveaway.channel_id
      ) as TextChannel;
      if (channel) {
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (msg) await msg.delete().catch(() => {});
      }

      // End the giveaway in the backend (mark as ended)
      await client.api.endGiveaway(guildId, giveaway.id);

      return interaction.reply(
        successMessage({
          description: `Giveaway for **${giveaway.prize}** has been deleted.`,
        })
      );
    } catch (error) {
      console.error(error);
      return interaction.reply({
        ...errorMessage({ description: "Failed to delete giveaway." }),
        ephemeral: true,
      });
    }
  }

  return interaction.reply({
    ...errorMessage({ description: "Unknown subcommand." }),
    ephemeral: true,
  });
}

// ─── Helper Functions ─────────────────────────────────────────────────

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

export async function endGiveaway(
  client: Bot,
  guildId: string,
  giveaway: {
    id: number;
    message_id: string;
    channel_id: string;
    prize: string;
    winners: number;
    participants: string;
  }
): Promise<void> {
  const participants = JSON.parse(giveaway.participants) as string[];
  const winnerIds = pickWinners(
    participants,
    Math.min(giveaway.winners, participants.length)
  );

  // End the giveaway in the backend
  await client.api.endGiveaway(guildId, giveaway.id);

  // Update message
  const guild = client.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(
    giveaway.channel_id
  ) as TextChannel;
  if (!channel) return;

  const message = await channel.messages
    .fetch(giveaway.message_id)
    .catch(() => null);
  if (!message || !message.embeds[0]) return;

  const embed = EmbedBuilder.from(message.embeds[0]);
  embed.setColor(Colors.Success);
  embed.setTitle("Giveaway Ended");

  if (winnerIds.length > 0) {
    embed.setDescription(
      [
        `**Prize:** ${giveaway.prize}`,
        "",
        `**Winners:** ${winnerIds.map((id) => `<@${id}>`).join(", ")}`,
      ].join("\n")
    );

    await channel.send({
      content: `Congratulations ${winnerIds.map((id) => `<@${id}>`).join(", ")}!`,
      reply: { messageReference: giveaway.message_id },
    });
  } else {
    embed.setDescription(
      [`**Prize:** ${giveaway.prize}`, "", "**No participants**"].join("\n")
    );
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

export function scheduleGiveawayEnd(
  client: Bot,
  guildId: string,
  messageId: string,
  delay: number
): void {
  setTimeout(async () => {
    try {
      const giveaways = await client.api.getGiveaways(guildId);
      const giveaway = giveaways.find((g) => g.message_id === messageId);
      if (giveaway && !giveaway.ended) {
        await endGiveaway(client, guildId, giveaway);
      }
    } catch (error) {
      console.error("Failed to auto-end giveaway:", error);
    }
  }, delay);
}

export async function startGiveawayScheduler(client: Bot): Promise<void> {
  // This should be called on bot ready to schedule all active giveaways
  for (const [guildId] of client.guilds.cache) {
    try {
      const giveaways = await client.api.getGiveaways(guildId);
      const now = Date.now();

      for (const g of giveaways) {
        if (g.ended) continue;
        const endsAt = new Date(g.ends_at).getTime();
        const delay = endsAt - now;

        if (delay > 0) {
          scheduleGiveawayEnd(client, guildId, g.message_id, delay);
        } else {
          await endGiveaway(client, guildId, g);
        }
      }
    } catch (error) {
      console.error(`Failed to start giveaway scheduler for ${guildId}:`, error);
    }
  }
}

export default { data, execute } satisfies Command;
