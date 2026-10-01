-- CreateTable
CREATE TABLE "user_character_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_character_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_character_profiles_character_id_idx" ON "user_character_profiles"("character_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_character_profiles_user_id_character_id_key" ON "user_character_profiles"("user_id", "character_id");

-- AddForeignKey
ALTER TABLE "user_character_profiles" ADD CONSTRAINT "user_character_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_character_profiles" ADD CONSTRAINT "user_character_profiles_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

