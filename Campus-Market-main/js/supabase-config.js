// Configuration Supabase pour Campus Market
const SUPABASE_URL = 'https://lhrhxgorlynczwbmfwbt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_mO782vIBENNmrtNsIGiImQ_ubow6b7j';

// Initialisation globale du client Supabase
if (SUPABASE_URL !== 'VOTRE_SUPABASE_URL') {
    // On écrase l'objet global supabase par l'instance du client
    window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.warn("Supabase n'est pas encore configuré. L'application est en mode attente.");
}
