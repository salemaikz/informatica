// Минимальные типы для sql.js (пакет без собственных типов): только то, чем пользуется практикум.
declare module "sql.js" {
  export type SqlValue = number | string | Uint8Array | null;

  export interface Statement {
    step(): boolean;
    get(): SqlValue[];
    getColumnNames(): string[];
    free(): boolean;
  }

  export interface Database {
    run(sql: string): Database;
    exec(sql: string): { columns: string[]; values: SqlValue[][] }[];
    iterateStatements(sql: string): Iterable<Statement>;
    getRowsModified(): number;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: new () => Database;
  }

  export interface SqlJsConfig {
    locateFile?: (file: string) => string;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
