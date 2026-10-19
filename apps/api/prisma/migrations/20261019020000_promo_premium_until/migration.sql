-- Promo codes can give Premium until a fixed date. Additive: a nullable column.
ALTER TABLE "billing_promotions" ADD COLUMN IF NOT EXISTS "premium_until" TIMESTAMPTZ(6);
