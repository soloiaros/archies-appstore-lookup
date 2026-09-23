declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(
      path: string,
    );

    exec(
      sql: string,
    ): void;

    prepare(
      sql: string,
    ): StatementSync;

    close(): void;
  }

  export class StatementSync {
    run(
      ...params: Array<
        string | number | null
      >
    ): unknown;

    get(
      ...params: Array<
        string | number | null
      >
    ): unknown;

    all(
      ...params: Array<
        string | number | null
      >
    ): unknown[];
  }
}
