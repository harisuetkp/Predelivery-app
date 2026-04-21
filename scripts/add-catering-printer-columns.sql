-- Add printer configuration columns to catering_restaurants if missing
ALTER TABLE catering_restaurants
ADD COLUMN IF NOT EXISTS eatabit_restaurant_key TEXT;

ALTER TABLE catering_restaurants
ADD COLUMN IF NOT EXISTS printer_tier TEXT;

-- Add constraint for printer_tier values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'catering_restaurants_printer_tier_check'
  ) THEN
    ALTER TABLE catering_restaurants
    ADD CONSTRAINT catering_restaurants_printer_tier_check
    CHECK (printer_tier IS NULL OR printer_tier IN ('eatabit', 'kds'));
  END IF;
END $$;
