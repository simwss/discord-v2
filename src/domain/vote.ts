import { z } from "zod";

export const voteSchema = z.object({
  id: z.string(),
  description: z.string(),
  authorId: z.string().default(""),
  /** Discord user ID -> true for yes, false for no. */
  users: z.record(z.string(), z.boolean()).catch({}).default({}),
  closed: z.boolean().catch(false).default(false),
  createdAt: z.number().catch(0).default(0),
});

export type Vote = z.infer<typeof voteSchema>;

export type VoteChoice = "yes" | "no";

export interface VoteTally {
  readonly accepted: readonly string[];
  readonly declined: readonly string[];
}

export function tally(users: Readonly<Record<string, boolean>>): VoteTally {
  const accepted: string[] = [];
  const declined: string[] = [];

  for (const [userId, choice] of Object.entries(users)) {
    (choice ? accepted : declined).push(userId);
  }

  return { accepted, declined };
}

export type VoteOutcome = "passed" | "rejected";

/** A tie is a rejection: a proposal needs a strict majority to pass. */
export function outcomeOf(tally: VoteTally): VoteOutcome {
  return tally.accepted.length > tally.declined.length ? "passed" : "rejected";
}
