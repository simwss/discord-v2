import { ref, get, set } from "firebase/database";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { ensureUserExists, validateBet } from "../utils/utils.js";
import { GAME_CONFIG } from "../utils/constants.js";
import { createSlotEmbed } from "../utils/embeds.js";

export async function handleSlots(interaction, db, currentUserId) {
  const bet = interaction.options.getInteger("betrag");
  const SLOTS = GAME_CONFIG.SLOTS
  const user = await ensureUserExists(db, currentUserId, interaction);
  const userRef = ref(db, `users/${currentUserId}`);

  const gameRef = ref(db, `slotGames/${currentUserId}`);
  const gameSnapshot = await get(gameRef);

  if (gameSnapshot.exists() && gameSnapshot.val().status === "spinning") {
    await interaction.reply({
      content: "Du hast bereits ein laufendes Spiel. Bitte beende es zuerst.",
      ephemeral: true,
    });
    return;
  }

  if (!validateBet(bet, user.balance, interaction)) {
    return;
  }

  const initialGameState = {
    status: "spinning",
    bet,
  };
  await set(gameRef, initialGameState);

  const embed = createSlotEmbed([], bet);

  const stopButton = new ButtonBuilder()
    .setCustomId(`slots_stop_${currentUserId}_${bet}`)
    .setLabel("Stop")
    .setStyle(ButtonStyle.Danger);

  const actionRow = new ActionRowBuilder().addComponents(stopButton);

  await interaction.reply({
    title: "Slots",
    embeds: [embed],
    components: [actionRow],
  });

  let spinningInterval;

  function startSpinning() {
    spinningInterval = setInterval(async () => {
      let slotResults = Array.from(
        { length: 3 },
        () => SLOTS.SYMBOLS[Math.floor(Math.random() * SLOTS.SYMBOLS.length)],
      );

      await interaction.editReply({
        embeds: [
          {
            fields: [
              {
                name: "Slot",
                value: `${slotResults.join(" ")}`,
              },
              {
                name: "Einsatz",
                value: `${bet}$`,
              },
            ],
          },
        ],
        components: [actionRow],
      });
    }, 1000);
  }

  startSpinning();

  const filter = (i) =>
    i.customId.startsWith("slots_stop") && i.user.id === currentUserId;

  const collector = interaction.channel.createMessageComponentCollector({
    filter,
    time: 60000,
  });

  collector.on("collect", async (i) => {
    clearInterval(spinningInterval);

    let finalSlotResults = Array.from(
      { length: 3 },
      () => SLOTS.SYMBOLS[Math.floor(Math.random() * SLOTS.SYMBOLS.length)],
    );

    let payoutMultiplier;

    if (finalSlotResults.every((symbol) => symbol === finalSlotResults[0])) {
      payoutMultiplier = SLOTS.PAYOUTS[finalSlotResults[0]] || 0;
    } else {
      payoutMultiplier = -1;
    }

    user.balance += bet * payoutMultiplier;

    await set(userRef, user);

    await set(ref(db, `slotGames/${currentUserId}`), null);

    await i.update({
      embeds: [
        {
          title: `Slots - Du hast ${
            payoutMultiplier == -1 ? "verloren" : "gewonnen"
          }`,
          fields: [
            {
              name: "Ergebnis",
              value: `${finalSlotResults.join(" ")}`,
            },
            {
              name: "Kontostand",
              value: `${user.balance}$`,
            },
          ],
        },
      ],
      components: [],
    });
    collector.stop();
  });
}
