-- Add athmovil_reference_number column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS athmovil_reference_number TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_athmovil_reference ON orders(athmovil_reference_number) WHERE athmovil_reference_number IS NOT NULL;
