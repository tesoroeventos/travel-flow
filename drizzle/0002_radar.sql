CREATE TABLE "price_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radar_checks" (
	"trip_id" uuid NOT NULL,
	"site_id" text NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	CONSTRAINT "radar_checks_trip_id_site_id_pk" PRIMARY KEY("trip_id","site_id")
);
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "origin_iata" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "destination_iata" text;--> statement-breakpoint
ALTER TABLE "radar_checks" ADD CONSTRAINT "radar_checks_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;