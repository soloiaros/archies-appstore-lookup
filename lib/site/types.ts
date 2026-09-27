export type SlotKind = "house" | "sale";

export type SlotStatus = "open" | "held" | "taken";

export type SlotView = {
  id: number;

  kind: SlotKind;

  status: SlotStatus;

  name: string | null;

  url: string | null;

  blurb: string | null;

  logoUrl: string | null;

  color: string | null;

  paidUntil: number | null;
};

export type SqlValue = string | number | null;

export type SiteSql = {
  exec(sql: string): Promise<void>;

  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;

  get<T>(sql: string, params?: SqlValue[]): Promise<T | undefined>;

  run(sql: string, params?: SqlValue[]): Promise<number>;
};

export type SlotRow = {
  id: number;

  kind: string;

  status: string;

  name: string | null;

  url: string | null;

  blurb: string | null;

  logoUrl: string | null;

  color: string | null;

  holdUntil: number | null;

  paidUntil: number | null;

  checkoutId: string | null;
};
