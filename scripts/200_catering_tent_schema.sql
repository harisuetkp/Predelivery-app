-- ============================================================================
-- CATERING TENT SCHEMA - Three Tent Architecture
-- ============================================================================
-- This migration creates the complete Catering module for sky-flower.
-- Catering is a separate "tent" that shares only: customers, operators, 
-- KDS, CSR, EataBit, Shipday, Stripe, and Resend with the Delivery tent.
-- 
-- ADDITIVE ONLY - No modifications to existing delivery tables.
-- All catering tables are prefixed with catering_
-- ============================================================================

-- ============================================================================
-- STEP 1: Create operators table (shared across all tents)
-- ============================================================================
CREATE TABLE IF NOT EXISTS operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT,
  delivery_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  catering_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  subscription_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  default_language TEXT NOT NULL DEFAULT 'es',
  bilingual BOOLEAN NOT NULL DEFAULT FALSE,
  tax_rate DECIMAL NOT NULL DEFAULT 11.5,
  show_unified_landing BOOLEAN NOT NULL DEFAULT FALSE,
  show_delivery_landing BOOLEAN NOT NULL DEFAULT FALSE,
  show_catering_landing BOOLEAN NOT NULL DEFAULT FALSE,
  show_subscription_landing BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- STEP 2: Add columns to existing orders table (delivery tent)
-- ============================================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'delivery';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS operator_id UUID;

-- Set existing orders to 'delivery' type
UPDATE orders SET order_type = 'delivery' WHERE order_type IS NULL;

