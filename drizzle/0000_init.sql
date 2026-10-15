CREATE TYPE "public"."booking_status" AS ENUM('selected', 'booking_pending', 'booking_confirmed');--> statement-breakpoint
CREATE TYPE "public"."certainty" AS ENUM('estimated', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."cost_category" AS ENUM('transport_outbound', 'transport_return', 'transport_internal', 'lodging', 'food', 'activities', 'insurance', 'documents_visas', 'baggage', 'parking_tolls', 'shopping_personal', 'contingency', 'other');--> statement-breakpoint
CREATE TYPE "public"."cost_type" AS ENUM('fixed', 'variable', 'optional');--> statement-breakpoint
CREATE TYPE "public"."cost_unit" AS ENUM('total', 'per_person', 'per_night', 'per_person_night', 'per_day');--> statement-breakpoint
CREATE TYPE "public"."decision_criterion" AS ENUM('price', 'travel_time', 'transfers', 'location', 'flexibility', 'comfort', 'lodging_quality', 'experience');--> statement-breakpoint
CREATE TYPE "public"."event_action" AS ENUM('create', 'update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."leg_kind" AS ENUM('outbound', 'return', 'internal');--> statement-breakpoint
CREATE TYPE "public"."lodging_kind" AS ENUM('hotel', 'apartment', 'hostel', 'rental_house', 'cabin', 'camping', 'other');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "public"."owner_type" AS ENUM('transport_option', 'lodging_option', 'activity', 'scenario');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('payment_pending', 'paid');--> statement-breakpoint
CREATE TYPE "public"."rating_criterion" AS ENUM('comfort', 'lodging_quality', 'experience');--> statement-breakpoint
CREATE TYPE "public"."selection_owner_type" AS ENUM('transport_option', 'lodging_option', 'activity');--> statement-breakpoint
CREATE TYPE "public"."transport_mode" AS ENUM('flight', 'bus', 'train', 'own_car', 'rental_car', 'taxi_app', 'public_transport', 'ferry', 'private_transfer', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."traveler_kind" AS ENUM('adult', 'child', 'infant');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('planning', 'confirmed', 'in_progress', 'closed');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"date" date NOT NULL,
	"start_time" text,
	"duration_min" integer DEFAULT 60 NOT NULL,
	"fixed_time" boolean DEFAULT false NOT NULL,
	"requires_booking" boolean DEFAULT false NOT NULL,
	"access_mode" text,
	"travel_min_from_prev" integer,
	"distance_km" double precision,
	"url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"owner_type" "selection_owner_type" NOT NULL,
	"owner_id" uuid NOT NULL,
	"booking_status" "booking_status" DEFAULT 'selected' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'payment_pending' NOT NULL,
	"confirmation_code" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"owner_type" "owner_type" NOT NULL,
	"owner_id" uuid NOT NULL,
	"label" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text NOT NULL,
	"unit" "cost_unit" DEFAULT 'total' NOT NULL,
	"quantity" numeric(12, 4) DEFAULT '1' NOT NULL,
	"category" "cost_category" NOT NULL,
	"cost_type" "cost_type" DEFAULT 'fixed' NOT NULL,
	"refundable" boolean DEFAULT false NOT NULL,
	"source" text,
	"consulted_at" date,
	"includes_taxes" boolean,
	"certainty" "certainty" DEFAULT 'estimated' NOT NULL,
	"assumptions" jsonb,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_weights" (
	"trip_id" uuid NOT NULL,
	"criterion" "decision_criterion" NOT NULL,
	"weight" integer NOT NULL,
	CONSTRAINT "decision_weights_trip_id_criterion_pk" PRIMARY KEY("trip_id","criterion")
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"from_currency" text NOT NULL,
	"to_currency" text NOT NULL,
	"rate" numeric(20, 10) NOT NULL,
	"as_of" date NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"date" date NOT NULL,
	"category" "cost_category" NOT NULL,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text NOT NULL,
	"payment_method" text,
	"paid_by_traveler_id" uuid,
	"participant_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payment_status" "payment_status" DEFAULT 'paid' NOT NULL,
	"receipt_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itinerary_overrides" (
	"trip_id" uuid NOT NULL,
	"entry_key" text NOT NULL,
	"position" integer,
	"note" text,
	CONSTRAINT "itinerary_overrides_trip_id_entry_key_pk" PRIMARY KEY("trip_id","entry_key")
);
--> statement-breakpoint
CREATE TABLE "lodging_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"stop_id" uuid,
	"kind" "lodging_kind" DEFAULT 'hotel' NOT NULL,
	"name" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"check_in_at" timestamp with time zone NOT NULL,
	"check_out_at" timestamp with time zone NOT NULL,
	"tz" text NOT NULL,
	"rating" numeric(3, 1),
	"review_count" integer,
	"amenities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capacity" integer,
	"rooms" integer,
	"beds" integer,
	"distance_center_km" double precision,
	"lat" double precision,
	"lng" double precision,
	"cancellation_policy" text,
	"flexible_cancellation" boolean DEFAULT false NOT NULL,
	"url" text,
	"quality_rating" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_item_toggles" (
	"scenario_id" uuid NOT NULL,
	"cost_item_id" uuid NOT NULL,
	"included" boolean NOT NULL,
	CONSTRAINT "scenario_item_toggles_scenario_id_cost_item_id_pk" PRIMARY KEY("scenario_id","cost_item_id")
);
--> statement-breakpoint
CREATE TABLE "scenario_ratings" (
	"scenario_id" uuid NOT NULL,
	"criterion" "rating_criterion" NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "scenario_ratings_scenario_id_criterion_pk" PRIMARY KEY("scenario_id","criterion")
);
--> statement-breakpoint
CREATE TABLE "scenario_selections" (
	"scenario_id" uuid NOT NULL,
	"owner_type" "selection_owner_type" NOT NULL,
	"owner_id" uuid NOT NULL,
	CONSTRAINT "scenario_selections_scenario_id_owner_type_owner_id_pk" PRIMARY KEY("scenario_id","owner_type","owner_id")
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	"arrive_date" date,
	"leave_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transport_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"leg" "leg_kind" NOT NULL,
	"mode" "transport_mode" NOT NULL,
	"international" boolean DEFAULT false NOT NULL,
	"provider" text DEFAULT '' NOT NULL,
	"service_number" text,
	"from_label" text NOT NULL,
	"to_label" text NOT NULL,
	"segments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"baggage_notes" text,
	"cancellation_policy" text,
	"flexible_cancellation" boolean DEFAULT false NOT NULL,
	"distance_km" double precision,
	"url" text,
	"comfort_rating" integer,
	"transfer_to_min" integer,
	"transfer_from_min" integer,
	"advance_min" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "travelers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "traveler_kind" DEFAULT 'adult' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"user_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" "event_action" NOT NULL,
	"before" jsonb,
	"after" jsonb
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"origin_label" text NOT NULL,
	"home_label" text,
	"destination_label" text NOT NULL,
	"alternative_destinations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"start_tz" text NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"end_tz" text NOT NULL,
	"flexibility_days" integer DEFAULT 0 NOT NULL,
	"rooms" integer DEFAULT 1 NOT NULL,
	"trip_type" text DEFAULT 'vacaciones' NOT NULL,
	"base_currency" text NOT NULL,
	"budget_cents" bigint NOT NULL,
	"contingency_pct" numeric(6, 2) DEFAULT '10' NOT NULL,
	"contingency_categories" jsonb DEFAULT '["food","activities","transport_internal"]'::jsonb NOT NULL,
	"tie_threshold_pct" numeric(6, 2) DEFAULT '5' NOT NULL,
	"stale_days" integer DEFAULT 14 NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"constraints" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "trip_status" DEFAULT 'planning' NOT NULL,
	"chosen_scenario_id" uuid,
	"reference_scenario_id" uuid,
	"is_demo" boolean DEFAULT false NOT NULL,
	"public_share_token" text,
	"itinerary_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'personal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_items" ADD CONSTRAINT "cost_items_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_weights" ADD CONSTRAINT "decision_weights_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_by_traveler_id_travelers_id_fk" FOREIGN KEY ("paid_by_traveler_id") REFERENCES "public"."travelers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_overrides" ADD CONSTRAINT "itinerary_overrides_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lodging_options" ADD CONSTRAINT "lodging_options_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lodging_options" ADD CONSTRAINT "lodging_options_stop_id_stops_id_fk" FOREIGN KEY ("stop_id") REFERENCES "public"."stops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_item_toggles" ADD CONSTRAINT "scenario_item_toggles_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_item_toggles" ADD CONSTRAINT "scenario_item_toggles_cost_item_id_cost_items_id_fk" FOREIGN KEY ("cost_item_id") REFERENCES "public"."cost_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_ratings" ADD CONSTRAINT "scenario_ratings_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_selections" ADD CONSTRAINT "scenario_selections_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stops" ADD CONSTRAINT "stops_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_options" ADD CONSTRAINT "transport_options_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travelers" ADD CONSTRAINT "travelers_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_owner_idx" ON "bookings" USING btree ("trip_id","owner_type","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trips_share_token_idx" ON "trips" USING btree ("public_share_token");