import type { Logger } from "pino";
import type { Clock } from "../core/clock.js";
import type { Rng } from "../core/random.js";
import type { UserRepository } from "../infra/db/user-repository.js";
import type { VoteRepository } from "../infra/db/vote-repository.js";
import type { BlackjackRepository } from "../infra/db/blackjack-repository.js";
import type { TransferService } from "../services/transfer-service.js";

/**
 * Everything a handler is allowed to reach for. Passing this explicitly keeps
 * handlers free of module-level singletons, so each one can be exercised with
 * fakes.
 */
export interface BotContext {
  readonly users: UserRepository;
  readonly votes: VoteRepository;
  readonly blackjack: BlackjackRepository;
  readonly transfers: TransferService;
  readonly rng: Rng;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly bannedUserIds: ReadonlySet<string>;
}
