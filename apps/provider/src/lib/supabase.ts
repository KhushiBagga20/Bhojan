'use client';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@bhojan/shared';

// Accept the dashboard's "REST URL" (…/rest/v1/) as well: the client adds that path itself.
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/rest\/v1$/, '');
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = url.startsWith('http') && key.length > 20;

/**
 * The dashboard talks to Supabase from the browser. Every query runs as the
 * signed-in provider, and Row Level Security limits it to their own kitchen.
 */
export const supabase = createClient<Database>(
  isSupabaseConfigured ? url : 'http://localhost:54321',
  key || 'not-configured',
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  },
);
