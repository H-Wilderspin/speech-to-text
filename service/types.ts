// The small D1 surface used by this service; also implemented by the SQL test fixture.
export interface Statement {
  bind(...values: (string | number | null)[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown[]>;
}
export interface Env {
  DB: Database;
  APP_ORIGIN: string;
  ADMIN_TOKEN: string;
  GITHUB_APP_ID: string;
  GITHUB_INSTALLATION_ID: string;
  GITHUB_PRIVATE_KEY: string;
  SYNC_PAUSED?: string;
  DAILY_REQUEST_LIMIT?: string;
}
export class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly retryAfter?: number) { super(message); }
}
export const paused = (seconds = 3600) => new HttpError(503,
  'Family syncing is resting. You can keep editing on this device; changes will be shared when syncing returns.', seconds);
