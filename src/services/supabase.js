import { createClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) || (typeof process !== 'undefined' && process.env) || {};

const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://fqulqgdjusfzhcjpvyay.supabase.co';
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QiS6HTBjjJo423rgUxdQ5A_A5NySDl7';

/**
 * Client Supabase singleton configuré pour Campus Market.
 * Intègre un fallback direct pour garantir le fonctionnement du build et du runtime (Vercel, dev, tests).
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});

export default supabase;

