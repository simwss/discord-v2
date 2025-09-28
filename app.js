import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { handleCommand } from "./commands/handleCommand.js";
import { handleComponent } from "./components/index.js";
import { handleMessage } from "./messages/index.js";
import { db } from "./firebaseConfig.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once("ready", () => {
  console.log("Bot is online!");
});

client.on("interactionCreate", async (interaction) => {
  const currentUserId = interaction.user.id;

  if (interaction.isCommand()) {
    await handleCommand(interaction, db, currentUserId);
  } else if (interaction.isMessageComponent()) {
    await handleComponent(interaction, db, currentUserId);
  } else {
    console.error("Unknown interaction type", interaction.type);
  }
});

client.on("messageCreate", async (message) => {
  if(message.author.bot) return
  const currentUserId = message.author.id
  await handleMessage(message, db, currentUserId)
})

client.login(process.env.DISCORD_TOKEN);
