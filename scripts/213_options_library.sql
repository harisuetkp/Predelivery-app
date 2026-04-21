-- 213_options_library.sql
-- ----------------------------------------------------------------------------
-- Option Creation Tool: per-restaurant hidden library where operators author
-- option groups + choices that they later assign to real dishes via the
-- existing "Browse options from other items" picker (deep-clone copy).
--
-- The library is implemented as a hidden category + hidden inactive menu_item
-- per restaurant. Both rows are excluded from the customer-facing storefront
-- (is_active = false on the menu_item) and from the regular Categories /
-- Menu Items admin tabs (filtered by id).
--
-- Additive only. NULL-able. Old code paths that don't know about these
-- columns continue to work unchanged.
-- ----------------------------------------------------------------------------

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS library_category_id  UUID NULL REFERENCES categories(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS library_menu_item_id UUID NULL REFERENCES menu_items(id)  ON DELETE SET NULL;

COMMENT ON COLUMN restaurants.library_category_id IS
  'Hidden category housing the Option Creation Tool''s library menu_item. NULL until first use.';
COMMENT ON COLUMN restaurants.library_menu_item_id IS
  'Hidden inactive menu_item that owns library option groups for the Option Creation Tool. NULL until first use.';
