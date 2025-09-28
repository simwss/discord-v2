import { ref, update, get } from "firebase/database";
import { ensureUserExists } from "../utils/utils.js";
import { miners } from "../utils/miners.js";
import { createInsufficientFundsEmbed, createMinerPurchaseEmbed } from "../utils/embeds.js";

export async function handleBuy(interaction, db, currentUserId) {
  const type = interaction.options.getString("art")?.toLowerCase();

    const userData = await ensureUserExists(db, currentUserId, interaction);

  const selectedMiner = miners[type];
  const userBalance = userData.balance || 0;

  if (userBalance < selectedMiner.cost) {
    return await interaction.reply({
      embeds: [createInsufficientFundsEmbed(selectedMiner.cost, userBalance)],
      ephemeral: true,
    });
  }

  const updatedBalance = userBalance - selectedMiner.cost;
  const minerKey = `${type}Miners`;
  const updatedMinersCount = (userData[minerKey] || 0) + 1;
  const userRef = ref(db, `users/${currentUserId}`);

  await update(userRef, {
    balance: updatedBalance,
    [minerKey]: updatedMinersCount,
  });

  await interaction.reply({ 
    embeds: [createMinerPurchaseEmbed(selectedMiner.name, selectedMiner.cost, updatedBalance, updatedMinersCount)] 
  });
}