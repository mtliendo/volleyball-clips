CREATE TYPE "public"."clip_ai_status" AS ENUM('pending', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "clip_ai_tags" (
	"clip_id" uuid PRIMARY KEY NOT NULL,
	"status" "clip_ai_status" DEFAULT 'pending' NOT NULL,
	"summary" text,
	"actions" jsonb,
	"rally_count" integer,
	"longest_rally_s" real,
	"highlight_score" integer,
	"tags" jsonb,
	"mapped_tag_slugs" jsonb,
	"model" text,
	"error" text,
	"tagged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "tags_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clip_ai_tags" ADD CONSTRAINT "clip_ai_tags_clip_id_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clip_ai_tags_status" ON "clip_ai_tags" USING btree ("status");