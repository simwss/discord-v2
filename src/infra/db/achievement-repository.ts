import type { Db } from "./pool.js";

export class AchievementRepository {
  constructor(private readonly pool: Db) {}

  /** Ids of every achievement the user has unlocked, oldest first. */
  async list(userId: string): Promise<string[]> {
    const { rows } = await this.pool.query<{ achievement: string }>(
      `SELECT achievement FROM user_achievements
       WHERE user_id = $1
       ORDER BY unlocked_at, achievement`,
      [userId],
    );
    return rows.map((row) => row.achievement);
  }

  /**
   * Records the given achievements and returns only the ones that were new.
   * Already unlocked ids are skipped by the primary key, so two commands
   * finishing at once cannot announce the same achievement twice.
   */
  async grant(userId: string, ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const { rows } = await this.pool.query<{ achievement: string }>(
      `INSERT INTO user_achievements (user_id, achievement)
       SELECT $1, unnest($2::text[])
       ON CONFLICT DO NOTHING
       RETURNING achievement`,
      [userId, ids],
    );
    return rows.map((row) => row.achievement);
  }
}
