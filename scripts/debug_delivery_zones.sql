-- Debug: Check delivery zones and their restaurant IDs
SELECT 
  dz.id,
  dz.restaurant_id,
  dz.zone_name,
  dz.min_distance,
  dz.max_distance,
  dz.base_fee,
  dz.is_active,
  r.name as restaurant_name,
  r.slug as restaurant_slug
FROM delivery_zones dz
LEFT JOIN restaurants r ON r.id = dz.restaurant_id
WHERE dz.is_active = true
ORDER BY r.name, dz.min_distance;

-- Check if there are any orphan zones (no matching restaurant)
SELECT dz.* 
FROM delivery_zones dz
LEFT JOIN restaurants r ON r.id = dz.restaurant_id
WHERE r.id IS NULL;

-- List all restaurants with their IDs
SELECT id, name, slug, delivery_fee, delivery_base_fee 
FROM restaurants 
WHERE is_active = true 
ORDER BY name;
