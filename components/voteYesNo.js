import { ref, get, update } from "firebase/database";

export async function handleVoteYesNo(
  interaction,
  db,
  currentUserId,
  componentId,
) {
  const voteID = componentId.split("_").pop();
  const voteRef = ref(db, `votes/${voteID}`);

  try {
    const voteSnapshot = await get(voteRef);

    if (!voteSnapshot.exists()) {
      console.error(`Vote with ID ${voteID} does not exist.`);
      await interaction.reply({
        content: "Abstimmung nicht gefunden.",
        ephemeral: true,
      });
      return;
    }

    const currentVote = voteSnapshot.val();

    if (!currentVote.users) {
      currentVote.users = {};
    }
    currentVote.users[currentUserId] = componentId.startsWith("vote_yes");

    await update(voteRef, { users: currentVote.users });

    const usersAccepted = Object.entries(currentVote.users)
      .filter(([_, vote]) => vote)
      .map(([userId]) => userId);

    const usersDeclined = Object.entries(currentVote.users)
      .filter(([_, vote]) => !vote)
      .map(([userId]) => userId);

    const embed = {
      title: "Abstimmung",
      description: currentVote.description,
      author: {
        name: interaction.message.embeds[0].author.name,
        url: interaction.message.embeds[0].author.url,
      },
      fields: [
        {
          name: "Zugestimmt",
          value: usersAccepted,
        },
        {
          name: "Abgelehnt",
          value: usersDeclined,
        },
      ],
    };

    await interaction.update({
      embeds: [embed],
    });
  } catch (err) {
    console.error("Error handling vote interaction:", err);
    await interaction.reply({
      content: "Interner Serverfehler.",
      ephemeral: true,
    });
  }
}
