// Configuration Supabase pour Campus Market
const SUPABASE_URL = 'https://fqulqgdjusfzhcjpvyay.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_QiS6HTBjjJo423rgUxdQ5A_A5NySDl7';

// Initialisation directe du client Supabase
if (window.supabase && typeof window.supabase.createClient === 'function') {
    window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("✅ Supabase connecté avec succès !");
} else {
    console.error("SDK Supabase introuvable sur window.supabase.");
}