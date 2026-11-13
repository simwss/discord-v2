import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "./types.js";
import { GameRuleError } from "../../core/errors.js";
import { MAX_STAKE } from "../../domain/economy.js";
import {
  assertValidOrder,
  MAX_LEVERAGE,
  MAX_OPEN_POSITIONS,
  MIN_ENTRY_PRICE,
  MIN_LEVERAGE,
  tradingFee,
  type PositionSide,
} from "../../domain/trading.js";
import {
  DISPLAY_QUOTE_MAX_AGE_MS,
  TRADE_QUOTE_MAX_AGE_MS,
} from "../../services/market-service.js";
import { currency } from "../ui/format.js";
import {
  portfolioEmbed,
  positionClosedEmbed,
  positionOpenedEmbed,
  quoteEmbed,
  type PricedPosition,
} from "../ui/trading-embeds.js";
import type { BotContext } from "../context.js";
import type { Asset } from "../../infra/market/types.js";

const ASSET_OPTION = "wertpapier";
const STAKE_OPTION = "einsatz";
const LEVERAGE_OPTION = "hebel";
const POSITION_OPTION = "position";

const ASSET_HINT = "ISIN, US-Kürzel (z.B. AAPL) oder Krypto (z.B. BTC-USD)";

/** Stock prices are frozen while the exchange is closed; trading then would use a stale price. */
async function assertTradable(ctx: BotContext, asset: Asset): Promise<void> {
  const status = await ctx.market.tradingStatus(asset);
  if (!status.open) throw new GameRuleError(status.reason);
}

export const kursCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("kurs")
    .setDescription("Zeigt den aktuellen Kurs einer Aktie oder Kryptowährung")
    .addStringOption((option) =>
      option
        .setName(ASSET_OPTION)
        .setDescription(ASSET_HINT)
        .setRequired(true)
        .setMaxLength(20),
    ),

  async execute(interaction, ctx) {
    await interaction.deferReply();
    const asset = await ctx.market.resolve(
      interaction.options.getString(ASSET_OPTION, true),
    );
    const [quote, status] = await Promise.all([
      ctx.market.quote(asset, DISPLAY_QUOTE_MAX_AGE_MS),
      ctx.market.tradingStatus(asset),
    ]);
    await interaction.editReply({ embeds: [quoteEmbed(asset, quote, status)] });
  },
};

function createOpenCommand(side: PositionSide): BotCommand {
  return {
    data: new SlashCommandBuilder()
      .setName(side)
      .setDescription(
        side === "long"
          ? "Wette mit Hebel auf steigende Kurse"
          : "Wette mit Hebel auf fallende Kurse",
      )
      .addStringOption((option) =>
        option
          .setName(ASSET_OPTION)
          .setDescription(ASSET_HINT)
          .setRequired(true)
          .setMaxLength(20),
      )
      .addIntegerOption((option) =>
        option
          .setName(STAKE_OPTION)
          .setDescription("Wie viel Geld setzt du ein?")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(MAX_STAKE),
      )
      .addIntegerOption((option) =>
        option
          .setName(LEVERAGE_OPTION)
          .setDescription(
            `Hebel von ${MIN_LEVERAGE} bis ${MAX_LEVERAGE} (Standard: 1)`,
          )
          .setMinValue(MIN_LEVERAGE)
          .setMaxValue(MAX_LEVERAGE),
      ),

    async execute(interaction, ctx) {
      const margin = interaction.options.getInteger(STAKE_OPTION, true);
      const leverage =
        interaction.options.getInteger(LEVERAGE_OPTION) ?? MIN_LEVERAGE;
      assertValidOrder(margin, leverage);

      await interaction.deferReply();
      const asset = await ctx.market.resolve(
        interaction.options.getString(ASSET_OPTION, true),
      );
      await assertTradable(ctx, asset);

      const quote = await ctx.market.quote(asset, TRADE_QUOTE_MAX_AGE_MS);
      if (quote.price < MIN_ENTRY_PRICE) {
        throw new GameRuleError(
          `Werte unter ${currency(MIN_ENTRY_PRICE)} kann man nicht handeln.`,
        );
      }

      const fee = tradingFee(margin, leverage);
      const result = await ctx.positions.open({
        userId: interaction.user.id,
        symbol: asset.symbol,
        kind: asset.kind,
        name: asset.name,
        side,
        leverage,
        margin,
        fee,
        entryPrice: quote.price,
        now: ctx.clock.now(),
        maxOpen: MAX_OPEN_POSITIONS,
      });

      if (!result.ok) {
        throw new GameRuleError(
          result.reason === "too_many_positions"
            ? `Du kannst höchstens ${MAX_OPEN_POSITIONS} Positionen gleichzeitig offen haben.`
            : `Du brauchst ${currency(margin + fee)} (Einsatz plus ${currency(fee)} Gebühr).`,
        );
      }

      await interaction.editReply({
        embeds: [positionOpenedEmbed(result.position, fee, result.balance)],
      });
    },
  };
}

export const longCommand = createOpenCommand("long");
export const shortCommand = createOpenCommand("short");

export const closeCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("close")
    .setDescription("Schließt eine offene Position")
    .addIntegerOption((option) =>
      option
        .setName(POSITION_OPTION)
        .setDescription("Nummer der Position (siehe /portfolio)")
        .setRequired(true)
        .setMinValue(1),
    ),

  async execute(interaction, ctx) {
    const positionId = interaction.options.getInteger(POSITION_OPTION, true);
    await interaction.deferReply();

    const open = await ctx.positions.listOpen(interaction.user.id);
    const position = open.find((p) => p.id === positionId);
    if (!position) {
      throw new GameRuleError(
        `Du hast keine offene Position #${positionId}. Schau in /portfolio nach.`,
      );
    }

    await assertTradable(ctx, position);
    const quote = await ctx.market.quote(position, TRADE_QUOTE_MAX_AGE_MS);

    const result = await ctx.positions.close({
      userId: interaction.user.id,
      positionId,
      price: quote.price,
      now: ctx.clock.now(),
    });
    if (!result.ok) {
      // Liquidated or closed by another command in the meantime.
      throw new GameRuleError(`Position #${positionId} ist nicht mehr offen.`);
    }

    await interaction.editReply({
      embeds: [
        positionClosedEmbed(
          result.position,
          result.settlement,
          quote.price,
          result.balance,
        ),
      ],
    });
  },
};

export const portfolioCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("portfolio")
    .setDescription("Zeigt deine offenen Positionen"),

  async execute(interaction, ctx) {
    await interaction.deferReply();
    const userId = interaction.user.id;
    const [open, recent] = await Promise.all([
      ctx.positions.listOpen(userId),
      ctx.positions.recentClosed(userId, 3),
    ]);

    // One price per symbol, even with several positions on it.
    const prices = new Map<string, number | null>();
    for (const position of open) {
      if (prices.has(position.symbol)) continue;
      try {
        const quote = await ctx.market.quote(
          position,
          DISPLAY_QUOTE_MAX_AGE_MS,
        );
        prices.set(position.symbol, quote.price);
      } catch {
        prices.set(position.symbol, null);
      }
    }

    const priced: PricedPosition[] = open.map((position) => ({
      position,
      price: prices.get(position.symbol) ?? null,
    }));

    await interaction.editReply({
      embeds: [portfolioEmbed(interaction.user.displayName, priced, recent)],
    });
  },
};
