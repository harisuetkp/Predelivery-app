-- Add tip_option_4 column to catering_restaurants table
ALTER TABLE catering_restaurants 
ADD COLUMN IF NOT EXISTS tip_option_4 INTEGER DEFAULT 20;

-- Add comment for documentation
COMMENT ON COLUMN catering_restaurants.tip_option_4 IS 'Fourth tip percentage option for customer checkout (e.g. 20 for 20%)';
