import { EmbedBuilder, type APIEmbedField } from "discord.js";
import { COLORS } from "./colors.js";
import { bold, currency, relativeTime } from "./format.js";
import {
  liquidationPrice,
  profitAndLoss,
  type Position,
  type Settlement,
} from "../../domain/trading.js";
import type { Asset, Quote } from "../../infra/market/types.js";
import type { TradingStatus } from "../../services/market-service.js";
import type { ClosedPosition } from "../../infra/db/position-repository.js";

/** Market price, e.g. `354,88$` or `0,000012$` for tiny crypto prices. */
export function price(value: number): string {
  const digits = value >= 1 ? 2 : 6;
  return `${value.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  })}$`;
}

function percent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("de-DE", { maximumFractionDigits: 2 })}%`;
}

function signedCurrency(value: number): string {
  return value > 0 ? `+${currency(value)}` : currency(value);
}

function sideLabel(position: Pick<Position, "side" | "leverage">): string {
  return `${position.side === "long" ? "Long 📈" : "Short 📉"} ${position.leverage}x`;
}

function assetTitle(asset: Pick<Asset, "symbol" | "name">): string {
  return asset.name === asset.symbol
    ? asset.symbol
    : `${asset.name} (${asset.symbol})`;
}

export function quoteEmbed(
  asset: Asset,
  quote: Quote,
  status: TradingStatus,
): EmbedBuilder {
  const fields: APIEmbedField[] = [
    { name: "Kurs", value: bold(price(quote.price)), inline: true },
  ];
  if (quote.changePercent !== null) {
    fields.push({
      name: asset.kind === "crypto" ? "24 Std" : "Heute",
      value: percent(quote.changePercent),
      inline: true,
    });
  }
  fields.push({
    name: "Handel",
    value: status.open ? "Offen ✅" : status.reason,
  });

  return new EmbedBuilder()
    .setTitle(assetTitle(asset))
    .addFields(fields)
    .setColor(COLORS.INFO);
}

export function positionOpenedEmbed(
  position: Position,
  fee: number,
  balance: number,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`Position #${position.id} eröffnet`)
    .setDescription(
      `${sideLabel(position)} auf ${bold(assetTitle(position))} zu ${bold(price(position.entryPrice))}.`,
    )
    .addFields(
      { name: "Einsatz", value: currency(position.margin), inline: true },
      {
        name: "Positionsgröße",
        value: currency(position.margin * position.leverage),
        inline: true,
      },
      { name: "Gebühr", value: currency(fee), inline: true },
      {
        name: "Liquidation bei",
        value: price(liquidationPrice(position)),
        inline: true,
      },
      { name: "Kontostand", value: bold(currency(balance)), inline: true },
    )
    .setFooter({ text: `Schließen mit /close position:${position.id}` })
    .setColor(COLORS.SUCCESS);
}

export function positionClosedEmbed(
  position: Position,
  settlement: Settlement,
  exitPrice: number,
  balance: number,
): EmbedBuilder {
  const liquidated = settlement.outcome === "liquidated";
  const fields: APIEmbedField[] = [
    { name: "Einstieg", value: price(position.entryPrice), inline: true },
    { name: "Ausstieg", value: price(exitPrice), inline: true },
    {
      name: "Gewinn/Verlust",
      value: signedCurrency(settlement.pnl),
      inline: true,
    },
    { name: "Gebühr", value: currency(settlement.fee), inline: true },
    {
      name: "Ausgezahlt",
      value: bold(currency(settlement.payout)),
      inline: true,
    },
    { name: "Kontostand", value: bold(currency(balance)), inline: true },
  ];

  return new EmbedBuilder()
    .setTitle(
      liquidated
        ? `Position #${position.id} liquidiert 💥`
        : `Position #${position.id} geschlossen`,
    )
    .setDescription(`${sideLabel(position)} auf ${bold(assetTitle(position))}`)
    .addFields(fields)
    .setColor(
      settlement.payout > position.margin ? COLORS.SUCCESS : COLORS.ERROR,
    );
}

export interface PricedPosition {
  readonly position: Position;
  /** `null` when no price could be fetched right now. */
  readonly price: number | null;
}

export function portfolioEmbed(
  username: string,
  open: readonly PricedPosition[],
  recent: readonly ClosedPosition[],
): EmbedBuilder {
  const lines = open.map(({ position, price: current }) => {
    const head = `**#${position.id}** ${sideLabel(position)} ${bold(position.symbol)} · Einsatz ${currency(position.margin)}`;
    const entry = `Einstieg ${price(position.entryPrice)} · Liquidation ${price(liquidationPrice(position))}`;
    if (current === null)
      return `${head}\n${entry} · Kurs gerade nicht verfügbar`;
    const pnl = profitAndLoss(position, current);
    return `${head}\n${entry} · Jetzt ${price(current)} · ${bold(signedCurrency(pnl))}`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`Portfolio von ${username}`)
    .setDescription(
      lines.length > 0
        ? lines.join("\n\n")
        : "Keine offenen Positionen. Eröffne eine mit /long oder /short.",
    )
    .setColor(COLORS.INFO);

  if (recent.length > 0) {
    embed.addFields({
      name: "Zuletzt geschlossen",
      value: recent
        .map(
          (p) =>
            `#${p.id} ${sideLabel(p)} ${p.symbol}: ${
              p.status === "liquidated"
                ? "liquidiert 💥"
                : `${currency(p.payout)} ausgezahlt`
            } ${relativeTime(p.closedAt)}`,
        )
        .join("\n"),
    });
  }

  return embed;
}

export function liquidationNoticeEmbed(
  position: Position,
  exitPrice: number,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`Position #${position.id} liquidiert 💥`)
    .setDescription(
      `Dein ${sideLabel(position)} auf ${bold(assetTitle(position))} wurde bei ${bold(price(exitPrice))} liquidiert. Dein Einsatz von ${currency(position.margin)} ist weg.`,
    )
    .setColor(COLORS.ERROR);
}
