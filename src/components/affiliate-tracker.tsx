'use client';

import { useEffect } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';

export function AffiliateTracker() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      // Set cookie that expires in 30 days
      const expires = new Date();
      expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000));
      document.cookie = `affiliate_ref=${ref};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
      
      // Also store in localStorage as a backup
      localStorage.setItem('affiliate_ref', ref);
      
      console.log('Affiliate reference saved:', ref);

      // If user landed on /register with a ref, redirect to home page as requested
      if (pathname === '/register') {
        router.push('/');
      }
    }
  }, [searchParams, pathname, router]);

  return null;
}
