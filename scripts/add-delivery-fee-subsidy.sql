-- Add delivery_fee_subsidy to platform_settings
-- This is the platform-level dollar amount subtracted from displayed delivery fees.
-- The full fee is always stored on orders for accurate reporting.
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS delivery_fee_subsidy numeric(10,2) DEFAULT 3.00;
