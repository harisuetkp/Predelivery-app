-- Set dispatch fee to 15% for all existing restaurants
UPDATE restaurants 
SET dispatch_fee_percent = 15 
WHERE dispatch_fee_percent IS NULL OR dispatch_fee_percent = 0;

-- Update the column default to 15 for new restaurants
ALTER TABLE restaurants 
ALTER COLUMN dispatch_fee_percent SET DEFAULT 15;
