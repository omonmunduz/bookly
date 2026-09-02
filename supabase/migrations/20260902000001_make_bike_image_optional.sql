-- Make bike image_url optional instead of required
-- Migration: 20260902000001_make_bike_image_optional.sql

-- Remove the CHECK constraint that requires image_url
ALTER TABLE bikes DROP CONSTRAINT IF EXISTS bikes_image_url_check;

-- Make image_url nullable
ALTER TABLE bikes ALTER COLUMN image_url DROP NOT NULL;

-- Update comment to reflect change
COMMENT ON COLUMN bikes.image_url IS
  'Photo URL for the bike. Optional - file upload feature coming soon.';

COMMENT ON TABLE bikes IS
  'E-bikes owned by the company. Assets with status tracking, not products for sale.
   Photos are optional for fleet management.';
