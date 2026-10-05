'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loading } from '@/components/ui';
import { SetupNeeded } from '@/components/KitchenShell';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useSession } from './providers';

export default function Home() {
  const { session, initializing } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!initializing) router.replace(session ? '/today' : '/login');
  }, [initializing, session, router]);
  if (!isSupabaseConfigured) return <SetupNeeded />;
  return <Loading message="Opening Bhojan…" />;
}
