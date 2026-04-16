import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    
    // 1. EARLY EXIT: Skip middleware for all API routes and internal Next.js paths
    // These paths don't need auth session refresh or affiliate tracking in the middleware context.
    // MT5 Sync calls hit /api frequently; skipping them here saves huge CPU.
    if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.includes('.')) {
        return NextResponse.next()
    }

    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set(name, value)
                        response.cookies.set(name, value, options)
                    })
                },
            },
        }
    )

    // 2. Only refresh session for pages that likely need it (Admin, Farm, Dashboard)
    // Avoid running this for every single landing page visit if possible.
    if (pathname.startsWith('/admin') || pathname.startsWith('/farm') || pathname.startsWith('/dashboard')) {
        await supabase.auth.getUser()
    }

    // 3. Referral Tracking Logic
    const refCode = request.nextUrl.searchParams.get('ref');
    if (refCode) {
        response.cookies.set('affiliate_ref', refCode, {
            path: '/',
            maxAge: 60 * 60 * 24 * 30, // 30 days
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
        });
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - .png, .jpg, .jpeg, .gif, .svg, .webp (public images)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
