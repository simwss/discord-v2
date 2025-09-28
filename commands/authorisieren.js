import { ref, update } from "firebase/database";
import { isUserAuthorised } from "../services/authorisation.js";
import { createAuthEmbed } from "../utils/embeds.js";
import { EMBED_COLORS } from "../utils/constants.js";

export async function handleAuthorisieren(interaction, db, currentUserId) {
  const userToAuthorize = interaction.options.getUser("nutzer").id;
  const isAuthorised = await isUserAuthorised(db, currentUserId);

  let title = "Autorisierung";
  let description = "Du hast keine Berechtigung zum Authorisieren anderer Personen";
  let color = EMBED_COLORS.ERROR;
  
  if (isAuthorised) {
    if (!(await isUserAuthorised(db, userToAuthorize))) {
      const authorisedRef = ref(db, `users/${userToAuthorize}`);
      await update(authorisedRef, { authorised: true });
      title = "Erfolg";
      description = "Authorisieren erfolgreich";
      color = EMBED_COLORS.SUCCESS;
    } else {
      description = "Nutzer ist schon authorisiert";
      color = EMBED_COLORS.WARNING;
    }
  }

  await interaction.reply({
    embeds: [createAuthEmbed(title, description, color)],
    allowedMentions: { users: [userToAuthorize] },
  });
}