import { ensureUserExists } from "../utils/utils.js";
import { getBloadAlcohol } from "../utils/alcoholProcesses.js";
import { createProfileEmbed } from "../utils/embeds.js";

export async function handleProfile(interaction, db, currentUserId) {
  const userData = await ensureUserExists(db, currentUserId, interaction);
  const alcoholLevel = getBloadAlcohol(userData.grammAlcohol);
  
  await interaction.reply({ 
    embeds: [createProfileEmbed(userData, alcoholLevel)] 
  });
}
