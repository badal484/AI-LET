-- How characters address the user (Hindi verb forms): male / female / unspecified (neutral).
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "user_gender" VARCHAR(20);
