CREATE TYPE "public"."strain_type" AS ENUM('landrace', 'sativa', 'hybrid', 'indica');--> statement-breakpoint
CREATE TABLE "personal_strain" (
	"strain_key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"strain_type" "strain_type" NOT NULL,
	"parent_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
