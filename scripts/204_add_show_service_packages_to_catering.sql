-- Add show_service_packages column to catering_restaurants table
ALTER TABLE catering_restaurants
ADD COLUMN IF NOT EXISTS show_service_packages BOOLEAN DEFAULT true;

-- Set default value for existing restaurants that have null
UPDATE catering_restaurants
SET show_service_packages = true
WHERE show_service_packages IS NULL;
