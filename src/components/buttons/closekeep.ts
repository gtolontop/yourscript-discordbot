import type { ButtonComponent } from "../../types/index.js";
import { successMessage } from "../../utils/index.js";

export default {
  customId: "closekeep",

  async execute(interaction) {
    // Remove the close confirmation embed
    await interaction.update({
      components: [],
    });

    await interaction.followUp(
      successMessage({ description: "Ticket will remain open." })
    );
  },
} satisfies ButtonComponent;
