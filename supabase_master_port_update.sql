-- Add demo_master_port column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS demo_master_port TEXT;

-- Add a comment to the column for documentation
COMMENT ON COLUMN profiles.demo_master_port IS 'The master port number that this IB/Admin promotes for the Demo Challenge. If null, the system default is used.';
