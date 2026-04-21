-- Add dispatch_fee column to orders table to store the platform dispatch fee per order
-- This is separate from delivery_fee (which is the customer-facing "Costo de Entrega")

ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_fee DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN orders.dispatch_fee IS 'Platform dispatch fee charged on delivery orders (calculated as % of subtotal + delivery subsidy)';
