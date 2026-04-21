-- ============================================================================
-- ADD KDS COLUMNS TO CATERING TABLES
-- ============================================================================
-- Adds kds_access_token and kds_setup_code to catering_restaurants and
-- catering_branches to enable KDS token-based authentication for catering.
-- 
-- ADDITIVE ONLY - No modifications to existing data.
-- ============================================================================

-- Add KDS columns to catering_restaurants
ALTER TABLE catering_restaurants 
  ADD COLUMN IF NOT EXISTS kds_access_token TEXT,
  ADD COLUMN IF NOT EXISTS kds_setup_code TEXT;

-- Add KDS columns to catering_branches
ALTER TABLE catering_branches
  ADD COLUMN IF NOT EXISTS kds_access_token TEXT,
  ADD COLUMN IF NOT EXISTS kds_setup_code TEXT;

-- Add guest_count column to catering_orders if it doesn't exist
ALTER TABLE catering_orders
  ADD COLUMN IF NOT EXISTS guest_count INTEGER;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
