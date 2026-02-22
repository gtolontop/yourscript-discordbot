import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
} from "discord.js";
import type { ButtonComponent } from "../../types/index.js";
import { Bot } from "../../client/Bot.js";
import { logger } from "../../utils/logger.js";

export default {
  customId: "ticket_create",

  async execute(interaction, client: Bot) {
    const guildId = interaction.guildId!;

    // Check if user is blacklisted
    try {
      const blacklist = await client.api.checkTicketBlacklist(
        guildId,
        interaction.user.id,
      );

      if (blacklist) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setDescription(
                blacklist.reason
                  ? `You are blacklisted from tickets.\n**Reason:** ${blacklist.reason}`
                  : "You are blacklisted from tickets.",
              )
              .setColor(0xed4245),
          ],
          ephemeral: true,
        });
        return;
      }
    } catch (error) {
      logger.error("Failed to check ticket blacklist:", error);
    }

    // Check if categories exist
    try {
      const categories = await client.api.getTicketCategories(guildId);

      if (categories.length > 0) {
        // Show select menu for category selection
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("ticket_category_select")
          .setPlaceholder("Choose a category...")
          .addOptions(
            categories.map((cat) => ({
              label: cat.name,
              value: cat.name,
              ...(cat.description && { description: cat.description }),
              ...(cat.emoji && { emoji: cat.emoji }),
            })),
          );

        const embed = new EmbedBuilder()
          .setTitle("Create a Ticket")
          .setDescription(
            "Select the category for your ticket below.",
          )
          .setColor(0x5865f2);

        await interaction.reply({
          embeds: [embed],
          components: [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
              selectMenu,
            ),
          ],
          ephemeral: true,
        });
      } else {
        // No categories, show modal directly
        const config = await client.api.getGuildConfig(guildId);

        const label = config.ticket_modal_label || "Subject (optional)";
        const placeholder =
          config.ticket_modal_placeholder ||
          "Briefly describe your issue...";
        const required = config.ticket_modal_required === 1;

        const modal = new ModalBuilder()
          .setCustomId("ticket_modal")
          .setTitle("Create a Ticket");

        const subjectInput = new TextInputBuilder()
          .setCustomId("subject")
          .setLabel(label)
          .setPlaceholder(placeholder)
          .setStyle(TextInputStyle.Short)
          .setRequired(required)
          .setMaxLength(100);

        const row =
          new ActionRowBuilder<TextInputBuilder>().addComponents(subjectInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
      }
    } catch (error) {
      logger.error("Failed to create ticket:", error);
      await interaction.reply({
        content: "An error occurred while creating the ticket.",
        ephemeral: true,
      });
    }
  },
} satisfies ButtonComponent;
