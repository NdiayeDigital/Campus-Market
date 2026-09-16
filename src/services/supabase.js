import { createClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) || (typeof process !== 'undefined' && process.env) || {};
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';

if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
    console.error(
        '❌ [Supabase Service] Configuration manquante ! Vérifiez votre fichier .env.\n' +
        '- VITE_SUPABASE_URL:', supabaseUrl ? 'Défini' : 'MANQUANT', '\n' +
        '- VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Défini' : 'MANQUANT'
    );
}

const finalUrl = supabaseUrl || 'https://placeholder.supabase.co';
const finalKey = supabaseAnonKey || 'placeholder-anon-key';

/**
 * Client Supabase singleton configuré pour Campus Market.
 */
export const supabase = createClient(finalUrl, finalKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});

export default supabase;
