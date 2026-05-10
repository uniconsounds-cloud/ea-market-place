-- ==========================================
-- Add RLS Policies for Deleting Demo Challenges
-- ==========================================

-- 1. Allow the referrer (upline) to delete their downline's demo challenge
-- We check both the direct referrer_id in the table and the fallback referred_by in profiles
DROP POLICY IF EXISTS "Referrers can delete demo challenge" ON public.demo_challenges;
CREATE POLICY "Referrers can delete demo challenge"
    ON public.demo_challenges
    FOR DELETE
    USING (
        auth.uid() = referrer_id
        OR auth.uid() = (SELECT referred_by FROM public.profiles WHERE id = demo_challenges.user_id)
    );

-- 2. Allow system admins to delete any demo challenge
DROP POLICY IF EXISTS "Admins can delete all demo challenges" ON public.demo_challenges;
CREATE POLICY "Admins can delete all demo challenges"
    ON public.demo_challenges
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- 3. (Optional) Allow users to delete their own demo challenge
DROP POLICY IF EXISTS "Users can delete own demo challenge" ON public.demo_challenges;
CREATE POLICY "Users can delete own demo challenge"
    ON public.demo_challenges
    FOR DELETE
    USING (auth.uid() = user_id);
