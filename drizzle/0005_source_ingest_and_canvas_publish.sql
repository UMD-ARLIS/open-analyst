CREATE TABLE IF NOT EXISTS "source_ingest_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "task_id" uuid REFERENCES "tasks"("id") ON DELETE set null,
  "collection_id" uuid REFERENCES "collections"("id") ON DELETE set null,
  "collection_name" varchar(255) DEFAULT 'Research Inbox',
  "origin" varchar(32) NOT NULL DEFAULT 'literature',
  "status" varchar(32) NOT NULL DEFAULT 'staged',
  "query" text DEFAULT '',
  "summary" text DEFAULT '',
  "requested_count" integer NOT NULL DEFAULT 0,
  "imported_count" integer NOT NULL DEFAULT 0,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "approved_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "rejected_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "source_ingest_batches_project_updated_idx"
  ON "source_ingest_batches" ("project_id", "updated_at");
CREATE INDEX IF NOT EXISTS "source_ingest_batches_project_status_idx"
  ON "source_ingest_batches" ("project_id", "status");
CREATE INDEX IF NOT EXISTS "source_ingest_batches_task_idx"
  ON "source_ingest_batches" ("task_id");

CREATE TABLE IF NOT EXISTS "source_ingest_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" uuid NOT NULL REFERENCES "source_ingest_batches"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "document_id" uuid REFERENCES "documents"("id") ON DELETE set null,
  "external_id" text,
  "source_url" text,
  "title" varchar(500) NOT NULL DEFAULT 'Untitled Source',
  "mime_type_hint" varchar(255),
  "target_filename" varchar(255),
  "normalized_metadata" jsonb DEFAULT '{}'::jsonb,
  "storage_uri" text,
  "status" varchar(32) NOT NULL DEFAULT 'staged',
  "error" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "imported_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "source_ingest_items_batch_idx"
  ON "source_ingest_items" ("batch_id", "created_at");
CREATE INDEX IF NOT EXISTS "source_ingest_items_project_status_idx"
  ON "source_ingest_items" ("project_id", "status");
CREATE INDEX IF NOT EXISTS "source_ingest_items_document_idx"
  ON "source_ingest_items" ("document_id");
