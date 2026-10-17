-- Store each memory embedding once. Where pgvector is in use, the trigger fills "embedding_vec" from the JSON
-- the app writes and then clears the JSON copy (~11 kB per memory, read only by the no-pgvector fallback).
-- Embeddings that can't become a vector (old 128-number ones) keep their JSON. Existing rows are untouched
-- here; clearing old copies is a separate, owner-approved cleanup (docs/DB_OPTIMIZATION_PLAN.md, step 3).
-- Databases without pgvector are skipped and keep storing JSON, as before.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memory_embeddings' AND column_name = 'embedding_vec') THEN
    CREATE OR REPLACE FUNCTION memory_embeddings_sync_vec() RETURNS trigger AS $f$
    BEGIN
      IF NEW."embedding" IS NOT NULL AND jsonb_typeof(NEW."embedding") = 'array' AND jsonb_array_length(NEW."embedding") = 1536 THEN
        NEW."embedding_vec" := (NEW."embedding"::text)::vector;
        NEW."embedding" := NULL;
      ELSIF NEW."embedding" IS NOT NULL THEN
        NEW."embedding_vec" := NULL;
      END IF;
      RETURN NEW;
    END;
    $f$ LANGUAGE plpgsql;
  ELSE
    RAISE NOTICE 'pgvector not in use: memory embeddings keep their JSON copy.';
  END IF;
END $$;
