import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { config } from "./config";
import * as schema from "./db/schema";
 
const auth = betterAuth({
  baseURL: config.betterAuth.baseURL,
  secret: config.betterAuth.secret,
  trustedOrigins: ["com.leapai.toonify://", "host.exp.Exponent", "exp+toonify://", "toonify://"],
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
      clientId: config.apple.clientId as string,
      clientSecret: config.getAppleClientSecret() as string,
      // Optional
      appBundleIdentifier: config.apple.appBundleIdentifier as string,
    },
    google: {
      clientId: config.google.clientId as string,
      clientSecret: config.google.clientSecret as string,
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["apple", "google"],
    }
  },
  user: {
    additionalFields: {
      creditsBalance: {
        type: "number",
        default: 10,
      },
      image: {
        type: "string",
        nullable: true
      }
    },
    deleteUser: {
      enabled: true,
    }
  },
});

export default auth;