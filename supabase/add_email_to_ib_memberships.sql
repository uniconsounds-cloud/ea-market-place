-- Add email column to ib_memberships table
ALTER TABLE ib_memberships ADD COLUMN IF NOT EXISTS email text;
