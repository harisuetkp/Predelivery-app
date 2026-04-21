-- Add delivery_zip_codes column to restaurants table
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS delivery_zip_codes text[];

-- Seed coordinates for all existing restaurants that don't have them (San Juan, PR as default)
UPDATE restaurants
SET latitude = 18.4655, longitude = -66.1057
WHERE latitude IS NULL OR longitude IS NULL;
