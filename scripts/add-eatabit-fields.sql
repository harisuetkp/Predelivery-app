-- Add Eatabit printer integration fields
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS eatabit_enabled BOOLEAN DEFAULT false;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS eatabit_printer_id TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS eatabit_enabled BOOLEAN DEFAULT false;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS eatabit_printer_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS eatabit_job_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS eatabit_status TEXT;
