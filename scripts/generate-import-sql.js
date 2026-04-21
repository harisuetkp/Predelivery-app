import fs from 'fs';
import path from 'path';

// Read the JSON file
const jsonPath = path.join(process.cwd(), 'data/foodnet_all_menus.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Generate SQL for restaurants
const restaurantInserts = [];
const categoryInserts = [];
const itemInserts = [];
const optionInserts = [];
const choiceInserts = [];

function escapeString(str) {
  if (!str) return 'NULL';
  return `'${str.replace(/'/g, "''").replace(/\n/g, ' ').trim()}'`;
}

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

data.forEach((entry, index) => {
  const restaurant = entry.restaurant;
  const slug = generateSlug(restaurant.name);
  
  restaurantInserts.push(`
    INSERT INTO restaurants (name, slug, is_active, pickup_enabled, delivery_enabled, tax_rate, show_in_marketplace, primary_color)
    VALUES (${escapeString(restaurant.name)}, ${escapeString(slug)}, true, true, true, 0.115, true, '#d00169')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id;
  `);
  
  // Categories
  entry.categories?.forEach((category, catIndex) => {
    categoryInserts.push({
      restaurantSlug: slug,
      name: category.name,
      description: category.description,
      sortOrder: catIndex,
      items: category.items || []
    });
  });
});

// Output statistics
console.log(`Restaurants: ${restaurantInserts.length}`);
console.log(`Categories: ${categoryInserts.length}`);

// Output first restaurant SQL for testing
console.log('\n--- Sample Restaurant SQL ---');
console.log(restaurantInserts[0]);
