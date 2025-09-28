import { ref, get, update } from "firebase/database";
import { isUserAuthorised } from "../services/authorisation.js";

export async function handleVoteEnd(
  interaction,
  db,
  currentUserId,
  componentId,
) {
  const voteID = componentId.split("_").pop();
  const voteRef = ref(db, `votes/${voteID}`);
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

  const isAuthorised = await isUserAuthorised(db, currentUserId);

  if (isAuthorised) {
    await update(voteRef, { closed: true });

    const usersAccepted = Object.entries(currentVote.users || {})
      .filter(([_, vote]) => vote)
      .map(([userId]) => userId);

    const usersDeclined = Object.entries(currentVote.users || {})
      .filter(([_, vote]) => !vote)
      .map(([userId]) => userId);

    const acceptedCount = usersAccepted.length;
    const declinedCount = usersDeclined.length;

    const result = acceptedCount > declinedCount ? "durchgesetzt" : "abgelehnt";

    const embed = {
      title: "Ergebnis",
      description: currentVote.description,
      fields: [
        {
          name: "Zugestimmt",
          value: String(usersAccepted),
        },
        {
          name: "Abgelehnt",
          value: String(usersDeclined),
        },
      ],
    };

    await interaction.update({
      content: `Der Gesetzesvorschlag wurde ${result}.`,
      embeds: [embed],
      components: [],
    });
  } else {
    console.error("User is not authorised to end the vote");
    await interaction.reply({
      content: "Du hast keine Berechtigung, die Abstimmung zu beenden.",
      ephemeral: true,
    });
  }
}
