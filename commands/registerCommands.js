import "dotenv/config";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import { SlashCommandBuilder } from "@discordjs/builders";

const commands = [
  new SlashCommandBuilder()
    .setName("abstimmung")
    .setDescription("Erstelle eine neue Abstimmung für das Volk")
    .addStringOption((option) =>
      option
        .setName("thema")
        .setDescription("Das Thema der Abstimmung")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("authorisieren")
    .setDescription("authorisiere einen Nutzer")
    .addUserOption((option) =>
      option
        .setName("nutzer")
        .setDescription("Nutzer zum authorisieren")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("send")
    .setDescription("schicke einem Nutzer geld")
    .addUserOption((option) =>
      option.setName("nutzer").setDescription("Empfänger").setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("betrag")
        .setDescription("wie viel willst du senden?")
        .setRequired(true),
    ),
new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("Werfe eine Münze")
    .addIntegerOption((option) =>
      option
        .setName("betrag")
        .setDescription("wie viel willst du wetten?")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("seite")
        .setDescription("wähle eine Seite")
        .setRequired(true)
        .addChoices(
          { name: "Kopf", value: "heads" },
          { name: "Zahl", value: "tails" },
        ),
    ),
  new SlashCommandBuilder()
    .setName("diceroll")
    .setDescription("würfel eine angegebenen Wert und gewinne das Sechsfache")
    .addIntegerOption((option) =>
      option
        .setName("betrag")
        .setDescription("wie viel willst du wetten?")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("seite")
        .setDescription("wähle eine Seite")
        .setRequired(true)
        .addChoices(
          { name: "1", value: "1" },
          { name: "2", value: "2" },
          { name: "3", value: "3" },
          { name: "4", value: "4" },
          { name: "5", value: "5" },
          { name: "6", value: "6" },
        ),
    ),

  new SlashCommandBuilder()
    .setName("plinkoball")
    .setDescription("Spiel Plinkoball")
    .addIntegerOption((option) =>
      option
        .setName("betrag")
        .setDescription("wie viel willst du wetten?")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("buy")
    .setDescription("Kaufe einen miner")
    .addStringOption((option) =>
      option
        .setName("art")
        .setDescription("welche Art von miner möchtest du kaufen")
        .setRequired(true)
        .addChoices(
          { name: "BASIC MINER", value: "basic" },
          { name: "ELITE MINER", value: "elite" },
          { name: "DELUXE MINER", value: "deluxe" },
        ),
    ),
  new SlashCommandBuilder()
    .setName("drink")
    .setDescription("drink happy juice C:")
    .addStringOption((option) =>
      option
        .setName("art")
        .setDescription("what kind of juice would you like")
        .setRequired(true)
        .addChoices(
          { name: "KROMBACHER! EINZIGARTIG IM GESCHMACK! MIT FELSQUELLWASSER GEBRAUT!", value: "krombacher" },
        ),
    ),
  new SlashCommandBuilder()
    .setName("blackjack")
    .setDescription("spiele Blackjack")
    .addIntegerOption((option) =>
      option
        .setName("betrag")
        .setDescription("wie viel willst du wetten?")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("slots")
    .setDescription("spiele slots und gewinne potentiell millionen")
    .addIntegerOption((option) =>
      option
        .setName("betrag")
        .setDescription("wie viel willst du wetten?")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("schau dir dein Profil an"),
  new SlashCommandBuilder()
    .setName("collect")
    .setDescription("sammle die Ressourcen deiner Miner ein"),
  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("schau dir die besten Spieler an"),
  new SlashCommandBuilder()
    .setName("roulette")
    .setDescription("spiele eine Runde Roulette")
    .addIntegerOption((option) =>
      option
        .setName("betrag")
        .setDescription("wie viel willst du wetten?")
        .setRequired(true),
    ),
  new SlashCommandBuilder().setName("work").setDescription("geh arbeiten"),
  new SlashCommandBuilder().setName("daily").setDescription("geh arbeiten"),
  new SlashCommandBuilder().setName("weekly").setDescription("geh arbeiten"),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationCommands(process.env.APP_ID), {
      body: commands,
    });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();
