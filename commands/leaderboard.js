import { ref, get } from "firebase/database";
import { LEADERBOARD } from "../utils/constants.js";
import { createLeaderboardEmbed, createErrorEmbed } from "../utils/embeds.js";

export async function handleLeaderboard(interaction, db, currentUserId) {
  try {
    await interaction.deferReply();

    const gambleRef = ref(db, `users`);
    const gambleSnapshot = await get(gambleRef);

    const gambleUsers = gambleSnapshot.val();
    if (!gambleUsers) {
      return await interaction.editReply("No users found.");
    }

    let usersArr = Object.keys(gambleUsers).map((userId) => ({
      id: userId,
      balance: gambleUsers[userId].balance ?? 0,
    }));

    usersArr.sort((p1, p2) => p2.balance - p1.balance);
    usersArr = usersArr.slice(0, LEADERBOARD.MAX_ENTRIES);

    const userFetchPromises = usersArr.map((user) =>
      interaction.client.users.fetch(user.id).then((fetchedUser) => ({
        username: fetchedUser.username,
        balance: user.balance,
      }))
    );

    const userDetails = await Promise.all(userFetchPromises);

    let leaderboard = "";

    for (let i = 0; i < userDetails.length; i++) {
      const placeEmoji = LEADERBOARD.PLACE_EMOJIS[i] || "";
      leaderboard += `${placeEmoji || "  **" + (i + 1) + ".** "} ${
        userDetails[i].username
      }: **${userDetails[i].balance}**\n`;
    }

    await interaction.editReply({
      embeds: [createLeaderboardEmbed(leaderboard)],
    });

  } catch (error) {
    console.error("Leaderboard error:", error);
    await interaction.editReply({
      embeds: [createErrorEmbed("Fehler", "Ein Fehler ist aufgetreten beim Abrufen des Leaderboards.")],
    });
  }
}
