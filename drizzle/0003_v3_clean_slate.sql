CREATE TABLE IF NOT EXISTS "project_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "brief" text DEFAULT '',
  "retrieval_policy" jsonb DEFAULT '{}'::jsonb,
  "memory_profile" jsonb DEFAULT '{}'::jsonb,
  "templates" jsonb DEFAULT '[]'::jsonb,
  "agent_policies" jsonb DEFAULT '{}'::jsonb,
  "default_connector_ids" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_profiles_project_id_idx"
  ON "project_profiles" ("project_id");

CREATE TABLE IF NOT EXISTS "project_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "title" varchar(500) NOT NULL DEFAULT 'New Thread',
  "status" varchar(50) NOT NULL DEFAULT 'idle',
  "summary" text DEFAULT '',
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "project_threads_project_updated_idx"
  ON "project_threads" ("project_id", "updated_at");

CREATE TABLE IF NOT EXISTS "project_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "thread_id" uuid REFERENCES "project_threads"("id") ON DELETE set null,
  "parent_run_id" uuid,
  "title" varchar(500) NOT NULL DEFAULT 'New Run',
  "mode" varchar(50) NOT NULL DEFAULT 'chat',
  "status" varchar(50) NOT NULL DEFAULT 'queued',
  "intent" text DEFAULT '',
  "latest_output" text DEFAULT '',
  "plan" jsonb DEFAULT '[]'::jsonb,
  "runtime_state" jsonb DEFAULT '{}'::jsonb,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "project_runs_project_updated_idx"
  ON "project_runs" ("project_id", "updated_at");
CREATE INDEX IF NOT EXISTS "project_runs_thread_updated_idx"
  ON "project_runs" ("thread_id", "updated_at");
CREATE INDEX IF NOT EXISTS "project_runs_status_idx"
  ON "project_runs" ("status");

CREATE TABLE IF NOT EXISTS "run_steps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL REFERENCES "project_runs"("id") ON DELETE cascade,
  "step_type" varchar(100) NOT NULL,
  "actor" varchar(100) NOT NULL DEFAULT 'supervisor',
  "title" varchar(500) NOT NULL,
  "status" varchar(50) NOT NULL DEFAULT 'queued',
  "payload" jsonb DEFAULT '{}'::jsonb,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "run_steps_run_created_idx"
  ON "run_steps" ("run_id", "created_at");
CREATE INDEX IF NOT EXISTS "run_steps_status_idx"
  ON "run_steps" ("status");

CREATE TABLE IF NOT EXISTS "approvals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL REFERENCES "project_runs"("id") ON DELETE cascade,
  "step_id" uuid REFERENCES "run_steps"("id") ON DELETE set null,
  "kind" varchar(100) NOT NULL,
  "status" varchar(50) NOT NULL DEFAULT 'pending',
  "title" varchar(500) NOT NULL,
  "description" text DEFAULT '',
  "request_payload" jsonb DEFAULT '{}'::jsonb,
  "response_payload" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "resolved_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "approvals_run_created_idx"
  ON "approvals" ("run_id", "created_at");
CREATE INDEX IF NOT EXISTS "approvals_status_idx"
  ON "approvals" ("status");

CREATE TABLE IF NOT EXISTS "artifacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "run_id" uuid REFERENCES "project_runs"("id") ON DELETE set null,
  "title" varchar(500) NOT NULL DEFAULT 'Untitled Artifact',
  "kind" varchar(100) NOT NULL DEFAULT 'note',
  "mime_type" varchar(255) NOT NULL DEFAULT 'text/markdown',
  "storage_uri" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "artifacts_project_updated_idx"
  ON "artifacts" ("project_id", "updated_at");
CREATE INDEX IF NOT EXISTS "artifacts_run_updated_idx"
  ON "artifacts" ("run_id", "updated_at");

CREATE TABLE IF NOT EXISTS "artifact_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "artifact_id" uuid NOT NULL REFERENCES "artifacts"("id") ON DELETE cascade,
  "version" integer NOT NULL,
  "title" varchar(500) NOT NULL DEFAULT 'Untitled Version',
  "change_summary" text DEFAULT '',
  "storage_uri" text,
  "content_text" text DEFAULT '',
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "artifact_versions_artifact_version_idx"
  ON "artifact_versions" ("artifact_id", "version");
CREATE INDEX IF NOT EXISTS "artifact_versions_artifact_created_idx"
  ON "artifact_versions" ("artifact_id", "created_at");

CREATE TABLE IF NOT EXISTS "evidence_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "run_id" uuid REFERENCES "project_runs"("id") ON DELETE set null,
  "collection_id" uuid REFERENCES "collections"("id") ON DELETE set null,
  "document_id" uuid REFERENCES "documents"("id") ON DELETE set null,
  "artifact_id" uuid REFERENCES "artifacts"("id") ON DELETE set null,
  "title" varchar(500) NOT NULL DEFAULT 'Untitled Evidence',
  "evidence_type" varchar(100) NOT NULL DEFAULT 'note',
  "source_uri" text,
  "citation_text" text DEFAULT '',
  "extracted_text" text DEFAULT '',
  "confidence" varchar(20) DEFAULT 'medium',
  "provenance" jsonb DEFAULT '{}'::jsonb,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "evidence_items_project_updated_idx"
  ON "evidence_items" ("project_id", "updated_at");
CREATE INDEX IF NOT EXISTS "evidence_items_run_created_idx"
  ON "evidence_items" ("run_id", "created_at");
CREATE INDEX IF NOT EXISTS "evidence_items_collection_created_idx"
  ON "evidence_items" ("collection_id", "created_at");

CREATE TABLE IF NOT EXISTS "canvas_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "artifact_id" uuid REFERENCES "artifacts"("id") ON DELETE set null,
  "title" varchar(500) NOT NULL DEFAULT 'Untitled Canvas',
  "document_type" varchar(100) NOT NULL DEFAULT 'markdown',
  "content" jsonb DEFAULT '{}'::jsonb,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "canvas_documents_project_updated_idx"
  ON "canvas_documents" ("project_id", "updated_at");
CREATE INDEX IF NOT EXISTS "canvas_documents_artifact_updated_idx"
  ON "canvas_documents" ("artifact_id", "updated_at");

ALTER TABLE "settings"
  ALTER COLUMN "agent_backend" SET DEFAULT 'langgraph';
