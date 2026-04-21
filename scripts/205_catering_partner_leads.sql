-- Create catering_partner_leads table for restaurant acquisition form submissions
CREATE TABLE IF NOT EXISTS catering_partner_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  restaurant_name text NOT NULL,
  address text,
  email text NOT NULL,
  phone text NOT NULL,
  operator_id uuid REFERENCES operators(id),
  created_at timestamp with time zone DEFAULT now()
);

-- Add index for operator lookups
CREATE INDEX IF NOT EXISTS idx_catering_partner_leads_operator_id 
ON catering_partner_leads(operator_id);

-- Add index for created_at for recent leads
CREATE INDEX IF NOT EXISTS idx_catering_partner_leads_created_at 
ON catering_partner_leads(created_at DESC);
