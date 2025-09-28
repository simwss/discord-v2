import { ref, get, set } from "firebase/database";
import { ensureUserExists, validateBet } from "../utils/utils.js";
import { EmbedBuilder } from "discord.js";

export async function handleCoinflip(interaction, db, currentUserId) {
  const bet = interaction.options.getInteger("betrag");
  const side = interaction.options.getString("seite").toLowerCase();

  const user = await ensureUserExists(db, currentUserId, interaction);
  const userRef = ref(db, `users/${currentUserId}`);

  if (!validateBet(bet, user.balance, interaction)) return;

  const result = Math.random() >= 0.5 ? "heads" : "tails";
  const won = result === side;
  user.balance += won ? bet : -bet;

  await set(userRef, user);

  const embed = new EmbedBuilder()
    .setTitle(`Coinflip - Du hast ${won ? "gewonnen" : "verloren"}`)
    .setDescription(`Das Ergebnis war ${result === "heads" ? "Kopf" : "Zahl"}!`)
    .addFields([
      { name: "Kontostand", value: `**${user.balance}**$`, inline: true },
    ])
    .setColor(won ? 0x00ff00 : 0xff0000);

  await interaction.reply({ embeds: [embed] });
}

export async function handleDiceroll(interaction, db, currentUserId) {
  const bet = interaction.options.getInteger("betrag");
  const side = Number(interaction.options.getString("seite"));

  const user = await ensureUserExists(db, currentUserId, interaction);
  const userRef = ref(db, `users/${currentUserId}`);

  if (!validateBet(bet, user.balance, interaction)) return;

  const result = Math.floor(Math.random() * 6) + 1;
  const won = result === side;
  user.balance += won ? bet * 6 : -bet;

  await set(userRef, user);

  const embed = new EmbedBuilder()
    .setTitle(`Diceroll - Du hast ${won ? "gewonnen" : "verloren"}`)
    .setDescription(`Das Ergebnis war ${result}!`)
    .addFields([
      { name: "Kontostand", value: `**${user.balance}**$`, inline: true },
    ])
    .setColor(won ? 0x00ff00 : 0xff0000);

  await interaction.reply({ embeds: [embed] });
}