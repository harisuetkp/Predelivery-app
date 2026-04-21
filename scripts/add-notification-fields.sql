-- Add new order notification fields to restaurants and branches tables

-- Add email_fallback_enabled column to restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS email_fallback_enabled boolean DEFAULT false;

-- Add eatabit_restaurant_key column to restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS eatabit_restaurant_key text;

-- Add eatabit_enabled column to restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS eatabit_enabled boolean DEFAULT false;

-- Add email_fallback_enabled column to branches
ALTER TABLE branches ADD COLUMN IF NOT EXISTS email_fallback_enabled boolean DEFAULT false;

-- Add eatabit_restaurant_key column to branches
ALTER TABLE branches ADD COLUMN IF NOT EXISTS eatabit_restaurant_key text;

-- Add eatabit_enabled column to branches
ALTER TABLE branches ADD COLUMN IF NOT EXISTS eatabit_enabled boolean DEFAULT false;
