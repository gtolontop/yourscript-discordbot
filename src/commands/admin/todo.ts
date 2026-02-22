import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import type { Command } from "../../types/index.js";
import { createMessage, successMessage, errorMessage, Colors } from "../../utils/index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("todo")
    .setDescription("Manage team tasks")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a new task")
        .addStringOption((opt) =>
          opt.setName("title").setDescription("Task title").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("description").setDescription("Task description").setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("priority")
            .setDescription("Task priority")
            .setRequired(false)
            .addChoices(
              { name: "Low", value: "low" },
              { name: "Normal", value: "normal" },
              { name: "High", value: "high" },
              { name: "Urgent", value: "urgent" }
            )
        )
        .addUserOption((opt) =>
          opt.setName("assignee").setDescription("Assign to a team member").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List all open tasks")
        .addStringOption((opt) =>
          opt
            .setName("status")
            .setDescription("Filter by status")
            .setRequired(false)
            .addChoices(
              { name: "Open", value: "open" },
              { name: "In Progress", value: "in_progress" },
              { name: "Done", value: "done" },
              { name: "All", value: "all" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("done")
        .setDescription("Mark a task as done")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Task ID").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("assign")
        .setDescription("Assign a task to someone")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Task ID").setRequired(true)
        )
        .addUserOption((opt) =>
          opt.setName("user").setDescription("User to assign").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a task")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Task ID").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("info")
        .setDescription("View task details")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Task ID").setRequired(true)
        )
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    switch (sub) {
      case "add": {
        const title = interaction.options.getString("title", true);
        const description = interaction.options.getString("description");
        const priority = interaction.options.getString("priority") ?? "normal";
        const assignee = interaction.options.getUser("assignee");

        const todo = await client.db.todo.create({
          data: {
            guildId,
            title,
            description,
            priority,
            assigneeId: assignee?.id ?? null,
          },
        });

        const priorityEmoji: Record<string, string> = {
          urgent: "🔴",
          high: "🟠",
          normal: "🟡",
          low: "🟢",
        };

        return interaction.reply(
          successMessage({
            title: "Task Created",
            description: [
              `${priorityEmoji[priority]} **${title}** (ID: ${todo.id})`,
              description ? `\n${description}` : "",
              assignee ? `\nAssigned to: ${assignee.toString()}` : "",
            ].join(""),
          })
        );
      }

      case "list": {
        const statusFilter = interaction.options.getString("status") ?? "open";
        const where: any = { guildId };
        if (statusFilter !== "all") {
          where.status = statusFilter === "open" ? { in: ["open", "in_progress"] } : statusFilter;
        }

        const todos = await client.db.todo.findMany({
          where,
          orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
          take: 25,
        });

        if (todos.length === 0) {
          return interaction.reply(
            createMessage({
              title: "Task List",
              description: "No tasks found.",
              color: "Info",
            })
          );
        }

        const priorityEmoji: Record<string, string> = {
          urgent: "🔴",
          high: "🟠",
          normal: "🟡",
          low: "🟢",
        };

        const statusEmoji: Record<string, string> = {
          open: "📋",
          in_progress: "🔄",
          done: "✅",
          cancelled: "❌",
        };

        const lines = todos.map((t) => {
          const pe = priorityEmoji[t.priority] ?? "🟡";
          const se = statusEmoji[t.status] ?? "📋";
          const assignee = t.assigneeId ? `<@${t.assigneeId}>` : "—";
          return `${se} ${pe} **#${t.id}** ${t.title} — ${assignee}`;
        });

        return interaction.reply(
          createMessage({
            title: "Task List",
            description: lines.join("\n"),
            color: "Info",
            footer: `${todos.length} task(s)`,
          })
        );
      }

      case "done": {
        const id = interaction.options.getInteger("id", true);
        const todo = await client.db.todo.findFirst({ where: { id, guildId } });

        if (!todo) {
          return interaction.reply(errorMessage({ description: `Task #${id} not found.` }));
        }

        await client.db.todo.update({
          where: { id },
          data: { status: "done", completedAt: new Date() },
        });

        return interaction.reply(
          successMessage({ description: `Task **#${id}** marked as done.` })
        );
      }

      case "assign": {
        const id = interaction.options.getInteger("id", true);
        const user = interaction.options.getUser("user", true);
        const todo = await client.db.todo.findFirst({ where: { id, guildId } });

        if (!todo) {
          return interaction.reply(errorMessage({ description: `Task #${id} not found.` }));
        }

        await client.db.todo.update({
          where: { id },
          data: { assigneeId: user.id, status: "in_progress" },
        });

        return interaction.reply(
          successMessage({ description: `Task **#${id}** assigned to ${user.toString()}.` })
        );
      }

      case "remove": {
        const id = interaction.options.getInteger("id", true);
        const todo = await client.db.todo.findFirst({ where: { id, guildId } });

        if (!todo) {
          return interaction.reply(errorMessage({ description: `Task #${id} not found.` }));
        }

        await client.db.todo.delete({ where: { id } });

        return interaction.reply(
          successMessage({ description: `Task **#${id}** removed.` })
        );
      }

      case "info": {
        const id = interaction.options.getInteger("id", true);
        const todo = await client.db.todo.findFirst({ where: { id, guildId } });

        if (!todo) {
          return interaction.reply(errorMessage({ description: `Task #${id} not found.` }));
        }

        const priorityEmoji: Record<string, string> = {
          urgent: "🔴 Urgent",
          high: "🟠 High",
          normal: "🟡 Normal",
          low: "🟢 Low",
        };

        return interaction.reply(
          createMessage({
            title: `Task #${id}`,
            description: [
              `**Title:** ${todo.title}`,
              todo.description ? `**Description:** ${todo.description}` : null,
              `**Priority:** ${priorityEmoji[todo.priority] ?? todo.priority}`,
              `**Status:** ${todo.status}`,
              `**Assigned to:** ${todo.assigneeId ? `<@${todo.assigneeId}>` : "Nobody"}`,
              todo.fromTicketId ? `**From ticket:** #${todo.fromTicketId}` : null,
              `**Created:** <t:${Math.floor(todo.createdAt.getTime() / 1000)}:R>`,
              todo.completedAt ? `**Completed:** <t:${Math.floor(todo.completedAt.getTime() / 1000)}:R>` : null,
            ].filter(Boolean).join("\n"),
            color: "Info",
          })
        );
      }
    }
  },
} satisfies Command;
