export type SqlValue = string | number | null;

export type SiteSql = {
  exec(sql: string): Promise<void>;

  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;

  get<T>(sql: string, params?: SqlValue[]): Promise<T | undefined>;

  run(sql: string, params?: SqlValue[]): Promise<number>;
};
