-- Add short setup codes for KDS tablet configuration
-- These are 6-character alphanumeric codes that are easy to type on tablets

-- Add to restaurants table
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS kds_setup_code VARCHAR(6) UNIQUE;

-- Add to branches table
ALTER TABLE branches 
ADD COLUMN IF NOT EXISTS kds_setup_code VARCHAR(6) UNIQUE;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_restaurants_kds_setup_code ON restaurants(kds_setup_code) WHERE kds_setup_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_branches_kds_setup_code ON branches(kds_setup_code) WHERE kds_setup_code IS NOT NULL;

-- Comment explaining the difference
COMMENT ON COLUMN restaurants.kds_setup_code IS 'Short 6-char code for tablet setup at /setup. Different from kds_access_token which is used in URLs for security.';
COMMENT ON COLUMN branches.kds_setup_code IS 'Short 6-char code for tablet setup at /setup. Different from kds_access_token which is used in URLs for security.';