-- ============================================================================
-- STEP 3: Create catering_restaurants (root table for catering tent)
-- ============================================================================
CREATE TABLE catering_restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id), -- links to delivery tent if same restaurant exists
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  hero_image_url TEXT,
  primary_color TEXT,
  cuisine_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  show_in_marketplace BOOLEAN NOT NULL DEFAULT TRUE,
  is_chain BOOLEAN NOT NULL DEFAULT FALSE,
  default_lead_time_hours INTEGER NOT NULL DEFAULT 48,
  max_advance_days INTEGER NOT NULL DEFAULT 21,
  tax_rate DECIMAL DEFAULT 11.5,
  operator_id UUID REFERENCES operators(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- STEP 4: Create catering_branches
-- ============================================================================
CREATE TABLE catering_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catering_restaurant_id UUID NOT NULL REFERENCES catering_restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- STEP 5: Create catering_categories
-- ============================================================================
CREATE TABLE catering_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catering_restaurant_id UUID NOT NULL REFERENCES catering_restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- STEP 6: Create catering_menu_items
-- ============================================================================
CREATE TABLE catering_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catering_restaurant_id UUID NOT NULL REFERENCES catering_restaurants(id) ON DELETE CASCADE,
  catering_category_id UUID NOT NULL REFERENCES catering_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL NOT NULL,
  selling_unit TEXT NOT NULL CHECK (selling_unit IN (
    'each', 'tray', 'half_tray', 'bowl', 'bowl_8oz', 'bowl_16oz', 
    'bowl_32oz', 'bowl_64oz', 'bottle_750ml', 'gallon', 'half_gallon', 
    'liter', 'per_pound', 'per_person', 'cena_completa', 'box', 
    'boxed_lunch', 'paquete', 'bolsa', 'orden'
  )),
  serves TEXT, -- e.g. "10" or "20-25"
  min_quantity INTEGER,
  container_type TEXT CHECK (container_type IS NULL OR container_type IN (
    'none', 'heavy_tray', 'light_tray', 'full_tray', 'half_tray', 
    'bowl', 'bowl_8oz', 'bowl_16oz', 'bowl_32oz', 'bowl_64oz', 
    'bag', 'box', 'package'
  )),
  custom_lead_time_hours INTEGER, -- null = use restaurant default
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_cart_upsell BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- STEP 7: Create catering_item_sizes
-- ============================================================================
CREATE TABLE catering_item_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catering_menu_item_id UUID NOT NULL REFERENCES catering_menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g. "Media Bandeja", "Full Bandeja"
  price DECIMAL NOT NULL,
  serves TEXT, -- e.g. "10" or "20"
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- STEP 8: Create catering_item_options
-- ============================================================================
CREATE TABLE catering_item_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catering_menu_item_id UUID NOT NULL REFERENCES catering_menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_type TEXT NOT NULL DEFAULT 'pills' CHECK (display_type IN (
    'pills', 'dropdown', 'grid', 'list', 'counter'
  )),
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  min_selections INTEGER DEFAULT 0,
  max_selections INTEGER,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- STEP 9: Create catering_item_option_choices
-- ============================================================================
CREATE TABLE catering_item_option_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catering_item_option_id UUID NOT NULL REFERENCES catering_item_options(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_modifier DECIMAL NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- STEP 10: Create catering_branch_menu_overrides
-- ============================================================================
CREATE TABLE catering_branch_menu_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catering_branch_id UUID NOT NULL REFERENCES catering_branches(id) ON DELETE CASCADE,
  catering_menu_item_id UUID NOT NULL REFERENCES catering_menu_items(id) ON DELETE CASCADE,
  override_price DECIMAL, -- null = use default price
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (catering_branch_id, catering_menu_item_id)
);

-- ============================================================================
-- STEP 11: Create catering_service_packages
-- ============================================================================
CREATE TABLE catering_service_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catering_restaurant_id UUID NOT NULL REFERENCES catering_restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  base_price DECIMAL NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- STEP 12: Create catering_package_inclusions
-- ============================================================================
CREATE TABLE catering_package_inclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catering_service_package_id UUID NOT NULL REFERENCES catering_service_packages(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- STEP 13: Create catering_package_addons
-- ============================================================================
CREATE TABLE catering_package_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catering_service_package_id UUID NOT NULL REFERENCES catering_service_packages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL NOT NULL,
  unit_label TEXT, -- e.g. "each", "hour", "mantel", "pack"
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- STEP 14: Create catering_delivery_zones
-- ============================================================================
CREATE TABLE catering_delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catering_restaurant_id UUID NOT NULL REFERENCES catering_restaurants(id) ON DELETE CASCADE,
  catering_branch_id UUID REFERENCES catering_branches(id) ON DELETE CASCADE, -- null = applies to all branches
  min_distance DECIMAL NOT NULL DEFAULT 0,
  max_distance DECIMAL NOT NULL,
  base_fee DECIMAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- STEP 15: Create catering_container_fees
-- ============================================================================
CREATE TABLE catering_container_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catering_restaurant_id UUID NOT NULL REFERENCES catering_restaurants(id) ON DELETE CASCADE,
  container_type TEXT NOT NULL,
  label TEXT NOT NULL,
  fee_per_unit DECIMAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (catering_restaurant_id, container_type)
);

-- ============================================================================
-- STEP 16: Create catering_orders
-- ============================================================================
CREATE TABLE catering_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catering_restaurant_id UUID NOT NULL REFERENCES catering_restaurants(id),
  catering_branch_id UUID REFERENCES catering_branches(id),
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  order_type TEXT NOT NULL DEFAULT 'catering',
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('delivery', 'pickup')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  prep_by TIMESTAMPTZ,
  delivery_address TEXT,
  delivery_city TEXT,
  delivery_state TEXT,
  delivery_zip TEXT,
  subtotal DECIMAL NOT NULL DEFAULT 0,
  delivery_fee DECIMAL NOT NULL DEFAULT 0,
  service_package_fee DECIMAL NOT NULL DEFAULT 0,
  container_fees DECIMAL NOT NULL DEFAULT 0,
  tax DECIMAL NOT NULL DEFAULT 0,
  total DECIMAL NOT NULL DEFAULT 0,
  service_package_id UUID REFERENCES catering_service_packages(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'
  )),
  payment_method TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  notes TEXT,
  operator_id UUID REFERENCES operators(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- STEP 17: Create catering_order_items
-- ============================================================================
CREATE TABLE catering_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catering_order_id UUID NOT NULL REFERENCES catering_orders(id) ON DELETE CASCADE,
  catering_menu_item_id UUID NOT NULL REFERENCES catering_menu_items(id),
  catering_item_size_id UUID REFERENCES catering_item_sizes(id),
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL NOT NULL,
  size_name TEXT,
  serves TEXT,
  selling_unit TEXT,
  options JSONB,
  subtotal DECIMAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- STEP 18: Create indexes for performance
-- ============================================================================
CREATE INDEX idx_catering_restaurants_slug ON catering_restaurants(slug);
CREATE INDEX idx_catering_restaurants_operator ON catering_restaurants(operator_id);
CREATE INDEX idx_catering_branches_restaurant ON catering_branches(catering_restaurant_id);
CREATE INDEX idx_catering_categories_restaurant ON catering_categories(catering_restaurant_id);
CREATE INDEX idx_catering_menu_items_restaurant ON catering_menu_items(catering_restaurant_id);
CREATE INDEX idx_catering_menu_items_category ON catering_menu_items(catering_category_id);
CREATE INDEX idx_catering_item_sizes_item ON catering_item_sizes(catering_menu_item_id);
CREATE INDEX idx_catering_item_options_item ON catering_item_options(catering_menu_item_id);
CREATE INDEX idx_catering_item_option_choices_option ON catering_item_option_choices(catering_item_option_id);
CREATE INDEX idx_catering_service_packages_restaurant ON catering_service_packages(catering_restaurant_id);
CREATE INDEX idx_catering_package_inclusions_package ON catering_package_inclusions(catering_service_package_id);
CREATE INDEX idx_catering_package_addons_package ON catering_package_addons(catering_service_package_id);
CREATE INDEX idx_catering_delivery_zones_restaurant ON catering_delivery_zones(catering_restaurant_id);
CREATE INDEX idx_catering_orders_restaurant ON catering_orders(catering_restaurant_id);
CREATE INDEX idx_catering_orders_customer ON catering_orders(customer_id);
CREATE INDEX idx_catering_orders_status ON catering_orders(status);
CREATE INDEX idx_catering_orders_scheduled ON catering_orders(scheduled_for);
CREATE INDEX idx_catering_order_items_order ON catering_order_items(catering_order_id);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- NOTE: RLS is disabled across sky-flower for consistency.
-- RLS policies will be implemented in Phase 3.
-- ============================================================================
