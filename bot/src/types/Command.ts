import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import type { Bot } from "../client/Bot.js";

export interface Command {
  data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandOptionsOnlyBuilder
    | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  execute(
    interaction: ChatInputCommandInteraction,
    client: Bot,
  ): Promise<unknown>;
  autocomplete?(
    interaction: AutocompleteInteraction,
    client: Bot,
  ): Promise<void>;
}
