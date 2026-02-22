import type { BotBridge } from "../bridge/BotBridge.js";
import { logger } from "../utils/logger.js";
import type { ReviewSubmittedEvent } from "../bridge/types.js";

export class ReviewHandler {
  constructor(private bridge: BotBridge) {}

  /**
   * Handle a submitted review
   * - Rating 4-5: auto-accept
   * - Rating 1-3: do NOT auto-accept, notify team
   */
  async handleReview(data: ReviewSubmittedEvent): Promise<void> {
    logger.ai(`Review received: ${data.rating}/5 for ticket ${data.ticketId}`);

    if (data.rating >= 4) {
      // Auto-accept positive reviews
      try {
        await this.bridge.acceptReview({
          ticketId: data.ticketId,
          guildId: data.guildId,
        });
        logger.ai(`Auto-accepted review (${data.rating}/5) for ticket ${data.ticketId}`);
      } catch (err) {
        logger.error("Failed to auto-accept review:", err);
      }
    } else {
      // Negative review - don't auto-accept, let staff handle
      logger.ai(`Negative review (${data.rating}/5) for ticket ${data.ticketId} - leaving for staff`);
    }
  }
}
