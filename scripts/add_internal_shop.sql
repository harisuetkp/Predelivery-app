-- Internal Shop Migration
-- Adds support for platform-owned items (drinks, water, etc.) that can be added to any restaurant order
-- Accounting is separate: restaurant_subtotal vs internal_shop_subtotal

-- ============================================
-- 1. Create internal_shop_items table
-- ============================================
CREATE TABLE IF NOT EXISTS internal_shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  category VARCHAR(100), -- e.g., 'Beverages', 'Snacks', 'Extras'
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  sku VARCHAR(50), -- for inventory tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for active items lookup
CREATE INDEX IF NOT EXISTS idx_internal_shop_items_active ON internal_shop_items(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_internal_shop_items_category ON internal_shop_items(category);

-- ============================================
-- 2. Add columns to order_items table
-- ============================================
-- Flag to identify if this order item is from internal shop
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS is_internal_shop_item BOOLEAN DEFAULT false;

-- Reference to internal shop item (when is_internal_shop_item = true)
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS internal_shop_item_id UUID REFERENCES internal_shop_items(id);

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_order_items_internal_shop ON order_items(is_internal_shop_item) WHERE is_internal_shop_item = true;

-- ============================================
-- 3. Add columns to orders table for split accounting
-- ============================================
-- Subtotal for restaurant items only (for restaurant payout calculation)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS restaurant_subtotal DECIMAL(10,2) DEFAULT 0;

-- Subtotal for internal shop items only (platform revenue)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS internal_shop_subtotal DECIMAL(10,2) DEFAULT 0;

-- ============================================
-- 4. Create updated_at trigger for internal_shop_items
-- ============================================
CREATE OR REPLACE FUNCTION update_internal_shop_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_internal_shop_items_updated_at ON internal_shop_items;
CREATE TRIGGER trigger_internal_shop_items_updated_at
  BEFORE UPDATE ON internal_shop_items
  FOR EACH ROW
  EXECUTE FUNCTION update_internal_shop_items_updated_at();

-- ============================================
-- 5. RLS Policies for internal_shop_items
-- ============================================
ALTER TABLE internal_shop_items ENABLE ROW LEVEL SECURITY;

-- Public can view active internal shop items
DROP POLICY IF EXISTS "Anyone can view active internal shop items" ON internal_shop_items;
CREATE POLICY "Anyone can view active internal shop items" ON internal_shop_items
  FOR SELECT USING (is_active = true);

-- Super admins can do everything (using service role key bypasses RLS)
-- For explicit policy, we'd check admin_users table for super_admin role

-- ============================================
-- 6. Insert sample internal shop items
-- ============================================
INSERT INTO internal_shop_items (name, description, price, category, display_order, is_active) VALUES
  ('Coca-Cola', 'Coca-Cola 12oz can', 2.00, 'Beverages', 1, true),
  ('Sprite', 'Sprite 12oz can', 2.00, 'Beverages', 2, true),
  ('Bottled Water', 'Purified water 16.9oz', 1.50, 'Beverages', 3, true),
  ('Orange Juice', 'Fresh squeezed orange juice', 3.50, 'Beverages', 4, true),
  ('Chips', 'Assorted chips bag', 2.50, 'Snacks', 10, true),
  ('Extra Napkins', 'Pack of extra napkins', 0.50, 'Extras', 20, true),
  ('Utensils Pack', 'Fork, knife, spoon set', 0.75, 'Extras', 21, true)
ON CONFLICT DO NOTHING;
