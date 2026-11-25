import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins/two-factor";
import { requireDb } from "@/db";
import * as schema from "@/db/schema";
import { sendTransactional } from "@/lib/email";

let authPromise: ReturnType<typeof buildAuth> | null = null;

function buildAuth() {
  return requireDb().then((db) =>
    betterAuth({
      database: drizzleAdapter(db, {
        provider: "pg",
        schema,
      }),
      secret: process.env.BETTER_AUTH_SECRET,
      baseURL: process.env.BETTER_AUTH_URL,
      emailAndPassword: {
        enabled: true,
        sendResetPassword: async ({ user, url }) => {
          await sendTransactional({
            to: user.email,
            template: "password_reset",
            subject: "ŽA-JO — resetovanje lozinke",
            body: `Otvorite link da postavite novu lozinku: ${url}`,
            relatedId: user.id,
          });
        },
      },
      session: {
        cookieCache: { enabled: true, maxAge: 5 * 60 },
      },
      user: {
        additionalFields: {
          role: { type: "string", required: false, defaultValue: "customer", input: false },
        },
      },
      rateLimit: {
        storage: "database",
        window: 60,
        max: 30,
      },
      plugins: [twoFactor(), nextCookies()],
    }),
  );
}

export async function getAuth() {
  authPromise ??= buildAuth();
  return authPromise;
}
