-- Memory embeddings as a real pgvector column, so similarity is computed inside Postgres (only ids and
-- scores leave the database). The JSON column stays and remains what the app writes; a trigger keeps the
-- vector column in step. Skipped (with a notice) where pgvector isn't available — the app then falls
-- back to comparing in Node, as before.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;

    ALTER TABLE "memory_embeddings" ADD COLUMN IF NOT EXISTS "embedding_vec" vector(1536);

    UPDATE "memory_embeddings"
       SET "embedding_vec" = ("embedding"::text)::vector
     WHERE "embedding" IS NOT NULL
       AND jsonb_typeof("embedding") = 'array'
       AND jsonb_array_length("embedding") = 1536
       AND "embedding_vec" IS NULL;

    CREATE OR REPLACE FUNCTION memory_embeddings_sync_vec() RETURNS trigger AS $f$
    BEGIN
      IF NEW."embedding" IS NOT NULL AND jsonb_typeof(NEW."embedding") = 'array' AND jsonb_array_length(NEW."embedding") = 1536 THEN
        NEW."embedding_vec" := (NEW."embedding"::text)::vector;
      ELSE
        NEW."embedding_vec" := NULL;
      END IF;
      RETURN NEW;
    END;
    $f$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS memory_embeddings_sync_vec ON "memory_embeddings";
    CREATE TRIGGER memory_embeddings_sync_vec
      BEFORE INSERT OR UPDATE OF "embedding" ON "memory_embeddings"
      FOR EACH ROW EXECUTE FUNCTION memory_embeddings_sync_vec();
  ELSE
    RAISE NOTICE 'pgvector not available: memory similarity keeps running in the app.';
  END IF;
END $$;
