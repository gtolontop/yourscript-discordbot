import { ApplicationCommandOptionType, EmbedBuilder } from "discord.js";
import { Command } from "../../handlers/command.js";

export default new Command({
  name: "tebex",
  description: "Check a Tebex transaction or subscription status",
  options: [
    {
      name: "verify",
      description: "Verify a specific Tebex transaction ID",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "transaction_id",
          description: "The Tebex transaction ID (e.g. tbx-1234567a89b0c-123456)",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: "status",
      description: "Check the status of your subscriptions/purchases",
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],
  run: async ({ interaction, client }) => {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "verify") {
      const transactionId = interaction.options.getString("transaction_id", true);

      // We only allow staff to verify any transaction
      // But maybe we allow users to verify their own?
      // Let's just do a DB lookup
      const payment = await client.db.tebexPayment.findUnique({
        where: { id: transactionId },
      });

      if (!payment) {
        return interaction.reply({
          content: `❌ Transaction \`${transactionId}\` not found in our database. It might be invalid, or the webhook hasn't arrived yet.`,
          ephemeral: true,
        });
      }

      if (payment.guildId !== interaction.guildId) {
        return interaction.reply({
          content: `❌ Transaction \`${transactionId}\` belongs to another server.`,
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("✅ Tebex Purchase Verified")
        .setDescription(`Transaction **${transactionId}** is valid.`)
        .addFields(
          { name: "Amount", value: `${payment.amount} ${payment.currency}`, inline: true },
          { name: "Status", value: payment.status, inline: true },
          { 
            name: "Customer Details", 
            value: payment.discordUserId 
              ? `<@${payment.discordUserId}>` 
              : (payment.email ? `Email provided` : `Not linked to Discord`), 
            inline: false 
          },
          { name: "Packages", value: JSON.parse(payment.packages).join(", ") || "None", inline: false }
        )
        .setColor(0x00FF00)
        .setTimestamp(payment.createdAt);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === "status") {
      const payments = await client.db.tebexPayment.findMany({
        where: { discordUserId: interaction.user.id, guildId: interaction.guildId! },
        orderBy: { createdAt: "desc" },
      });

      if (!payments || payments.length === 0) {
        return interaction.reply({
          content: "❌ You have no recorded purchases or active subscriptions linked to this Discord account here.",
          ephemeral: true,
        });
      }

      const totalSpent = payments.reduce((acc, p) => acc + p.amount, 0);
      const packages = new Set<string>();
      payments.forEach(p => {
        try {
          const pkgs = JSON.parse(p.packages);
          pkgs.forEach((pkg: string) => packages.add(pkg));
        } catch {}
      });

      const embed = new EmbedBuilder()
        .setTitle("🛒 Your Store Purchases")
        .setThumbnail(interaction.user.displayAvatarURL())
        .setDescription(`Thank you for supporting the server!`)
        .addFields(
          { name: "Total Purchases", value: payments.length.toString(), inline: true },
          { 
            name: "Total Spent (approx)", 
            value: `${totalSpent.toFixed(2)} ${payments[0]?.currency ?? "USD"}`, 
            inline: true 
          },
          { name: "Owned Packages", value: Array.from(packages).join(", ") || "None", inline: false },
          { 
            name: "Recent Transactions", 
            value: payments.slice(0, 3).map(p => `\`${p.id}\` - ${JSON.parse(p.packages).join(", ")}`).join("\n") || "None",
            inline: false
          }
        )
        .setColor(0x5865f2);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
});
