import {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  ButtonStyle,
} from "discord.js";

/**
 * Message payload for Components V2 messages
 * Compatible with reply, editReply, send, etc.
 */
export interface ComponentsV2Message {
  components: ContainerBuilder[];
  flags: typeof MessageFlags.IsComponentsV2;
}

// Brand colors
export const Colors = {
  Primary: 0x5865f2,
  Success: 0x57f287,
  Warning: 0xfee75c,
  Error: 0xed4245,
  Info: 0x5865f2,
  Blurple: 0x5865f2,
} as const;

export type ColorType = keyof typeof Colors;

interface MessageOptions {
  title?: string;
  description: string;
  color?: ColorType | number;
  footer?: string;
  fields?: Array<{ name: string; value: string }>;
}

interface SuccessMessageOptions {
  title?: string;
  description: string;
  footer?: string;
}

interface ErrorMessageOptions {
  title?: string;
  description: string;
  footer?: string;
}

/**
 * Creates a Components V2 message with a container
 */
export function createMessage(options: MessageOptions): ComponentsV2Message {
  const color = typeof options.color === "number"
    ? options.color
    : Colors[options.color ?? "Primary"];

  const container = new ContainerBuilder().setAccentColor(color);

  // Title
  if (options.title) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${options.title}`)
    );
  }

  // Description
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(options.description)
  );

  // Fields
  if (options.fields && options.fields.length > 0) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    for (const field of options.fields) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**${field.name}**\n${field.value}`)
      );
    }
  }

  // Footer
  if (options.footer) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# ${options.footer}`)
    );
  }

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

/**
 * Creates a success message
 */
export function successMessage(options: SuccessMessageOptions): ComponentsV2Message {
  return createMessage({
    title: options.title ?? "Success",
    description: options.description,
    color: "Success",
    ...(options.footer && { footer: options.footer }),
  });
}

/**
 * Creates an error message
 */
export function errorMessage(options: ErrorMessageOptions): ComponentsV2Message {
  return createMessage({
    title: options.title ?? "Error",
    description: options.description,
    color: "Error",
    ...(options.footer && { footer: options.footer }),
  });
}

/**
 * Creates a warning message
 */
export function warningMessage(options: ErrorMessageOptions): ComponentsV2Message {
  return createMessage({
    title: options.title ?? "Warning",
    description: options.description,
    color: "Warning",
    ...(options.footer && { footer: options.footer }),
  });
}

/**
 * Creates an info message
 */
export function infoMessage(options: MessageOptions): ComponentsV2Message {
  return createMessage({
    ...options,
    color: "Info",
  });
}

/**
 * Creates a section with text and an optional button
 */
export function createSection(
  texts: string[],
  button?: { customId: string; label: string; style?: ButtonStyle }
): SectionBuilder {
  const section = new SectionBuilder();

  for (const text of texts.slice(0, 3)) {
    section.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(text)
    );
  }

  if (button) {
    section.setButtonAccessory((btn) =>
      btn
        .setCustomId(button.customId)
        .setLabel(button.label)
        .setStyle(button.style ?? ButtonStyle.Primary)
    );
  }

  return section;
}

/**
 * Creates a simple text display
 */
export function text(content: string): TextDisplayBuilder {
  return new TextDisplayBuilder().setContent(content);
}

/**
 * Creates a separator
 */
export function separator(divider = false, spacing: SeparatorSpacingSize = SeparatorSpacingSize.Small): SeparatorBuilder {
  return new SeparatorBuilder().setDivider(divider).setSpacing(spacing);
}
