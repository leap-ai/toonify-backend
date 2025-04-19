import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { config } from "./config";
import * as schema from "./db/schema";
 
const auth = betterAuth({
  trustedOrigins: ["toonify://"],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.users,
      account: schema.accounts,
      session: schema.sessions,
      verification: schema.verification,
    }
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    apple: { 
        clientId: config.apple.clientId as string,
        clientSecret: config.apple.clientSecret as string,
        // Optional
        appBundleIdentifier: process.env.APPLE_APP_BUNDLE_IDENTIFIER as string, 
    },
  },
  user: {
    additionalFields: {
      creditsBalance: {
        type: "number",
        default: 0,
      },
    },
  },
});

export default auth;