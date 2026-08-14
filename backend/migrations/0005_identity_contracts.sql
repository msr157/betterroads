CREATE TABLE "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "google_subject" text NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "date_of_birth" date,
  "gender" text,
  "gender_self_description" text,
  "city" text,
  "public_leaderboard" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "token_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "user_agent" text
);
--> statement-breakpoint
CREATE TABLE "administrators" (
  "id" serial PRIMARY KEY NOT NULL,
  "username" text NOT NULL,
  "email" text,
  "display_name" text NOT NULL,
  "password_hash" text NOT NULL,
  "preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "administrator_id" integer NOT NULL,
  "token_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "user_agent" text,
  "ip_address" text
);
--> statement-breakpoint
CREATE TABLE "contractors" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "registration_number" text,
  "contact_name" text,
  "email" text,
  "phone" text,
  "address" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "road_contracts" (
  "id" serial PRIMARY KEY NOT NULL,
  "contractor_id" integer NOT NULL,
  "road_name" text NOT NULL,
  "city" text NOT NULL,
  "ward" text,
  "tender_reference" text,
  "details" text,
  "start_date" date,
  "end_date" date,
  "budget" double precision,
  "status" text DEFAULT 'planned' NOT NULL,
  "guarantee_until" date,
  "notes" text,
  "geometry" jsonb,
  "published" boolean DEFAULT false NOT NULL,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "user_id" integer;
--> statement-breakpoint
ALTER TABLE "journeys" ADD COLUMN "user_id" integer;
--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_administrator_id_administrators_id_fk" FOREIGN KEY ("administrator_id") REFERENCES "public"."administrators"("id");
ALTER TABLE "road_contracts" ADD CONSTRAINT "road_contracts_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id");
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
CREATE UNIQUE INDEX "users_google_subject_idx" ON "users" ("google_subject");
CREATE UNIQUE INDEX "users_email_idx" ON "users" ("email");
CREATE UNIQUE INDEX "user_sessions_token_idx" ON "user_sessions" ("token_hash");
CREATE INDEX "user_sessions_user_idx" ON "user_sessions" ("user_id");
CREATE UNIQUE INDEX "administrators_username_idx" ON "administrators" ("username");
CREATE UNIQUE INDEX "admin_sessions_token_idx" ON "admin_sessions" ("token_hash");
CREATE INDEX "admin_sessions_admin_idx" ON "admin_sessions" ("administrator_id");
CREATE INDEX "road_contracts_city_idx" ON "road_contracts" ("city");
CREATE INDEX "road_contracts_published_idx" ON "road_contracts" ("published");
CREATE INDEX "devices_user_idx" ON "devices" ("user_id");
CREATE INDEX "journeys_user_idx" ON "journeys" ("user_id");
