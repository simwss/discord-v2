/** Single source of truth for the Realtime Database layout. */
export const paths = {
  users: () => "users",
  user: (userId: string) => `users/${userId}`,
  vote: (voteId: string) => `votes/${voteId}`,
  blackjackGame: (userId: string) => `blackjackGames/${userId}`,
  slotGame: (userId: string) => `slotGames/${userId}`,
} as const;
