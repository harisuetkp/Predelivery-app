-- Create service_areas table for managing delivery zip codes
CREATE TABLE IF NOT EXISTS service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zip_code VARCHAR(10) NOT NULL UNIQUE,
  area_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  delivery_fee_override DECIMAL(10,2) DEFAULT NULL,
  min_order_override DECIMAL(10,2) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for active areas lookup
CREATE INDEX IF NOT EXISTS idx_service_areas_active ON service_areas(is_active, display_order);

-- Insert default Puerto Rico zip codes
INSERT INTO service_areas (zip_code, area_name, display_order) VALUES
  ('00901', 'Viejo San Juan', 1),
  ('00907', 'Condado', 2),
  ('00909', 'Santurce', 3),
  ('00917', 'Hato Rey', 4),
  ('00918', 'Hato Rey', 5),
  ('00920', 'Río Piedras', 6),
  ('00923', 'Cupey', 7),
  ('00926', 'Cupey Gardens', 8),
  ('00949', 'Toa Baja', 9),
  ('00956', 'Bayamón', 10),
  ('00959', 'Bayamón', 11),
  ('00965', 'Guaynabo', 12),
  ('00968', 'Guaynabo', 13),
  ('00969', 'Garden Hills', 14),
  ('00976', 'Trujillo Alto', 15),
  ('00979', 'Carolina', 16),
  ('00983', 'Isla Verde', 17)
ON CONFLICT (zip_code) DO NOTHING;

-- Add RLS policies
ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read active service areas
CREATE POLICY "Anyone can read active service areas"
  ON service_areas FOR SELECT
  USING (is_active = true);

-- Allow super admins to manage service areas
CREATE POLICY "Super admins can manage service areas"
  ON service_areas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );
