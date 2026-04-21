-- Combined migration to add all missing columns to restaurants table

-- Marketplace columns
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS marketplace_image_url TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS marketplace_opt_in BOOLEAN DEFAULT false;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS cuisine_type TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS marketplace_description TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS area TEXT;

-- Delivery columns
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS pickup_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS min_delivery_order DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS min_pickup_order DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS delivery_lead_time INTEGER DEFAULT 45;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS pickup_lead_time INTEGER DEFAULT 30;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS delivery_radius_miles DECIMAL(5,2);

-- Branding columns
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS hero_image_url TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS banner_logo_url TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS show_service_packages BOOLEAN DEFAULT true;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS packages_section_title TEXT DEFAULT 'Paquetes de Servicios';

-- White label columns
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS white_label_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS hide_platform_branding BOOLEAN DEFAULT false;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS show_powered_by BOOLEAN DEFAULT true;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS custom_domain TEXT;

-- Footer columns
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS footer_phone TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS footer_email TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS footer_facebook_url TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS footer_instagram_url TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS footer_whatsapp_number TEXT;

-- Payment provider columns
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS square_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS square_application_id TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS square_location_id TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS square_access_token TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS athmovil_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS athmovil_public_token TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS athmovil_private_token TEXT;

-- Discount columns
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS delivery_discount_percent DECIMAL(5,2) DEFAULT 0;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS pickup_discount_percent DECIMAL(5,2) DEFAULT 0;

-- Shipday integration
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS shipday_api_key TEXT;

-- Notification settings
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS order_notification_emails TEXT[];
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS order_notification_phones TEXT[];
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT true;

-- Feature tags
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS feature_tags TEXT[];

-- Cart upsell
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS cart_upsell_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS cart_upsell_title TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS cart_upsell_item_ids UUID[];

-- Bulk order
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS bulk_order_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS bulk_order_min_people INTEGER DEFAULT 10;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS bulk_order_lead_days INTEGER DEFAULT 3;

-- Add missing columns to categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS header_image_url TEXT;

-- Add missing columns to menu_items
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS selling_unit TEXT DEFAULT 'unit';
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS unit_label TEXT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS per_unit_price DECIMAL(10,2);
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS serves TEXT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS delivery_lead_time INTEGER;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS pickup_lead_time INTEGER;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS is_bulk_item BOOLEAN DEFAULT false;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS bulk_min_quantity INTEGER;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS is_upsell_item BOOLEAN DEFAULT false;

-- Add missing columns to item_options
ALTER TABLE public.item_options ADD COLUMN IF NOT EXISTS display_type TEXT DEFAULT 'radio';

-- Add missing columns to item_option_choices
ALTER TABLE public.item_option_choices ADD COLUMN IF NOT EXISTS description TEXT;

-- Add missing columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS printed_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_source TEXT DEFAULT 'web';
