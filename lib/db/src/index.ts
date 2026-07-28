import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Without this handler, a background connection error from the pool emits an
// unhandled 'error' event and crashes the Node.js process immediately.
pool.on("error", (err) => {
  console.error("pg pool background error (non-fatal):", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
