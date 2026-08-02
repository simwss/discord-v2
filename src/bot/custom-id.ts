/**
 * Component custom IDs are the only channel through which a button carries
 * state back to the bot. v1 built them with template strings and took them
 * apart with ad-hoc `split("_")` calls, which silently mis-parsed any segment
 * containing an underscore. Encoding and decoding live here together so the
 * two can never disagree.
 */

export const CUSTOM_ID_SEPARATOR = ":";

/** Discord rejects custom IDs longer than this. */
export const MAX_CUSTOM_ID_LENGTH = 100;

export interface CustomId {
  readonly namespace: string;
  readonly action: string;
  readonly args: readonly string[];
}

export function encodeCustomId(
  namespace: string,
  action: string,
  ...args: readonly (string | number)[]
): string {
  const parts = [namespace, action, ...args.map(String)];

  for (const part of parts) {
    if (part.includes(CUSTOM_ID_SEPARATOR)) {
      throw new Error(
        `Custom ID segment "${part}" must not contain "${CUSTOM_ID_SEPARATOR}"`,
      );
    }
  }

  const id = parts.join(CUSTOM_ID_SEPARATOR);
  if (id.length > MAX_CUSTOM_ID_LENGTH) {
    throw new Error(`Custom ID "${id}" exceeds ${MAX_CUSTOM_ID_LENGTH} chars`);
  }
  return id;
}

export function decodeCustomId(raw: string): CustomId | null {
  const [namespace, action, ...args] = raw.split(CUSTOM_ID_SEPARATOR);
  if (!namespace || !action) return null;
  return { namespace, action, args };
}
