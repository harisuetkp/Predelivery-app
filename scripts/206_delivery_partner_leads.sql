-- Create delivery_partner_leads table for restaurant acquisition form submissions
CREATE TABLE IF NOT EXISTS delivery_partner_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  restaurant_name text NOT NULL,
  address text,
  email text NOT NULL,
  phone text NOT NULL,
  operator_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Add index for operator lookups
CREATE INDEX IF NOT EXISTS idx_delivery_partner_leads_operator_id
ON delivery_partner_leads(operator_id);

-- Add index for created_at for recent leads
CREATE INDEX IF NOT EXISTS idx_delivery_partner_leads_created_at
ON delivery_partner_leads(created_at DESC);
