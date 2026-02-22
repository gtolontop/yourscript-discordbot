import type { ModalComponent } from "../../types/index.js";
import { TicketService } from "../../services/TicketService.js";
import { errorMessage, successMessage, logger } from "../../utils/index.js";

export default {
  customId: /^ticket_create_modal/,

  async execute(interaction, client) {
    const ticketService = new TicketService(client);

    // Extract category from customId if present (ticket_create_modal_Support)
    const parts = interaction.customId.split("_");
    const category = parts.length > 3 ? parts.slice(3).join("_") : undefined;

    await interaction.deferReply({ ephemeral: true });

    // Extract all fields with proper null checking
    let subject: string | undefined;
    let username: string | undefined;
    let serverIp: string | undefined;
    let description: string | undefined;

    // Try using the fields collection first
    try {
      const subjectVal = interaction.fields.getTextInputValue("subject");
      subject = subjectVal?.trim() || undefined;
    } catch (e) {
      // Field doesn't exist via getTextInputValue
    }

    try {
      const usernameVal = interaction.fields.getTextInputValue("username");
      username = usernameVal?.trim() || undefined;
    } catch (e) {
      // Field doesn't exist via getTextInputValue
    }

    try {
      const ipVal = interaction.fields.getTextInputValue("server_ip");
      serverIp = ipVal?.trim() || undefined;
    } catch (e) {
      // Field doesn't exist via getTextInputValue
    }

    try {
      const descVal = interaction.fields.getTextInputValue("description");
      description = descVal?.trim() || undefined;
    } catch (e) {
      // Field doesn't exist via getTextInputValue
    }

    // Debug: log the interaction structure
    logger.info(`[MODAL] Interaction type: ${interaction.constructor.name}`);
    logger.info(`[MODAL] Fields collection size: ${interaction.fields.fields?.size ?? 0}`);

    // Fallback: manually parse raw interaction data if fields are empty
    if (!subject && !username && !serverIp && !description) {
      const rawData = (interaction as any).data;
      logger.info(`[MODAL] Raw data keys: ${rawData ? Object.keys(rawData).join(", ") : "no data"}`);
      logger.info(`[MODAL] Raw components: ${JSON.stringify(rawData?.components)}`);

      if (rawData?.components) {
        const rawComponents = rawData.components as any[];
        const fieldMap = new Map<string, string>();

        for (const row of rawComponents) {
          for (const component of row.components || []) {
            if (component.custom_id && component.value) {
              fieldMap.set(component.custom_id, component.value);
            }
          }
        }

        subject = fieldMap.get("subject")?.trim() || undefined;
        username = fieldMap.get("username")?.trim() || undefined;
        serverIp = fieldMap.get("server_ip")?.trim() || undefined;
        description = fieldMap.get("description")?.trim() || undefined;
      }
    }

    // Debug logging for modal submission
    const fieldsDebug = {
      subject: subject ?? "(empty)",
      username: username ?? "(empty)",
      serverIp: serverIp ?? "(empty)",
      description: description ?? "(empty)",
      rawComponents: interaction.components?.length ?? 0
    };
    logger.info(`[MODAL] Ticket submission result: ${JSON.stringify(fieldsDebug)}`);

    // Check if user already has an open ticket
    const existingTicket = await client.db.ticket.findFirst({
      where: {
        userId: interaction.user.id,
        guildId: interaction.guildId!,
        status: "open",
      },
    });

    if (existingTicket) {
      return interaction.editReply(
        errorMessage({
          description: `You already have an open ticket: <#${existingTicket.channelId}>`,
        })
      );
    }

    const channel = await ticketService.createTicket(
      interaction.guild!,
      interaction.user,
      subject,
      category,
      {
        ...(username ? { username } : {}),
        ...(serverIp ? { serverIp } : {}),
        ...(description ? { description } : {}),
      }
    );

    if (!channel) {
      return interaction.editReply(
        errorMessage({
          description: "Unable to create the ticket. The system may not be configured.",
        })
      );
    }

    await interaction.editReply(
      successMessage({
        description: `Your ticket has been created: ${channel.toString()}`,
      })
    );
  },
} satisfies ModalComponent;
