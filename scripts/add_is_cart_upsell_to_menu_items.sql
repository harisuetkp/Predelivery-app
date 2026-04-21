-- Add is_cart_upsell column to menu_items table
-- This column marks items that should appear as upsells in the cart modal

ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS is_cart_upsell BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN menu_items.is_cart_upsell IS 'When true, this item appears in the cart upsell section for quick add-ons like bags, utensils, drinks';
