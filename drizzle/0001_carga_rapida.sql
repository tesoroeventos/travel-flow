CREATE TABLE "ai_usage" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_usage_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "in_proposals" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "lodging_options" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "transport_options" ADD COLUMN "pair_id" uuid;--> statement-breakpoint
ALTER TABLE "transport_options" ADD COLUMN "in_proposals" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "transport_options" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;