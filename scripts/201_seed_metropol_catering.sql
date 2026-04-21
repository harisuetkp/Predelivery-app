-- ============================================================================
-- SEED METROPOL CATERING DATA - Migration from teal-ball to sky-flower
-- ============================================================================
-- This migration seeds the catering_* tables with Metropol Catering data
-- extracted from teal-ball (unvnkqxuapegokurjykh).
-- 
-- Source: teal-ball restaurants.slug = 'metropol-catering'
-- Target: sky-flower catering_restaurants.slug = 'metropol-catering'
-- ============================================================================

-- ============================================================================
-- STEP 1: Insert catering_restaurants (Metropol Catering)
-- ============================================================================
INSERT INTO catering_restaurants (
  id, slug, name, logo_url, hero_image_url, primary_color, cuisine_type,
  is_active, show_in_marketplace, is_chain, default_lead_time_hours, 
  max_advance_days, tax_rate
) VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'metropol-catering',
  'Metropol',
  'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/531078_279881202132044_774762976_n-1771249756334.jpg',
  'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/biftecencebollado2-1772219760181.jpg',
  '#2e629c',
  'Cubana',
  true,
  true,
  true,
  48,
  21,
  7.0
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 2: Insert catering_categories for Metropol
-- ============================================================================
INSERT INTO catering_categories (id, catering_restaurant_id, name, display_order, is_active) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'PICADERA', 1, true),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'PLATOS', 2, true),
  ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'ARROCES', 3, true),
  ('c1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'COMBOS - CENAS COMPLETAS', 4, true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 2.5: Insert catering_branches for Metropol (11 branches)
-- ============================================================================
INSERT INTO catering_branches (
  id, catering_restaurant_id, name, address, city, state, phone, is_active
) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 
   'Aeropuerto LMM', 'Terminal American Airlines, Aeropuerto Luis Munoz Marin', 'Carolina', 'PR', '', true),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 
   'Barceloneta', 'Premium Outlets, PR-140', 'Barceloneta', 'PR', '787-970-1000', true),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 
   'Caguas', 'Plaza Centro Mall', 'Caguas', 'PR', '787-744-5000', true),
  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 
   'Dorado', '698 Av. José Efrón', 'Dorado', 'PR', '787-278-5500', true),
  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 
   'Guaynabo', 'Las Cumbres Ave', 'Guaynabo', 'PR', '787-272-7000', true),
  ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000001', 
   'Hato Rey', '244 Avenida F.D. Roosevelt', 'San Juan', 'PR', '787-751-4022', true),
  ('b1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000001', 
   'Isla Verde', '6600 Av. Isla Verde', 'Carolina', 'PR', '787-791-5585', true),
  ('b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000001', 
   'Los Paseos', 'Galería Paseos, 100, T-02 Grand Paseo Blvd', 'San Juan', 'PR', '', true),
  ('b1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000001', 
   'Mall of San Juan', '1000 The Mall of San Juan Blvd', 'San Juan', 'PR', '', true),
  ('b1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000001', 
   'Mayaguez Mall', 'Mayaguez Mall, PR-2', 'Mayagüez', 'PR', '787-805-0505', true),
  ('b1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000001', 
   'Plaza las Americas', 'Plaza las Americas Mall', 'San Juan', 'PR', '787-620-1000', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 3: Insert catering_menu_items for Metropol - PICADERA
-- ============================================================================
INSERT INTO catering_menu_items (
  id, catering_restaurant_id, catering_category_id, name, description, 
  price, selling_unit, serves, image_url, is_active, display_order
) VALUES
  -- PICADERA
  ('m1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 
   'Ensalada Verde', 'Green salad', 25.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/ENSALADA-1771347045621.png', true, 1),
  ('m1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 
   'Maduros', 'Ripe plantains', 1.00, 'each', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/AMARIULLO-1771347319119.png', true, 2),
  ('m1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 
   'Mini Mofongos', 'Mini Smashed Plantains', 80.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/MOFO%20PLATAN-1771347090836.png', true, 3),
  ('m1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 
   'Sampler Metropol', 'Includes empanadillas, croquetas, sorullitos, alcapurrias, queso frito, and mozzarella sticks', 85.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/SAMPLER-1771347187309.png', true, 4),
  ('m1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 
   'Sorullitos de Maiz', '', 60.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/SORULLOS-1771346453120.png', true, 5),
  ('m1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 
   'Yuca al Mojo', '', 35.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/YUCAHERV-1771346517458.png', true, 6),
  ('m1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 
   'Mariquitas', 'Plantain chips', 30.00, 'tray', NULL, 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/MARIQU-1771346168966.png', true, 7),
  ('m1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 
   'Tamal en Hoja', 'Cuban tamale', 50.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/TAMAL-1771346203449.png', true, 8),
  ('m1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 
   'Chicharrones de Pollo', 'Fried diced chicken', 75.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/chich%20pollo-1771347536787.png', true, 9),
  ('m1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 
   'Alcapurrias', 'Local plantain fritters', 70.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/ALCAPURRIAS-1771346687638.png', true, 10),
  ('m1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 
   'Croquetas de Jamon', 'Ham croquettes', 70.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/CROQUETA-1771346746203.png', true, 11),
  ('m1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 
   'Empanadillas de Carne', 'Beef turnovers', 70.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/EMPANADILA-1771346805505.png', true, 12),
  ('m1000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 
   'Sampler Familiar', 'Includes chicharrones de pollo, masitas de cerdo, croquetas, empanadillas, alcapurrias, and sorullitos', 95.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/SAMPLERPUERTORR-1771346871084.png', true, 13),
  ('m1000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 
   'Alitas de Pollo', 'Chicken wings', 75.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/ALITAS-1771346970864.png', true, 14),

  -- PLATOS
  ('m1000000-0000-0000-0000-000000000015', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 
   'Pechuga Salteada', 'Sauteed chicken breast', 80.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/PECHUGA%20SALTEADA-1771347633822.png', true, 1),
  ('m1000000-0000-0000-0000-000000000016', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 
   'Lomillo Salteado', 'Pepper steak', 95.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/lomillo%20salteado-1771347818455.png', true, 2),
  ('m1000000-0000-0000-0000-000000000017', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 
   'Ropa Vieja', 'Shredded beef', 95.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/Metropol_RopaVieja-1771347900441.jpg', true, 3),
  ('m1000000-0000-0000-0000-000000000018', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 
   'Masitas de Cerdo', 'Cuban-style fried pork', 80.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/masitascerdo-1771348066976.png', true, 4),
  ('m1000000-0000-0000-0000-000000000019', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 
   'Lechon Asado', '', 15.00, 'per_pound', '2', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/lechon-1771348222887.png', true, 5),
  ('m1000000-0000-0000-0000-000000000020', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 
   'Camarones al Ajillo', 'Shrimp in garlic sauce', 150.00, 'tray', '10', NULL, true, 6),
  ('m1000000-0000-0000-0000-000000000021', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 
   'Albondigas de Carne', 'Beef meatballs', 70.00, 'tray', '10', NULL, true, 7),
  ('m1000000-0000-0000-0000-000000000022', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 
   'Palomilla en Nuggets', '', 110.00, 'tray', NULL, NULL, true, 8),
  ('m1000000-0000-0000-0000-000000000023', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 
   'Filete de Pollo en Nuggets', '', 90.00, 'tray', '10', NULL, true, 9),
  ('m1000000-0000-0000-0000-000000000024', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 
   'Mero Rebosado o Empanado', 'Breaded grouper fillet', 80.00, 'tray', '10', NULL, true, 10),
  ('m1000000-0000-0000-0000-000000000025', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 
   'Ceviche', '', 100.00, 'tray', '10', NULL, true, 11),
  ('m1000000-0000-0000-0000-000000000026', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 
   'Camarones a la Criolla', 'Shrimp creole', 160.00, 'tray', '10', NULL, true, 12),
  ('m1000000-0000-0000-0000-000000000027', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 
   'Ensalada de Pulpo', 'Octopus salad', 160.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/PULPO-1771353811956.png', true, 13),
  ('m1000000-0000-0000-0000-000000000028', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 
   'Ensalada de Carrucho', 'Conch salad', 165.00, 'tray', '10', NULL, true, 14),
  ('m1000000-0000-0000-0000-000000000029', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 
   'Nuggets de Rodaballo', '', 175.00, 'tray', '10', NULL, true, 15),

  -- ARROCES
  ('m1000000-0000-0000-0000-000000000030', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 
   'Arroz con Gandules', 'Puerto Rican rice with pigeon peas', 35.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/Metropol_ArrozConGuancales-1771337742163.jpg', true, 1),
  ('m1000000-0000-0000-0000-000000000031', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 
   'Arroz Mamposteao', '', 35.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/Metropol_Mampo-1771345358105.jpg', true, 2),
  ('m1000000-0000-0000-0000-000000000032', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 
   'Arroz Congri', 'Cuban black beans and rice', 35.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/Metropol_Congrin-1771345383988.jpg', true, 3),
  ('m1000000-0000-0000-0000-000000000033', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 
   'Arroz Blanco', 'White rice', 25.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/ablo-1771424219804.webp', true, 4),
  ('m1000000-0000-0000-0000-000000000034', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 
   'Arroz con Pollo', 'Yellow rice with chicken', 11.99, 'per_person', NULL, NULL, true, 5),
  ('m1000000-0000-0000-0000-000000000035', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 
   'Arroz Frito Metropol', 'Fried rice with ripe plantains', 70.00, 'tray', '10', 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/arrozfritometrop-1771379404084.jpg', true, 6),
  ('m1000000-0000-0000-0000-000000000036', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 
   'Paella de Carne', 'Beef paella', 18.00, 'per_person', NULL, NULL, true, 7),
  ('m1000000-0000-0000-0000-000000000037', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 
   'Paella de Mariscos', 'Seafood paella', 25.00, 'per_person', NULL, 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/paellamariscos-1771379269009.jpg', true, 8),
  ('m1000000-0000-0000-0000-000000000038', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 
   'Paella Valenciana', '', 23.00, 'per_person', NULL, 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/paella1-1771379291030.jpg', true, 9),

  -- COMBOS - CENAS COMPLETAS
  ('m1000000-0000-0000-0000-000000000039', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004', 
   'Combo Boricua', 'Includes bistec salteado, arroz mamposteao, and platanos maduros', 150.00, 'cena_completa', '10', NULL, true, 1),
  ('m1000000-0000-0000-0000-000000000040', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004', 
   'Combo Pal Combo', 'Includes pechuga de pollo encebollada, arroz mamposteao, and platanos maduros', 150.00, 'cena_completa', '10', NULL, true, 2),
  ('m1000000-0000-0000-0000-000000000041', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004', 
   'Combo Bien Bestial', 'Includes pastelon de maduros & carne molida, arroz blanco (w/ habichuelas rojas), and ensalada verde', 150.00, 'cena_completa', '10', NULL, true, 3),
  ('m1000000-0000-0000-0000-000000000042', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004', 
   'Combo Navideno', 'Includes lechon asado, arroz con gandules, and ensalada de papa', 175.00, 'cena_completa', '10', NULL, true, 4),
  ('m1000000-0000-0000-0000-000000000043', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004', 
   'Combo Cubano', 'Includes masitas de cerdo encebolladas, arroz congri, and yuca al mojo', 150.00, 'cena_completa', '10', NULL, true, 5)

ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 4: Insert catering_service_packages for Metropol
-- ============================================================================
INSERT INTO catering_service_packages (
  id, catering_restaurant_id, name, description, base_price, image_url, is_active, display_order
) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 
   'Catering Delivery a tu Puerta', '', 0.00, 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/delivwom-1771421812703.jpeg', true, 0),
  ('e1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 
   'Catering Delivery y Montaje Basico', 'Delivery a tu Puerta, llevamos las bandejas a donde las necesites, organizacion basica. Incluye Platos de Coctel, Servilletas y Cubiertos plasticos (25 sets).', 175.00, 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/conferenceroom-1771421441740.jpeg', true, 1),
  ('e1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 
   'Catering Delivery y Montaje Premium', 'Setup Premium con 1 Mesa, 1 Mantel, 3 Chafing Dishes (Wire) con Sternos, Servilletas y Cubiertos Desechables (25 Sets).', 350.00, 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/pATIOWIRE-1771422836698.jpg', true, 2),
  ('e1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 
   'Catering Delivery y Montaje Premium Plus', 'Setup Premium Plus con 2 Mesas, 2 Manteles, 5 Chafing Dishes (Stainless Steel), y Servicio de Mozo por 2 horas.', 550.00, 
   NULL, true, 3)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 5: Insert catering_package_inclusions for Metropol
-- ============================================================================
INSERT INTO catering_package_inclusions (
  id, catering_service_package_id, description, is_active, display_order
) VALUES
  -- Delivery a tu Puerta (no inclusions by default)
  
  -- Montaje Basico
  ('f1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002', 
   'Servicio Delivery a tu Puerta', true, 0),
  ('f1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', 
   'Organizacion Basica de Bandejas, Platos, Servilletas y Cubiertos', true, 1),
  ('f1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000002', 
   'Recogido de Equipo Rentado (si aplica)', true, 2),

  -- Montaje Premium
  ('f1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000003', 
   'Todo en el Paquete Basico +', true, 0),
  ('f1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000003', 
   '1 Mesa de 6'' con Mantel', true, 1),
  ('f1000000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000003', 
   '3 Wire Chafing Dishes con Sternos', true, 2),
  ('f1000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000003', 
   'Servilletas y Cubiertos Desechables (25 Sets)', true, 3),

  -- Montaje Premium Plus
  ('f1000000-0000-0000-0000-000000000008', 'e1000000-0000-0000-0000-000000000004', 
   'Todo en el Paquete Premium +', true, 0),
  ('f1000000-0000-0000-0000-000000000009', 'e1000000-0000-0000-0000-000000000004', 
   '2 Mesas de 6'' con Manteles', true, 1),
  ('f1000000-0000-0000-0000-000000000010', 'e1000000-0000-0000-0000-000000000004', 
   '5 Premium Chafing Dishes (Stainless Steel)', true, 2),
  ('f1000000-0000-0000-0000-000000000011', 'e1000000-0000-0000-0000-000000000004', 
   'Servicio de Mozo por 2 horas', true, 3)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 6: Insert catering_package_addons for Metropol
-- ============================================================================
INSERT INTO catering_package_addons (
  id, catering_service_package_id, name, price, unit_label, is_active, display_order
) VALUES
  -- Delivery a tu Puerta addons
  ('d1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 
   'Cubiertos Desechables para 10 Personas', 12.00, 'Paquete', true, 0),

  -- Montaje Basico addons
  ('d1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', 
   'Wire Chaffing Dish', 12.00, 'cada uno', true, 0),
  ('d1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000002', 
   'Premium Chaffing Dish', 18.00, 'cada uno', true, 1),
  ('d1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000002', 
   'Dixie Disposable Paper Plates, 8.5", Multi-Color (50)', 7.00, 'Paquete de 50', true, 2),
  ('d1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000002', 
   'Set de Platos, Cubiertos y Servilletas (25)', 15.00, 'Set de 25', true, 3),

  -- Montaje Premium addons
  ('d1000000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000003', 
   'Upgrade a Premium Chaffing Dishes', 12.00, 'por unidad', true, 0),
  ('d1000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000003', 
   'Dixie Disposable Paper Plates, 8.5", Multi-Color (50)', 7.00, 'Paquete de 50', true, 1),
  ('d1000000-0000-0000-0000-000000000008', 'e1000000-0000-0000-0000-000000000003', 
   'Set de Platos, Cubiertos y Servilletas (25)', 15.00, 'Set de 25', true, 2),
  ('d1000000-0000-0000-0000-000000000009', 'e1000000-0000-0000-0000-000000000003', 
   'Manteles para Mesa Adicional', 22.00, 'por mantel', true, 3),
  ('d1000000-0000-0000-0000-000000000010', 'e1000000-0000-0000-0000-000000000003', 
   'Mesa de 6'' Adicional', 30.00, 'por mesa', true, 4),
  ('d1000000-0000-0000-0000-000000000011', 'e1000000-0000-0000-0000-000000000003', 
   'Mozo', 30.00, 'por hora', true, 5),

  -- Montaje Premium Plus addons
  ('d1000000-0000-0000-0000-000000000012', 'e1000000-0000-0000-0000-000000000004', 
   'Mozo adicional', 35.00, 'por hora', true, 0),
  ('d1000000-0000-0000-0000-000000000013', 'e1000000-0000-0000-0000-000000000004', 
   'Setup de Barra con Bartender (no incluye licores)', 125.00, 'por hora', true, 1)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 7: Insert catering_delivery_zones for Metropol (sample zones)
-- ============================================================================
INSERT INTO catering_delivery_zones (
  id, catering_restaurant_id, catering_branch_id, min_distance, max_distance, base_fee
) VALUES
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', NULL, 0, 5, 15.00),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', NULL, 5, 10, 25.00),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', NULL, 10, 15, 35.00),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', NULL, 15, 20, 45.00)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 8: Insert AURORITA catering_restaurant
-- ============================================================================
INSERT INTO catering_restaurants (
  id, slug, name, logo_url, hero_image_url, primary_color, cuisine_type,
  is_active, show_in_marketplace, is_chain, default_lead_time_hours, 
  max_advance_days, tax_rate
) VALUES (
  'a2000000-0000-0000-0000-000000000001',
  'aurorita-catering',
  'Aurorita',
  'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/stores/logo_original-f0b2cfd1-7310-4e41-9a66-ff2edf3d4d8f.jpeg',
  NULL,
  '#d32f2f',
  'Mexicana',
  true,
  true,
  false,
  48,
  21,
  11.5
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 9: Insert catering_categories for Aurorita
-- ============================================================================
INSERT INTO catering_categories (id, catering_restaurant_id, name, display_order, is_active) VALUES
  ('c2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'Most Popular', 0, true),
  ('c2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 'Aperitivos', 1, true),
  ('c2000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000001', 'Antojitos Mexicanos', 2, true),
  ('c2000000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000001', 'Especialidades de Aurorita', 3, true),
  ('c2000000-0000-0000-0000-000000000005', 'a2000000-0000-0000-0000-000000000001', 'Margaritas y Bebidas', 4, true),
  ('c2000000-0000-0000-0000-000000000006', 'a2000000-0000-0000-0000-000000000001', 'Burritos', 5, true),
  ('c2000000-0000-0000-0000-000000000007', 'a2000000-0000-0000-0000-000000000001', 'Famosas Fajitas', 6, true),
  ('c2000000-0000-0000-0000-000000000008', 'a2000000-0000-0000-0000-000000000001', 'Carnes Estilo Aurorita', 7, true),
  ('c2000000-0000-0000-0000-000000000009', 'a2000000-0000-0000-0000-000000000001', 'Enchiladas', 8, true),
  ('c2000000-0000-0000-0000-000000000010', 'a2000000-0000-0000-0000-000000000001', 'Combinaciones', 9, true),
  ('c2000000-0000-0000-0000-000000000011', 'a2000000-0000-0000-0000-000000000001', 'Del Mar', 10, true),
  ('c2000000-0000-0000-0000-000000000012', 'a2000000-0000-0000-0000-000000000001', 'Vegetariano', 11, true),
  ('c2000000-0000-0000-0000-000000000013', 'a2000000-0000-0000-0000-000000000001', 'Ordenes Adicionales', 12, true),
  ('c2000000-0000-0000-0000-000000000014', 'a2000000-0000-0000-0000-000000000001', 'Para Niños', 13, true),
  ('c2000000-0000-0000-0000-000000000015', 'a2000000-0000-0000-0000-000000000001', 'Postres', 14, true),
  ('c2000000-0000-0000-0000-000000000016', 'a2000000-0000-0000-0000-000000000001', 'Bebidas no Alcoholicas', 15, true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 10: Insert ALL catering_menu_items for Aurorita (128 items)
-- ============================================================================
INSERT INTO catering_menu_items (
  id, catering_restaurant_id, catering_category_id, name, description, 
  price, selling_unit, serves, image_url, is_active, display_order
) VALUES
  -- Most Popular (4 items)
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 
   'Ensalada Nortena', 'Ensalada con lechuga, tomate, aguacate, queso blanco, pimiento verde y cebolla.', 16.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/1419.jpg', true, 0),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 
   'Margarita Escarchada Pequena (7oz)', NULL, 9.75, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/1398.png', true, 1),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 
   'Chalupa (Cerdo o Pollo)', 'Tortilla suave de maiz, gravy tomate, eleccion de carne (cerdo o pollo) y queso del pais molido.', 4.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7666.png', true, 2),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 
   'Orden de Fajitas', 'Filete de res o pollo salteado con cebolla y pimiento verde, acompanado de refrito, guacamole, ensalada (tomate, queso, cilantro y cebolla). y plantillas', 35.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7694.png', true, 3),

  -- Aperitivos (26 items)
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   'Pico de Gallo Grande', 'Tomate, aguacate, cebolla, cilantro y queso, servido con su seleccion de totopos (chips) o tortillas suaves de trigo o maiz.', 19.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/1412.png', true, 0),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   '1/2 Pico de Gallo', 'Tomate, aguacate, cebolla, cilantro y queso, servido con su seleccion de totopos (chips) o tortillas suaves de trigo o maiz.', 11.75, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/1411.png', true, 1),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   '1/2 Chihuahua Especial', 'Tortilla chips, queso mozzarella derretido, chorizo, refrito y jalapeno.', 10.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/1414.png', true, 2),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   'Chihuahua Especial Grande', 'Orden de Nachos con venitas con chorizo y queso derretido.', 12.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/1417.jpg', true, 3),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   'Ensalada Nortena con Pollo', 'Ensalada con lechuga, tomate, aguacate, queso blanco, pimiento verde, cebolla y pollo.', 18.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/1420.png', true, 4),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   'Ensalada Nortena', 'Ensalada con lechuga, tomate, aguacate, queso blanco, pimiento verde y cebolla.', 16.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/1419.jpg', true, 5),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   'Caldo Tlalpeno', 'Caldo de pollo con pedazos de pollo, aguacate, cilantro y cebolla.', 7.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/1409.png', true, 6),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   'Orden de Ajo con Chips', 'Servido con Totopos (Chips).', 8.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/1407.jpg', true, 7),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   'Sopa de Tortilla', 'Caldo de pollo levemente picoso con pedazos de tortilla de maiz y queso.', 9.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/1408.jpg', true, 8),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   'Sopa Poblana', 'Caldo de soya de tortilla con carne al pastor, cebolla y cilantro.', 8.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/1410.png', true, 9),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   'Queso Fundido (Sin Derretir) (Con Chips)', 'Queso blanco, servido con con chorias. Incluye Totopos (Chips).', 14.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/1413.jpg', true, 10),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   'Queso Fundido (sin derretir)', 'Sale sin derretir', 14.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7496.png', true, 11),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   'Sincronizada Carne Asada', 'Queso mozzarella con carne asada (opcion de refrito o guacamole)', 19.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7497.png', true, 12),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   'Sincronizada', 'Queso mozzarella con cerdo o pollo (opcion de refrito o guacamole)', 18.75, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7587.png', true, 13),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   'Orden de Quesadillas (Cerdo o Pollo)', 'Plantilla de su eleccion rellena de queso y carne escogida.', 10.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7588.png', true, 14),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   'Sincronizadas (Res, Carnita o Pastor)', 'Queso mozzarella con opcion de res, carnita o pastor (opcion de refrito o guacamole)', 21.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7589.png', true, 15),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   '1/2 Fiesta Mexicana (Pollo, Cerdo o Res)', 'Tortilla chips, queso mozzarella derretido, chorizo, refrito, lechuga, tomate, sour cream y jalapeno opcional.', 14.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7590.png', true, 16),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   'Orden de Quesadillas (Carnitas, Res o Pastor)', 'Plantilla de su eleccion rellena de queso y carne escogida.', 12.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7591.png', true, 17),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   'Fiesta Mexicana (Pollo, Cerdo o Res)', 'Tortilla chips, queso mozzarella derretido, chorizo, refrito, lechuga, tomate, sour cream y jalapeno opcional.', 17.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7592.jpg', true, 18),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   'Ensalada Nortena con Carnitas o Pastor', 'Lechuga, tomate, pimiento verde, cebolla, aguacate, queso y aderezo de la casa.', 20.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7593.jpg', true, 19),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   'Orden de Quesadilla queso o queso y bacon', NULL, 8.75, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7594.png', true, 20),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   'Fiesta Mexicanas de Carnitas o Carnitas al Pastor', 'Tortilla chips, queso mozzarella derretido, chorizo, refrito, lechuga, tomate, sour cream y jalapeno opcional.', 20.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7595.png', true, 21),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   '1/2 Fiesta Mexicana (Carnitas o Carne al Pastor)', 'Tortilla chips, queso mozzarella derretido, chorizo, refrito, lechuga, tomate, sour cream y jalapeno opcional.', 16.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7596.png', true, 22),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   '1/2 Chihuahua', 'Tortilla chips con queso mozzarella derretido (no incluye refrito ni jalapeno)', 7.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7597.png', true, 23),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   'Sincronizada de Bacon', 'Queso mozzarella y bacon (opcion de refrito o guacamole)', 16.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7598.png', true, 24),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 
   'Chihuahua', 'Tortilla chips con queso mozzarella derretido (no incluye refrito ni jalapeno)', 10.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7599.jpg', true, 25),

  -- Antojitos Mexicanos (13 items)
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003', 
   '1/2 Refrito', 'Habichuelas majadas con cebolla y chorizo. Se decora con queso del pais molido. Envase 8oz.', 8.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7602.jpg', true, 0),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003', 
   '1/2 Guacamole', 'Aguacate majado, mezclado con tomate, cebolla y cilantro con un top de queso del pais molido. Envase 8 oz', 10.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7603.png', true, 1),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003', 
   'Refrito', 'Habichuelas majadas con cebolla y chorizo. Se decora con queso del pais molido. Envase 13 oz', 9.75, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7605.png', true, 2),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003', 
   'Taco Carne Asada (1)', 'Tortilla suave con carne asada, cebolla y cilantro (no incluye queso)', 6.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7606.png', true, 3),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003', 
   'Taco Original (Carnitas or Res)', 'Tortilla de maiz frita con eleccion de carne (res o carnitas), lechuga y tomate (no incluye queso)', 4.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7607.png', true, 4),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003', 
   'Tostada (Carnitas, Res o Carnitas al Pastor)', 'Tortilla frita de maiz con refrito, seleccion de carne, lechuga, tomate y sour cream.', 8.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7608.png', true, 5),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003', 
   'Tostada Regular', 'Tortilla frita de maiz con refrito, chorizo, lechuga, tomate y sour cream.', 5.75, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7664.png', true, 6),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003', 
   'Tostada (Cerdo o Pollo)', 'Tortilla frita de maiz con refrito, seleccion de carne (cerdo o pollo), lechuga, tomate y sour cream.', 6.75, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7665.png', true, 7),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003', 
   'Chalupa (Cerdo o Pollo)', 'Tortilla suave de maiz, gravy tomate, eleccion de carne (cerdo o pollo) y queso del pais molido.', 4.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7666.png', true, 8),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003', 
   'Taco Suave de Refrito', 'Plantilla suave con refrito, lechuga y tomate. Nuestro refrito incluye chorizo.', 3.75, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7667.png', true, 9),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003', 
   'Combinada de Refrito y Guacamole', 'Vienen en el mismo envase, 13 oz', 16.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7668.png', true, 10),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003', 
   'Guacamole', 'Aguacate majado, mezclado con tomate, cebolla y cilantro con un top de queso del pais molido. Envase 13 oz', 13.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7669.png', true, 11),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003', 
   'Taco Original (Cerdo o Pollo)', 'Tortilla de maiz frita con eleccion de carne (cerdo o pollo), lechuga y tomate (no incluye queso)', 3.75, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/8337.png', true, 12),

  -- Especialidades de Aurorita (7 items)
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000004', 
   'Tres Flautas de (Pollo, Cerdo o Queso)', '3 rollitos fritos rellenos con tu eleccion de carne acompanado de refrito, guacamole, tomate y sour cream.', 16.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7670.png', true, 0),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000004', 
   'Tres Tacos Suaves de Carnitas', 'Con refrito o guacamole dentro de la plantilla (no sale al lado)', 18.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7671.png', true, 1),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000004', 
   'Tacos Al Pastor (3) Refrito y Guacamole', 'Tortilla suave rellena de carne al pastor con refrito y guacamole al lado', 18.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7672.png', true, 2),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000004', 
   'Tres Flautas de Carnitas', 'Refrito, guacamole y crema agria a los lados.', 19.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7673.png', true, 3),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000004', 
   'Taco Pastor Tradicional (1)', NULL, 5.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7674.png', true, 4),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000004', 
   'Chilaquiles (Cerdo Pollo o Carnitas)', NULL, 19.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7675.png', true, 5),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000004', 
   'Huevos Rancheros', '2 huevos fritos sobre plantilla de maiz con gravy de tomate y queso molido, acompanado de refrito y guacamole.', 12.75, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7676.png', true, 6),

  -- Margaritas y Bebidas (9 items)
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000005', 
   'Margarita Escarchada Pequena (7oz)', NULL, 9.75, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/1398.png', true, 0),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000005', 
   'Margarita Escarchada Medium (10oz)', NULL, 14.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/1399.png', true, 1),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000005', 
   'Margarita Escarchada Grande (12oz)', NULL, 16.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/1400.png', true, 2),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000005', 
   'Botella de Margarita (750ML)', NULL, 30.00, 'bottle_750ml', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/1401.jpg', true, 3),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000005', 
   'Margarita Frozen (10oz)', NULL, 10.00, 'each', NULL, NULL, true, 4),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000005', 
   'Margarita Frozen Grande (14oz)', NULL, 14.50, 'each', NULL, NULL, true, 5),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000005', 
   'Copa de Sangria', NULL, 10.25, 'each', NULL, NULL, true, 6),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000005', 
   'Cervezas Locales', 'Selection of local beers including magna, medalla, and diverse ocean brews.', 6.00, 'each', NULL, NULL, true, 7),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000005', 
   'Cervezas Importadas', 'Imported beer selection including Coors Light, Corona, Heineken, Modelo, etc.', 7.50, 'each', NULL, NULL, true, 8),

  -- Burritos (16 items)
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000006', 
   'Burrito Suizo Elefante de (Pollo, Cerdo, Queso o Refrito)', 'Carne de su seleccion, refrito, guacamole, ensalada, queso y crema agria por dentro.', 15.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7678.png', true, 0),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000006', 
   'Burrito Suizo de (Pollo, Cerdo, Queso o Refrito)', 'Carne de su seleccion, refrito. Queso gratinado y gravy de tomate.', 10.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7679.png', true, 1),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000006', 
   'Burrito Suizo Elefante+ de (Pollo, Cerdo, Queso o Refrito)', 'Carne de su seleccion, refrito, guacamole, ensalada, queso y crema agria por dentro. Gravy de tomate y queso gratinado.', 17.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7680.png', true, 2),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000006', 
   'Burrito Azteca Suizo', 'Lleva dentro carne de azteca y por encima gravy de tomate y queso gratinado + refrito y guacamole al lado.', 31.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7681.png', true, 3),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000006', 
   'Burrito Suizo+ de (Res o Carnitas)', 'Lleva dentro seleccion de carne y refrito por dentro.', 12.75, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7682.png', true, 4),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000006', 
   'Burrito Al Pastor Suizo Elefante', 'Relleno de carne al pastor, refrito. guacamole. ensalada. queso y crema. Por fuera gravy de tomate y queso derretido.', 20.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7683.png', true, 5),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000006', 
   'Burrito+ de (Res Carnitas)', 'Lleva dentro refrito y seleccion de carne.', 10.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7684.png', true, 6),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000006', 
   'Burrito Al Pastor Suizo', 'Incluye refrito por dentro + refrito y guacamole al lado.', 16.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7685.png', true, 7),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000006', 
   'Burrito Elefante+ de (Res o Carnitas)', 'Carne de su seleccion, refrito, guacamole, ensalada, queso y crema agria por dentro.', 14.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7686.png', true, 8),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000006', 
   'Burrito Al Pastor', 'Incluye refrito y guacamole al lado.', 14.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7687.png', true, 9),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000006', 
   'Burrito Al Pastor Elefante', 'Incluye refrito, guacamole, ensalada, queso y crema agria por dentro + refrito y guacamole al lado.', 17.75, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7688.png', true, 10),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000006', 
   'Burrito de Pico de Gallo', 'Incluye dentro pico de gallo y al lado refrito y guacamole.', 17.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7689.png', true, 11),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000006', 
   'Burrito Suizo de Pico de Gallo', 'Incluye dentro pico de gallo, gratinado y al lado refrito y guacamole.', 18.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7690.png', true, 12),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000006', 
   'Burrito Azteca (Res o Pollo)', 'Lleva dentro carne de azteca + refrito y guacamole al lado.', 30.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7691.png', true, 13),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000006', 
   'Burrito Regular de (Pollo, Cerdo, Queso o Refrito)', 'Carne de su seleccion y refrito por dentro.', 9.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7692.png', true, 14),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000006', 
   'Burrito Elefante de (Pollo, Cerdo, Queso o Refrito)', 'Burrito que lleva dentro: refrito, guacamole, ensalada, queso y sour cream.', 13.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7693.png', true, 15),

  -- Famosas Fajitas (6 items)
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000007', 
   'Orden de Fajitas', 'Filete de res o pollo salteado con cebolla y pimiento verde, acompanado de refrito, guacamole, ensalada y plantillas', 35.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7694.png', true, 0),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000007', 
   'Filete Azteca', 'Carne de su seleccion salteada con tomate, cebolla y especias. Tortillas, refrito y guacamole a los lados.', 32.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7695.png', true, 1),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000007', 
   '1/2 Fajitas', 'Filete de res o pollo salteados con cebolla y pimientos, acompanados con refrito, guacamole y tortillas (no incluye ensalada)', 21.75, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7696.png', true, 2),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000007', 
   'Fajitas de Res y Camarones', 'Camarones y filete de res salteados con cebolla y pimientos, acompanados con refrito, guacamole, tortillas y ensalada.', 39.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7697.png', true, 3),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000007', 
   'Fajitas de Res y Pollo', 'Filete de res y pollo salteados con cebolla y pimientos, acompanados con refrito, guacamole, tortillas y ensalada.', 36.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7698.png', true, 4),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000007', 
   'Fajitas de Pollo y Camarones', 'Camarones y pollo salteados con cebolla y pimientos, acompanados con refrito, guacamole, tortillas y ensalada.', 39.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7699.png', true, 5),

  -- Carnes Estilo Aurorita (8 items)
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000008', 
   'Churrasco', NULL, 34.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7700.png', true, 0),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000008', 
   'Carne Asada', 'Acompanada de Refrito, Guacamole y Ensalada', 33.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7701.png', true, 1),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000008', 
   'Pechuga a la Plancha', NULL, 23.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7702.png', true, 2),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000008', 
   'Carne a la Tampiquena', 'Refrito, guacamole 1 rollito de enchilada.', 35.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7703.png', true, 3),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000008', 
   'Chuletas Estilo Hacienda', NULL, 19.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7704.png', true, 4),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000008', 
   'Sirloin Steak', 'Acompanado de Refrito, Guacamole y Ensalada', 29.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7705.png', true, 5),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000008', 
   'Orden de Carnitas', 'Carne de pollo o cerdo al caldero con refrito, guacamole, tortillas y ensalada.', 34.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7706.png', true, 6),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000008', 
   '1/2 Carnitas', 'Carne de pollo o cerdo al caldero con refrito, guacamole, tortillas y ensalada.', 23.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7707.png', true, 7),

  -- Enchiladas (6 items)
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000009', 
   'Enchilada Suiza de Pastor, Res o Carnitas', 'Tortillas de maiz suave, rellena de carne seleccionada con gravy de tomate y queso mozzarella derretido.', 23.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7708.png', true, 0),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000009', 
   'Enchilada Suiza de Cerdo o Pollo', 'Tortillas de maiz suave, rellena de carne seleccionada con gravy de tomate y queso mozzarella derretido.', 21.75, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7709.png', true, 1),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000009', 
   'Enchilada de Chile con Carne de Res, Carnitas o Pastor', 'Tortillas de maiz suave con gravy de tomate, chile con carne y queso mozzarella derretido.', 23.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7710.png', true, 2),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000009', 
   'Enchiladas de Chile con Carne de Cerdo o Pollo', 'Tortillas de maiz suave con gravy de tomate, chile con carne y queso mozzarella derretido.', 21.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7711.png', true, 3),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000009', 
   'Enchilada Entomatada de Cerdo o Pollo', 'Tortillas de maiz suave con gravy de tomate y queso de pais por encima.', 19.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7712.png', true, 4),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000009', 
   'Enchiladas de Entomatada de Carnitas, Res o Pastor', 'Tortillas de maiz suave con gravy de tomate y queso de pais por encima.', 20.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7713.png', true, 5),

  -- Combinaciones (4 items)
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000010', 
   'Combo #1', 'Seleccion de 2 Antojitos - Taco, Tostada', 16.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7714.png', true, 0),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000010', 
   'Combo #2', 'Seleccion de 3 Antojitos - Taco, Tostada, Chalupa', 18.75, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7715.png', true, 1),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000010', 
   'Combo #3', 'Seleccion de 4 Antojitos - Taco, Tostada, Chalupa, Enchilada', 20.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7716.png', true, 2),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000010', 
   'Combo #4', 'Seleccion de 5 Antojitos - Taco, Tostada, Chalupa, Enchilada, Flauta', 22.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/8577.jpg', true, 3),

  -- Del Mar (8 items)
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000011', 
   'Fajitas de Camarones', 'Camarones salteados con cebolla y pimiento verde, acompanado de refrito, guacamole, ensalada y plantillas', 37.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7717.png', true, 0),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000011', 
   'Taco de Pescado (1)', 'Tortilla suave rellena de filete de pescado empanado, repollo y salsa de chipotle-mayo (picante)', 6.75, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7718.png', true, 1),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000011', 
   'Filete de Pescado', 'Grilled fish fillet topped with diced tomatoes, bell peppers and cilantro.', 23.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7719.png', true, 2),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000011', 
   'Fajitas de Camarones y Res', NULL, 39.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7720.png', true, 3),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000011', 
   'Fajitas de Camarones y Pollo', NULL, 39.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7721.png', true, 4),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000011', 
   'Azteca de Camaron', 'Camarones salteados con tomate, cebolla y especias. Tortillas, refrito y guacamole a los lados.', 37.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7722.png', true, 5),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000011', 
   'Ceviche de Pescado', 'Fresh fish marinated in citrus, mixed with diced red onions, cilantro served with crisp tortilla chips.', 18.75, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7723.png', true, 6),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000011', 
   'Orden de (3) Tacos de Pescado', 'Tortilla suave rellena de filete de pescado empanado, repollo y salsa de chipotle-mayo (picante)', 18.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7724.png', true, 7),

  -- Vegetariano (5 items)
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000012', 
   'Orden de Nopales a la Mexicana', 'Sale con refrito aparte', 19.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7725.png', true, 0),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000012', 
   '1/2 Orden de Nopales a la Mexicana', 'Sale con refrito aparte', 16.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7726.png', true, 1),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000012', 
   'Fajitas Vegetariana', 'Vegetales salteados con pimiento y cebolla. Guacamole. Arroz y crema agria a los lados.', 30.75, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7727.png', true, 2),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000012', 
   'Burrito Vegetariano Suizo', 'Arroz, guacamole, queso, lechuga, tomate, crema agria y habichuelas negras a los lados.', 16.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7728.png', true, 3),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000012', 
   'Burrito Vegetariano Regular', 'Arroz, guacamole, queso, lechuga, tomate, crema agria y habichuelas negras a los lados.', 13.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7729.png', true, 4),

  -- Ordenes Adicionales (13 items)
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000013', 
   'Chips', NULL, 3.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7730.png', true, 0),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000013', 
   'Ajo', NULL, 8.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7731.png', true, 1),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000013', 
   'Zanahoria', NULL, 8.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7732.png', true, 2),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000013', 
   'Tortilla', NULL, 3.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7733.png', true, 3),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000013', 
   'Queso Blanco', NULL, 4.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7734.png', true, 4),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000013', 
   'Orden de Jalapeno Molido', NULL, 4.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7735.png', true, 5),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000013', 
   'Crema', NULL, 3.75, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7736.png', true, 6),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000013', 
   'Papas Fritas', NULL, 4.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7737.png', true, 7),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000013', 
   'Gravy de Tomate', NULL, 3.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7738.png', true, 8),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000013', 
   'Papas Rancheras', NULL, 8.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7739.png', true, 9),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000013', 
   'Habichuelas negras', NULL, 5.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7740.png', true, 10),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000013', 
   'Jalapeno', NULL, 8.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7741.png', true, 11),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000013', 
   'Chipotle', NULL, 8.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7742.png', true, 12),

  -- Para Ninos (1 item)
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000014', 
   'Tiritas de Pollo Empanada', 'Con papas fritas.', 11.00, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7743.png', true, 0),

  -- Postres (4 items)
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000015', 
   'Cajeta de Celaya', NULL, 7.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7744.png', true, 0),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000015', 
   'Tres Leches', NULL, 8.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7745.png', true, 1),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000015', 
   'Tierrita', 'De vainilla o chocolate.', 5.50, 'each', NULL, NULL, true, 2),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000015', 
   'Flan (Queso, Coco o Vainilla)', 'Queso, coco o vainilla.', 8.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7747.png', true, 3),

  -- Bebidas no Alcoholicas (9 items)
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000016', 
   'Sodas', 'Latas de 12 oz', 3.25, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7748.png', true, 0),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000016', 
   'Limonada', NULL, 7.25, 'each', NULL, NULL, true, 1),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000016', 
   'Botella Limonada', NULL, 19.50, 'each', NULL, NULL, true, 2),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000016', 
   'Pina Colada Sin Alcohol', NULL, 8.25, 'each', NULL, NULL, true, 3),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000016', 
   'Botella Agua', NULL, 2.50, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7752.png', true, 4),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000016', 
   'Fruit Punch', NULL, 6.75, 'each', NULL, NULL, true, 5),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000016', 
   'Frape', NULL, 8.25, 'each', NULL, NULL, true, 6),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000016', 
   'Limonada Frozen', NULL, 8.25, 'each', NULL, NULL, true, 7),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000016', 
   'Jarritos', 'Fruit Punch, Limon, Mandarina, Pina, Tamarindo', 4.75, 'each', NULL, 
   'https://deliverlogic-common-assets.s3.amazonaws.com/editable/images/food1830/menuitems/7756.png', true, 8)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 11: Insert catering_service_packages for Aurorita
-- ============================================================================
INSERT INTO catering_service_packages (
  id, catering_restaurant_id, name, description, base_price, image_url, is_active, display_order
) VALUES
  ('e2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 
   'Catering Delivery a tu Puerta', '', 22.00, 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/delivwom-1771421812703.jpeg', true, 0),
  ('e2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 
   'Catering Delivery y Montaje Basico', 'Delivery a tu Puerta, llevamos las bandejas a donde las necesites, organizacion basica. Incluye Platos de Coctel, Servilletas y Cubiertos plasticos (25 sets).', 68.00, 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/conferenceroom-1771421441740.jpeg', true, 1),
  ('e2000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000001', 
   'Catering Delivery y Montaje Premium', 'Setup Premium con 1 Mesa, 1 Mantel, 3 Chafing Dishes (Wire) con Sternos, Servilletas y Cubiertos Desechables (25 Sets).', 185.00, 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/pATIOWIRE-1771422836698.jpg', true, 2),
  ('e2000000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000001', 
   'Catering Delivery y Montaje Premium Plus', 'Setup Premium Plus con 2 Mesas, 2 Manteles, 5 Chafing Dishes (Stainless Steel), y Servicio de Mozo por 2 horas.', 325.00, 
   'https://pzhfrrnynldk6m8q.public.blob.vercel-storage.com/supr-1771422340837.jpeg', true, 3)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 12: Insert catering_package_inclusions for Aurorita (14 inclusions)
-- ============================================================================
INSERT INTO catering_package_inclusions (
  id, catering_service_package_id, description, is_active, display_order
) VALUES
  -- Basico inclusions
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000002', 'Servicio Delivery a tu Puerta', true, 0),
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000002', 'Organizacion Basica de Bandejas, Platos, Servilletas y Cubiertos', true, 1),
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000002', 'Recogido de Equipo Rentado (si aplica)', true, 2),
  -- Premium inclusions
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000003', 'Todo en el Paquete Basico +', true, 0),
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000003', '1 Mesa de 6'' con Mantel', true, 1),
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000003', '3 Wire Chafing Dishes con Sternos', true, 2),
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000003', 'Platos, Servilletas y Cubiertos Desechables (25 Sets)', true, 3),
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000003', 'Recogido de los Equipos luego del evento', true, 4),
  -- Premium Plus inclusions
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000004', 'Todo en el Paquete Premium +', true, 0),
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000004', '2 Mesas de 6'' con Manteles', true, 1),
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000004', '5 Chafing Dishes con Sternos', true, 2),
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000004', 'Platos Gruesos Chinet y Cubiertos Desechables Premium', true, 3),
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000004', '1 Mozo por 2 Horas', true, 4),
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000004', 'Recogido del Equipo luego del Evento', true, 5)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 13: Insert catering_package_addons for Aurorita (13 addons)
-- ============================================================================
INSERT INTO catering_package_addons (
  id, catering_service_package_id, name, price, unit_label, is_active, display_order
) VALUES
  -- Delivery addons
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000001', 'Cubiertos Desechables para 10 Personas', 12.00, 'Paquete', true, 0),
  -- Basico addons
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000002', 'Set de Platos, Cubiertos y Servilletas (25)', 15.00, 'Set de 25', true, 0),
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000002', 'Wire Chaffing Dish', 12.00, 'cada uno', true, 1),
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000002', 'Premium Chaffing Dish', 18.00, 'cada uno', true, 2),
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000002', 'Dixie Disposable Paper Plates, 8.5", Multi-Color (50)', 7.00, 'Paquete de 50', true, 3),
  -- Premium addons
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000003', 'Set de Platos, Cubiertos y Servilletas (25)', 15.00, 'Set de 25', true, 0),
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000003', 'Mesa de 6'' Adicional', 30.00, 'por mesa', true, 1),
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000003', 'Manteles para Mesa Adicional', 22.00, 'por mantel', true, 2),
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000003', 'Upgrade a Premium Chaffing Dishes', 12.00, 'por unidad', true, 3),
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000003', 'Mozo', 30.00, 'por hora', true, 4),
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000003', 'Dixie Disposable Paper Plates, 8.5", Multi-Color (50)', 7.00, 'Paquete de 50', true, 5),
  -- Premium Plus addons
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000004', 'Mozo adicional', 35.00, 'por hora', true, 0),
  (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000004', 'Setup de Barra con Bartender (no incluye licores)', 125.00, 'por hora', true, 1)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 14: Insert catering_delivery_zones for Aurorita
-- ============================================================================
INSERT INTO catering_delivery_zones (
  id, catering_restaurant_id, catering_branch_id, min_distance, max_distance, base_fee
) VALUES
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', NULL, 0, 5, 15.00),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', NULL, 5, 10, 25.00),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', NULL, 10, 15, 35.00),
  (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001', NULL, 15, 20, 45.00)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Catering data seeded into sky-flower catering_* tables.
-- Total records inserted:
--   METROPOL:
--   - 1 catering_restaurant
--   - 11 catering_branches
--   - 4 catering_categories
--   - 43 catering_menu_items
--   - 4 catering_service_packages
--   - 11 catering_package_inclusions
--   - 13 catering_package_addons
--   - 4 catering_delivery_zones
--
--   AURORITA:
--   - 1 catering_restaurant
--   - 16 catering_categories (Most Popular, Aperitivos, Antojitos Mexicanos, 
--     Especialidades de Aurorita, Margaritas y Bebidas, Burritos, Famosas Fajitas,
--     Carnes Estilo Aurorita, Enchiladas, Combinaciones, Del Mar, Vegetariano,
--     Ordenes Adicionales, Para Ninos, Postres, Bebidas no Alcoholicas)
--   - 128 catering_menu_items (representative set from teal-ball's 139)
--   - 4 catering_service_packages
--   - 14 catering_package_inclusions (Basico: 3, Premium: 5, Premium Plus: 6)
--   - 13 catering_package_addons (Delivery: 1, Basico: 4, Premium: 6, Premium Plus: 2)
--   - 4 catering_delivery_zones
-- ============================================================================
