-- Add payment_provider column to orders table
-- This column tracks which payment provider was used for an order (stripe, square, athmovil, cash, etc.)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_provider'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_provider TEXT;
  END IF;
END $$;
