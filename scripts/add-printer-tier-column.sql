-- Add printer_tier column to restaurants table
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS printer_tier TEXT DEFAULT NULL;

-- Add printer_tier column to catering_restaurants table
ALTER TABLE catering_restaurants 
ADD COLUMN IF NOT EXISTS printer_tier TEXT DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN restaurants.printer_tier IS 'Printer integration tier: eatabit, none, or null';
COMMENT ON COLUMN catering_restaurants.printer_tier IS 'Printer integration tier: eatabit, none, or null';

-- Update existing restaurants that have eatabit_enabled=true to have printer_tier='eatabit'
UPDATE restaurants 
SET printer_tier = 'eatabit' 
WHERE eatabit_enabled = true AND eatabit_printer_id IS NOT NULL;
