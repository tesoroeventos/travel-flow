CREATE TABLE "trip_searches" (
	"trip_id" uuid PRIMARY KEY NOT NULL,
	"params_key" text NOT NULL,
	"searched_at" timestamp with time zone NOT NULL,
	"flights_count" integer NOT NULL,
	"lodging_count" integer NOT NULL,
	"missing_airlines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "transport_options" ADD COLUMN "external_ref" text;--> statement-breakpoint
ALTER TABLE "trip_searches" ADD CONSTRAINT "trip_searches_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;