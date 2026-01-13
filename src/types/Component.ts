import type {
  ButtonInteraction,
  ModalSubmitInteraction,
  AnySelectMenuInteraction,
} from "discord.js";
import type { Bot } from "../client/Bot.js";

export interface ButtonComponent {
  customId: string | RegExp;
  execute(interaction: ButtonInteraction, client: Bot): Promise<unknown>;
}

export interface ModalComponent {
  customId: string | RegExp;
  execute(interaction: ModalSubmitInteraction, client: Bot): Promise<unknown>;
}

export interface SelectMenuComponent {
  customId: string | RegExp;
  execute(interaction: AnySelectMenuInteraction, client: Bot): Promise<unknown>;
}

export type Component = ButtonComponent | ModalComponent | SelectMenuComponent;
