CREATE TYPE "public"."download_quality" AS ENUM('playback', 'original');--> statement-breakpoint
CREATE TYPE "public"."pin_label" AS ENUM('longest_rally', 'best_dig', 'super_spike');--> statement-breakpoint
CREATE TABLE "download_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"clip_id" uuid NOT NULL,
	"quality" "download_quality" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"clip_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_clip_id_pk" PRIMARY KEY("user_id","clip_id")
);
--> statement-breakpoint
CREATE TABLE "session_pins" (
	"game_id" uuid NOT NULL,
	"clip_id" uuid NOT NULL,
	"label" "pin_label",
	"position" integer NOT NULL,
	CONSTRAINT "session_pins_game_id_clip_id_pk" PRIMARY KEY("game_id","clip_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth0_sub" text NOT NULL,
	"email" text,
	"name" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"subscription_status" text,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth0_sub_unique" UNIQUE("auth0_sub"),
	CONSTRAINT "users_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "watch_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clip_id" uuid NOT NULL,
	"visitor_id" text NOT NULL,
	"ip_hash" text NOT NULL,
	"watched_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "download_events" ADD CONSTRAINT "download_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_events" ADD CONSTRAINT "download_events_clip_id_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_clip_id_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_pins" ADD CONSTRAINT "session_pins_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_pins" ADD CONSTRAINT "session_pins_clip_id_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_events" ADD CONSTRAINT "watch_events_clip_id_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "download_events_user_created" ON "download_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "session_pins_game_position" ON "session_pins" USING btree ("game_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "session_pins_game_label" ON "session_pins" USING btree ("game_id","label");--> statement-breakpoint
CREATE UNIQUE INDEX "watch_events_visitor_clip_day" ON "watch_events" USING btree ("visitor_id","clip_id","watched_on");--> statement-breakpoint
CREATE INDEX "watch_events_ip_day" ON "watch_events" USING btree ("ip_hash","watched_on");--> statement-breakpoint
CREATE INDEX "watch_events_visitor_day" ON "watch_events" USING btree ("visitor_id","watched_on");