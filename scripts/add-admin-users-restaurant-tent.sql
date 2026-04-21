-- Add restaurant_tent column to admin_users table
-- This column tracks whether the restaurant_id refers to a delivery or catering restaurant

ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS restaurant_tent TEXT 
CHECK (restaurant_tent IN ('delivery', 'catering'));

-- Add comment explaining the column
COMMENT ON COLUMN admin_users.restaurant_tent IS 'Indicates which tent the restaurant_id belongs to: delivery (restaurants table) or catering (catering_restaurants table)';
