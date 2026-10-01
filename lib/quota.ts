export const GUEST_DAILY_LIMIT = 5;

export const USER_DAILY_LIMIT = 20;

export type QuotaSnapshot = {
  authenticated: boolean;

  limit: number;

  used: number;

  remaining: number;

  resetsAt: number;
};
