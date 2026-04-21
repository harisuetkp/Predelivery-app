-- Phase 3 of geocoding overhaul (2026-04-19):
-- Driver-verified delivery coordinates.
--
-- Populated by the Shipday ORDER_COMPLETED webhook handler at
-- /api/shipday/webhook. When a driver marks an order delivered, Shipday
-- fires a webhook including the driver's GPS fix at drop-off. We store
-- that on the matching row in customer_addresses. Next time the same
-- customer orders at that address, checkout reads verified_latitude/
-- verified_longitude first and only falls back to the original Google-
-- geocoded coords if no verified fix exists yet.
--
-- Additive-only per platform schema rules.

ALTER TABLE customer_addresses
  ADD COLUMN IF NOT EXISTS verified_latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS verified_longitude DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_from_order_id UUID;

-- Partial index: find addresses that still need a verified fix
CREATE INDEX IF NOT EXISTS idx_customer_addresses_unverified
  ON customer_addresses(customer_id)
  WHERE verified_at IS NULL;
