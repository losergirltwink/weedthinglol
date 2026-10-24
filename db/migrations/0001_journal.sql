CREATE TYPE "public"."consumption_method" AS ENUM('flower', 'vape', 'concentrate', 'edible', 'tincture', 'other');--> statement-breakpoint
CREATE TYPE "public"."time_of_day" AS ENUM('morning', 'afternoon', 'evening', 'night');--> statement-breakpoint
CREATE TYPE "public"."wishlist_source" AS ENUM('manual', 'graph', 'rec');--> statement-breakpoint
CREATE TABLE "journal_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"strain_key" text NOT NULL,
	"rating_halves" smallint NOT NULL,
	"notes" text,
	"effects_felt" text[] DEFAULT '{}'::text[] NOT NULL,
	"negatives_felt" text[] DEFAULT '{}'::text[] NOT NULL,
	"flavors" text[] DEFAULT '{}'::text[] NOT NULL,
	"terpenes" text[] DEFAULT '{}'::text[] NOT NULL,
	"method" "consumption_method",
	"dose" text,
	"time_of_day" time_of_day,
	"brand" text,
	"batch" text,
	"would_buy_again" boolean,
	"consumed_on" date NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_entry_rating_range" CHECK ("journal_entry"."rating_halves" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "wishlist_item" (
	"strain_key" text PRIMARY KEY NOT NULL,
	"source" "wishlist_source" DEFAULT 'manual' NOT NULL,
	"note" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "journal_entry_strain_key_idx" ON "journal_entry" USING btree ("strain_key");--> statement-breakpoint
CREATE INDEX "journal_entry_consumed_on_idx" ON "journal_entry" USING btree ("consumed_on");