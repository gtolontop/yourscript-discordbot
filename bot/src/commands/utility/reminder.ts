import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types/index.js";
import type { Bot } from "../../client/Bot.js";
import {
  successMessage,
  errorMessage,
  createMessage,
} from "../../utils/index.js";

/**
 * Parse a human-readable duration string into milliseconds.
 * Supported formats: "1h", "30m", "2h30m", "1d", "1d12h", "45s", etc.
 */
function parseDuration(input: string): number | null {
  const regex = /(\d+)\s*(d|h|m|s)/gi;
  let total = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    const value = parseInt(match[1]!, 10);
    const unit = match[2]!.toLowerCase();

    switch (unit) {
      case "d":
        total += value * 86_400_000;
        break;
      case "h":
        total += value * 3_600_000;
        break;
      case "m":
        total += value * 60_000;
        break;
      case "s":
        total += value * 1_000;
        break;
    }
  }

  return total > 0 ? total : null;
}

export default {
  data: new SlashCommandBuilder()
    .setName("reminder")
    .setDescription("Manage your reminders")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set a new reminder")
        .addStringOption((opt) =>
          opt
            .setName("time")
            .setDescription(
              'When to remind you (e.g. "1h", "30m", "2h30m", "1d")',
            )
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("message")
            .setDescription("What to remind you about")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List your active reminders"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("cancel")
        .setDescription("Cancel a reminder")
        .addIntegerOption((opt) =>
          opt
            .setName("id")
            .setDescription("The reminder ID to cancel")
            .setRequired(true),
        ),
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "set": {
        const timeStr = interaction.options.getString("time", true);
        const message = interaction.options.getString("message", true);

        const durationMs = parseDuration(timeStr);

        if (!durationMs) {
          return interaction.reply({
            ...errorMessage({
              description:
                'Invalid duration format. Use combinations like `1h`, `30m`, `2h30m`, `1d`, `45s`.',
            }),
            ephemeral: true,
          });
        }

        if (durationMs < 60_000) {
          return interaction.reply({
            ...errorMessage({
              description:
                "The minimum reminder duration is 1 minute.",
            }),
            ephemeral: true,
          });
        }

        if (durationMs > 30 * 86_400_000) {
          return interaction.reply({
            ...errorMessage({
              description:
                "The maximum reminder duration is 30 days.",
            }),
            ephemeral: true,
          });
        }

        const remindAt = new Date(Date.now() + durationMs);

        try {
          const reminder = await client.api.createReminder({
            userId: interaction.user.id,
            guildId: interaction.guildId!,
            channelId: interaction.channelId,
            message,
            remindAt: remindAt.toISOString(),
          });

          await interaction.reply(
            successMessage({
              title: "Reminder Set",
              description: [
                `**Message:** ${message}`,
                `**When:** <t:${Math.floor(remindAt.getTime() / 1000)}:R> (<t:${Math.floor(remindAt.getTime() / 1000)}:F>)`,
                `**ID:** \`${reminder.id}\``,
              ].join("\n"),
            }),
          );
        } catch (error) {
          console.error("Reminder creation error:", error);
          await interaction.reply({
            ...errorMessage({
              description: "Failed to create the reminder. Please try again later.",
            }),
            ephemeral: true,
          });
        }
        break;
      }

      case "list": {
        try {
          const reminders = await client.api.getReminders(
            interaction.user.id,
          );

          if (reminders.length === 0) {
            return interaction.reply({
              ...createMessage({
                title: "Your Reminders",
                description: "You have no active reminders.",
                color: "Primary",
              }),
              ephemeral: true,
            });
          }

          const reminderList = reminders
            .map((r) => {
              const timestamp = Math.floor(
                new Date(r.remind_at).getTime() / 1000,
              );
              return `**ID \`${r.id}\`** - <t:${timestamp}:R>\n${r.message}`;
            })
            .join("\n\n");

          await interaction.reply({
            ...createMessage({
              title: `Your Reminders (${reminders.length})`,
              description: reminderList,
              color: "Primary",
              footer: "Use /reminder cancel <id> to cancel a reminder",
            }),
            ephemeral: true,
          });
        } catch (error) {
          console.error("Reminder list error:", error);
          await interaction.reply({
            ...errorMessage({
              description: "Failed to fetch your reminders.",
            }),
            ephemeral: true,
          });
        }
        break;
      }

      case "cancel": {
        const reminderId = interaction.options.getInteger("id", true);

        try {
          // Verify the reminder belongs to this user
          const reminders = await client.api.getReminders(
            interaction.user.id,
          );
          const reminder = reminders.find((r) => r.id === reminderId);

          if (!reminder) {
            return interaction.reply({
              ...errorMessage({
                description:
                  "Reminder not found. Make sure the ID is correct and the reminder belongs to you.",
              }),
              ephemeral: true,
            });
          }

          await client.api.deleteReminder(reminderId);

          await interaction.reply(
            successMessage({
              title: "Reminder Cancelled",
              description: `Reminder **\`${reminderId}\`** has been cancelled.\n**Was:** ${reminder.message}`,
            }),
          );
        } catch (error) {
          console.error("Reminder cancel error:", error);
          await interaction.reply({
            ...errorMessage({
              description: "Failed to cancel the reminder.",
            }),
            ephemeral: true,
          });
        }
        break;
      }
    }
  },
} satisfies Command;
