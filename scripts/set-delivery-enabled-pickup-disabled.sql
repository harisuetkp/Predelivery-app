-- Update all restaurants to have delivery enabled and pickup disabled
UPDATE restaurants
SET 
  delivery_enabled = TRUE,
  pickup_enabled = FALSE;

-- Also update the default values for new restaurants
ALTER TABLE restaurants 
  ALTER COLUMN delivery_enabled SET DEFAULT TRUE,
  ALTER COLUMN pickup_enabled SET DEFAULT FALSE;
