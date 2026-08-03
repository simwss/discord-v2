import type { Logger } from "pino";
import { GameRuleError } from "../core/errors.js";
import { assertValidTransfer } from "../domain/economy.js";
import type { UserRepository } from "../infra/db/user-repository.js";

export interface TransferResult {
  readonly amount: number;
  readonly senderBalance: number;
}

/**
 * Moves money between two users.
 *
 * The atomicity lives in the repository, which debits and credits inside one
 * database transaction. This layer owns the rules a player sees: no paying
 * yourself, no unregistered recipient, and the stake limits in `economy`.
 */
export class TransferService {
  constructor(
    private readonly users: UserRepository,
    private readonly logger: Logger,
  ) {}

  async transfer(
    senderId: string,
    receiverId: string,
    amount: number,
  ): Promise<TransferResult> {
    if (senderId === receiverId) {
      throw new GameRuleError("Du kannst dir nicht selbst Geld schicken.");
    }

    const sender = await this.users.ensure(senderId);
    assertValidTransfer(amount, sender.balance);

    const result = await this.users.transfer(senderId, receiverId, amount);

    if (!result.ok) {
      if (result.reason === "receiver_unknown") {
        throw new GameRuleError("Der Empfänger ist nicht registriert.");
      }
      // The balance was re-read under the row lock, so this fires when a
      // concurrent command spent the money between the check above and here.
      this.logger.debug(
        { senderId, receiverId, amount },
        "transfer rejected for insufficient funds",
      );
      throw new GameRuleError("Du hast nicht genug Geld.");
    }

    return { amount, senderBalance: result.senderBalance };
  }
}
