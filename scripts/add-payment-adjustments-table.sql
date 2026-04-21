-- Table to track refunds and additional charges for orders
CREATE TABLE IF NOT EXISTS order_payment_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('refund', 'additional_charge')),
  amount DECIMAL(10,2) NOT NULL,
  stripe_refund_id TEXT,
  stripe_payment_intent_id TEXT,
  reason TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Index for quick lookups by order
CREATE INDEX IF NOT EXISTS idx_payment_adjustments_order_id ON order_payment_adjustments(order_id);

-- Enable RLS
ALTER TABLE order_payment_adjustments ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role full access" ON order_payment_adjustments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Comment
COMMENT ON TABLE order_payment_adjustments IS 'Tracks all refunds and additional charges for orders';
