import type { ComponentHandler } from "./types.js";
import { blackjackComponent } from "./blackjack.js";
import { leaderboardComponent } from "./leaderboard.js";
import { rouletteComponent } from "./roulette.js";
import { voteComponent } from "./vote.js";

export const componentHandlers: readonly ComponentHandler[] = [
  blackjackComponent,
  leaderboardComponent,
  rouletteComponent,
  voteComponent,
];

export const componentsByNamespace: ReadonlyMap<string, ComponentHandler> =
  new Map(componentHandlers.map((handler) => [handler.namespace, handler]));

export type { ComponentHandler } from "./types.js";
