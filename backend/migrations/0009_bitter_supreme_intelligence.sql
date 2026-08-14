CREATE TABLE "feedbacks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "road_contracts_contractor_idx" ON "road_contracts" USING btree ("contractor_id");