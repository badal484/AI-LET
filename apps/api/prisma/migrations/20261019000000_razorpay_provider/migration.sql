-- Razorpay (UPI / cards via Google Play user choice billing in India). Additive: a new enum value only.
ALTER TYPE "BillingProvider" ADD VALUE IF NOT EXISTS 'RAZORPAY';
