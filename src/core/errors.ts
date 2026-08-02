/**
 * An error whose message is safe and intended to be shown to the user.
 * Anything else is logged with a stack trace and replaced by a generic notice.
 */
export class UserFacingError extends Error {
  readonly title: string;

  constructor(message: string, title = "Fehler") {
    super(message);
    this.name = "UserFacingError";
    this.title = title;
  }
}

/** Raised when a game rule rejects an action (bad bet, no active game, ...). */
export class GameRuleError extends UserFacingError {
  constructor(message: string) {
    super(message);
    this.name = "GameRuleError";
  }
}

export function isUserFacingError(error: unknown): error is UserFacingError {
  return error instanceof UserFacingError;
}

/** Narrows an `unknown` catch binding to something loggable. */
export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
