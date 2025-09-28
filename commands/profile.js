import { ensureUserExists } from "../utils/utils.js";
import { createProfileEmbed } from "../utils/embeds.js";

export async function handleProfile(interaction, db, currentUserId) {
  const userData = await ensureUserExists(db, currentUserId, interaction);
  
  await interaction.reply({ 
    embeds: [createProfileEmbed(userData)] 
  });
}
