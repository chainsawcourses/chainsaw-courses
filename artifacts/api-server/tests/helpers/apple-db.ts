// Isolated integration-test database adapter, never imported by application code.
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../../../lib/db/src/schema/index";
const name = process.env.APPLE_TEST_SCHEMA;
if (!name || !/^apple_test_[a-z0-9_]+$/.test(name)) throw new Error("Isolated Apple test schema required");
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${name}` });
export const db = drizzle(pool, { schema });
export * from "../../../../lib/db/src/schema/index";
