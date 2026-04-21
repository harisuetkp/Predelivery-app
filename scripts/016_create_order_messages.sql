-- Create order_messages table for KDS ↔ CSR communication
CREATE TABLE IF NOT EXISTS order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  restaurant_id UUID NOT NULL,
  sender_type TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'custom',
  related_item_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_order_messages_order_id ON order_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_restaurant_id ON order_messages(restaurant_id);
