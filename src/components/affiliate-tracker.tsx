'use client';

import { useEffect } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';

export function AffiliateTracker() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  
  useEffect(() => {
    const ref = searchParams.get('ref');
    
    // 1. Check for existing referral data (Sticky Logic)
    const existingCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('affiliate_ref='))
      ?.split('=')[1];
    const existingStorage = typeof window !== 'undefined' ? localStorage.getItem('affiliate_ref') : null;
    const currentRef = existingCookie || existingStorage;

    if (ref) {
      // If we already have a different ref, don't overwrite it automatically 
      // (This prevents switching when clicking multiple links)
      if (currentRef && currentRef !== ref) {
        console.log('Referral exists. Skipping overwrite:', { current: currentRef, ignored: ref });
        return;
      }

      // Set cookie that expires in 30 days
      const expires = new Date();
      expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000));
      document.cookie = `affiliate_ref=${ref};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
      
      // Also store in localStorage as a backup
      localStorage.setItem('affiliate_ref', ref);
      
      console.log('Affiliate reference saved:', ref);

      // If user landed on /register with a ref, redirect to home page 
      // (Preserve requested behavior if this was part of the original design)
      if (pathname === '/register') {
        router.push('/');
      }
    }
  }, [searchParams, pathname, router]);

  return null;
}
