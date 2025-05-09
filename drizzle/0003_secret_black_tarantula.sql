ALTER TABLE "user" ALTER COLUMN "credits_balance" SET DEFAULT 5;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_pro_member" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "pro_membership_expires_at" timestamp;