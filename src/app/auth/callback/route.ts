import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" is in param, use it as the redirect target
    const next = searchParams.get('next') ?? '/dashboard'

    if (code) {
        const supabase = await createSupabaseServerClient()
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        
        if (!error && data?.user) {
            // Guarantee correct affiliate / mentor binding for OAuth logins (Google, etc.)
            try {
                const cookieStore = await cookies();
                const cookieRef = cookieStore.get('affiliate_ref')?.value;
                const urlRef = searchParams.get('ref');
                const refCode = (urlRef || cookieRef || '').trim();

                if (refCode) {
                    let referrer: any = null;
                    if (refCode.length > 20) {
                        const { data: byId } = await supabase
                            .from('profiles')
                            .select('id, referral_code, email')
                            .eq('id', refCode)
                            .maybeSingle();
                        referrer = byId;
                    }
                    if (!referrer) {
                        const { data: byCode } = await supabase
                            .from('profiles')
                            .select('id, referral_code, email')
                            .eq('referral_code', refCode)
                            .maybeSingle();
                        referrer = byCode;
                    }

                    if (referrer && referrer.id !== data.user.id) {
                        const { data: currentProfile } = await supabase
                            .from('profiles')
                            .select('id, created_at, referred_by')
                            .eq('id', data.user.id)
                            .maybeSingle();

                        // If user is newly registered (within 2 hours) or has no referrer:
                        const isRecent = currentProfile?.created_at
                            ? (Date.now() - new Date(currentProfile.created_at).getTime()) < 2 * 3600 * 1000
                            : true;

                        if (isRecent || !currentProfile?.referred_by) {
                            await supabase
                                .from('profiles')
                                .update({
                                    referred_by: referrer.id
                                })
                                .eq('id', data.user.id);

                            await supabase
                                .from('demo_challenges')
                                .update({ referrer_id: referrer.id })
                                .eq('user_id', data.user.id);
                        }
                    }
                }
            } catch (refErr) {
                console.error('Error binding referral in auth callback:', refErr);
            }

            const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
            const isLocal = origin.includes('localhost')
            if (isLocal) {
                return NextResponse.redirect(`${origin}${next}`)
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${next}`)
            } else {
                return NextResponse.redirect(`${origin}${next}`)
            }
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
