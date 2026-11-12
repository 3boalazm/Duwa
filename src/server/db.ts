/**
 * Database access.
 *
 *  - Production: set DATABASE_URL to a Postgres connection string
 *    (e.g. the pooled URL of a Neon database — Vercel's Neon integration
 *    injects it automatically).
 *  - Local development / preview: no configuration needed. An embedded
 *    Postgres (PGlite) stores its files in ./.data so results survive restarts.
 *
 * Both speak the same SQL, so there is a single code path to maintain.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { SCHEMA_SQL, SCHEMA_VERSION } from "./schema";

export type Row = Record<string, unknown>;

export interface Queryable {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface Db extends Queryable {
  kind: "pglite" | "postgres";
  /** Runs `fn` inside a transaction; throwing rolls everything back. */
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  /** Several statements at once (schema setup). */
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const isPostgresUrl = (value: string | undefined): value is string => !!value && /^postgres(ql)?:\/\//.test(value);

/**
 * The hosted database, if one is configured: DATABASE_URL (or POSTGRES_URL).
 * Vercel's database integrations can add a prefix of the user's choosing
 * (e.g. STORAGE_DATABASE_URL), so a prefixed pooled URL is accepted too.
 */
export function databaseUrl(): string | undefined {
  const env = process.env;
  if (isPostgresUrl(env.DATABASE_URL)) return env.DATABASE_URL;
  if (isPostgresUrl(env.POSTGRES_URL)) return env.POSTGRES_URL;
  for (const suffix of ["_DATABASE_URL", "_POSTGRES_URL"]) {
    const key = Object.keys(env)
      .sort()
      .find((k) => k.endsWith(suffix) && isPostgresUrl(env[k]));
    if (key) return env[key];
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Embedded Postgres (PGlite)                                          */
/* ------------------------------------------------------------------ */
async function openPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const configured = process.env.DUWA_DATA_DIR;
  let target: string | undefined;
  if (configured === "memory://" || configured === "memory") {
    target = undefined; // in-memory (tests)
  } else {
    // Local files only (never used on Vercel) — keep the bundler from tracing the whole project.
    const dir = path.resolve(/*turbopackIgnore: true*/ configured || ".data/pglite");
    mkdirSync(path.dirname(dir), { recursive: true });
    target = dir;
  }
  const pg = target ? new PGlite(target) : new PGlite();
  await pg.waitReady;
  return {
    kind: "pglite",
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await pg.query<T>(sql, params);
      return res.rows;
    },
    tx(fn) {
      return pg.transaction((tx) =>
        fn({
          async query<T>(sql: string, params: unknown[] = []) {
            const res = await tx.query<T>(sql, params);
            return res.rows;
          },
        }),
      ) as Promise<Awaited<ReturnType<typeof fn>>>;
    },
    async exec(sql) {
      await pg.exec(sql);
    },
    async close() {
      await pg.close();
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Hosted Postgres (Neon or any other)                                 */
/* ------------------------------------------------------------------ */
async function openPostgres(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, {
    // Pooled connections (PgBouncer in transaction mode) cannot keep prepared statements.
    prepare: false,
    max: Number(process.env.DUWA_DB_POOL || 3),
    idle_timeout: 20,
    connect_timeout: 15,
    onnotice: () => {},
  });
  type Param = Parameters<typeof sql.unsafe>[1];
  return {
    kind: "postgres",
    async query<T>(text: string, params: unknown[] = []) {
      const rows = await sql.unsafe(text, params as Param);
      return rows as unknown as T[];
    },
    tx(fn) {
      return sql.begin((tx) =>
        fn({
          async query<T>(text: string, params: unknown[] = []) {
            const rows = await tx.unsafe(text, params as Param);
            return rows as unknown as T[];
          },
        }),
      ) as Promise<Awaited<ReturnType<typeof fn>>>;
    },
    async exec(text) {
      await sql.begin(async (tx) => {
        await tx.unsafe(text);
      });
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Singleton + schema bootstrap                                        */
/* ------------------------------------------------------------------ */
async function ensureSchema(db: Db): Promise<void> {
  try {
    const rows = await db.query<{ value: string }>("select value from duwa.meta where key = 'schema'");
    if (rows[0]?.value === SCHEMA_VERSION) return;
  } catch {
    // first run: the schema does not exist yet
  }
  await db.exec(SCHEMA_SQL);
}

async function open(): Promise<Db> {
  const url = databaseUrl();
  if (!url && process.env.VERCEL) {
    throw new ConfigError(
      "DATABASE_URL is not set. Add a Postgres database (for example Neon from the Vercel Storage tab) to this project.",
    );
  }
  const db = url ? await openPostgres(url) : await openPglite();
  await ensureSchema(db);
  return db;
}

// Stored on globalThis so dev hot-reloads and separate route bundles share one connection.
const store = globalThis as unknown as { __duwaDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!store.__duwaDb) {
    store.__duwaDb = open().catch((err) => {
      store.__duwaDb = undefined; // allow a retry on the next request
      throw err;
    });
  }
  return store.__duwaDb;
}

/** Tests only. */
export async function resetDbForTests(): Promise<void> {
  const current = store.__duwaDb;
  store.__duwaDb = undefined;
  if (current) await (await current).close().catch(() => {});
}
