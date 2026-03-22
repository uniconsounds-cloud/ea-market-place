/*
 * auto_deactivate_licenses_cron.sql
 * 
 * This script sets up a PostgreSQL cron-job via the pg_cron extension 
 * to automatically deactivate expired licenses every hour.
 */

-- Ensure the pg_cron extension is enabled 
create extension if not exists pg_cron;

-- Schedule the job to run at minute 0 past every hour
select cron.schedule(
    'deactivate-expired-licenses-hourly', 
    '0 * * * *', 
    $$
        UPDATE public.licenses 
        SET is_active = false 
        WHERE expiry_date < NOW() AND is_active = true;
    $$
);

/*
-- Helpful commands to manage cron jobs in Supabase:
-- View running and scheduled jobs:
   SELECT * FROM cron.job;

-- Unschedule a job (by jobid)
   SELECT cron.unschedule(jobid);
*/
