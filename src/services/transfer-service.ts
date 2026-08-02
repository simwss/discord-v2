import type { Logger } from "pino";
import { GameRuleError } from "../core/errors.js";
import { assertValidTransfer } from "../domain/economy.js";
import type { UserRepository } from "../infra/firebase/user-repository.js";

export interface TransferResult {
  readonly amount: number;
  readonly senderBalance: number;
}

/**
 * Moves money between two users.
 *
 * The Realtime Database can only run a transaction against a single subtree,
 * and locking the whole `users` node for every transfer would serialise all
 * balance writes in the bot. Instead the debit and credit are separate atomic
 * steps with a compensating refund if the credit fails — the sender is never
 * left short, and the guarded debit means funds cannot be conjured.
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

    const receiver = await this.users.find(receiverId);
    if (!receiver) {
      throw new GameRuleError("Der Empfänger ist nicht registriert.");
    }

    const sender = await this.users.ensure(senderId);
    assertValidTransfer(amount, sender.balance);

    const debit = await this.users.adjustBalance(senderId, -amount);
    if (!debit.ok) {
      throw new GameRuleError("Du hast nicht genug Geld.");
    }

    try {
      await this.users.credit(receiverId, amount);
    } catch (error) {
      this.logger.error(
        { err: error, senderId, receiverId, amount },
        "credit failed, refunding sender",
      );
      await this.users.credit(senderId, amount);
      throw new GameRuleError(
        "Die Überweisung ist fehlgeschlagen. Dein Geld wurde zurückgebucht.",
      );
    }

    return { amount, senderBalance: debit.balance };
  }
}
