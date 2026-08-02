export const COLORS = {
  SUCCESS: 0x00ff00,
  ERROR: 0xff0000,
  WARNING: 0xffa500,
  INFO: 0x0099ff,
  NEUTRAL: 0x00ae86,
  SPINNING: 0xffff00,
} as const;

export type Color = (typeof COLORS)[keyof typeof COLORS];
