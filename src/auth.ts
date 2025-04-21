import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { config } from "./config";
import * as schema from "./db/schema";
 
const auth = betterAuth({
  trustedOrigins: ["com.leapai.toonify://", "host.exp.Exponent"],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.user,
      account: schema.account,
      session: schema.session,
      verification: schema.verification,
    }
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    apple: { 
        clientId: config.apple.appBundleIdentifier as string,
        clientSecret: config.getAppleClientSecret() as string,
        // Optional
        appBundleIdentifier: config.apple.appBundleIdentifier as string,
        redirectUri: `/api/auth/callback/apple`
    },
    google: {
      clientId: config.google.clientId as string,
      clientSecret: config.google.clientSecret as string,
      redirectUri: `/api/auth/callback/google`
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