/* Apply database migrations. Production: DATABASE_URL=... npm run db:migrate. Locally it migrates .data/pglite. */
import { db, migrate } from "../src/lib/db";

const d = await db();
const applied = await migrate(d);
console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Nothing to apply; the database is up to date.");
process.exit(0);
