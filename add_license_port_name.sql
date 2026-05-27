-- SQL to add port_name to licenses table
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS port_name TEXT;
