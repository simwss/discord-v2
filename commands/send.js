import { sendMoney } from "../utils/transactions.js";

export async function handleSend(interaction, db, currentUserId) {
  const receiver = interaction.options.getUser("nutzer").id;
  const value = interaction.options.getInteger("betrag");
  
  await sendMoney(interaction, db, currentUserId, receiver, value);
}
