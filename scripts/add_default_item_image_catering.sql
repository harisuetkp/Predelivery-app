-- Add default item placeholder image support for catering restaurants (additive)
ALTER TABLE catering_restaurants
ADD COLUMN default_item_image_url TEXT;

