import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { config } from "dotenv";
import { eq } from "drizzle-orm";

const file = ".env.local";
let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";

function ensure(key: string, value: string) {
  if (new RegExp(`^${key}=`, "m").test(text)) {
    return text.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1] ?? value;
  }
  text += `${text.endsWith("\n") || text.length === 0 ? "" : "\n"}${key}=${value}\n`;
  return value;
}

ensure("BETTER_AUTH_SECRET", randomBytes(32).toString("base64url"));
ensure("BETTER_AUTH_URL", "http://localhost:3000");
ensure("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
const adminEmail = ensure("SEED_ADMIN_EMAIL", "vlasnik@zajo.local");
const adminPassword = ensure("SEED_ADMIN_PASSWORD", randomBytes(12).toString("base64url"));
fs.writeFileSync(file, text.endsWith("\n") ? text : `${text}\n`);
config({ path: file, override: true });

async function main() {
const { drizzle } = await import("drizzle-orm/pglite");
const { migrate } = await import("drizzle-orm/pglite/migrator");
const { PGlite } = await import("@electric-sql/pglite");
const schema = await import("../src/db/schema");
const { seedCatalog } = await import("../src/server/seed");
const { betterAuth } = await import("better-auth");
const { drizzleAdapter } = await import("better-auth/adapters/drizzle");

async function open() {
  if (process.env.DATABASE_URL) {
    const { drizzle: drizzleNeon } = await import("drizzle-orm/neon-serverless");
    const { migrate: migrateNeon } = await import("drizzle-orm/neon-serverless/migrator");
    const { Pool, neonConfig } = await import("@neondatabase/serverless");
    const ws = (await import("ws")).default;
    neonConfig.webSocketConstructor = ws;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzleNeon(pool, { schema });
    await migrateNeon(db, { migrationsFolder: "drizzle" });
    return db;
  }
  fs.mkdirSync(".data", { recursive: true });
  const client = new PGlite(".data/pglite");
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

const db = await open();
const seeded = await seedCatalog(db);
const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true },
});

const existing = await db.select().from(schema.user).where(eq(schema.user.email, adminEmail));
if (existing.length === 0) {
  await auth.api.signUpEmail({
    body: { email: adminEmail, password: adminPassword, name: "Vlasnik" },
  });
}
await db.update(schema.user).set({ role: "owner", emailVerified: true }).where(eq(schema.user.email, adminEmail));
console.log(JSON.stringify({ seeded, adminEmail, database: process.env.DATABASE_URL ? "neon" : "local-pglite" }));
process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
