-- Weekly base plan (₹99/week) on Google Play.
ALTER TYPE "PlanInterval" ADD VALUE IF NOT EXISTS 'WEEK' BEFORE 'MONTH';
