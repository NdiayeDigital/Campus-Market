/**
 * Suite de tests unitaires pour le mécanisme de repli d'image R2 -> Supabase -> Placeholder.
 */

import { resolveMediaUrl, getFallbackStorageUrl } from '../src/utils/image-compressor.js';

console.log('🧪 Démarrage des tests unitaires Image Fallback (R2 / Supabase)...');

// 1. getFallbackStorageUrl sur URL R2
const r2Url = 'https://pub-2f882764059641cba8e6c2a55d1bdefe.r2.dev/product-images/b8795650-b7f8-4d9d-9b48-5c3648625ccd/1794954194154_avatar.webp';
const expectedSupabase = 'https://fqulqgdjusfzhcjpvyay.supabase.co/storage/v1/object/public/product-images/b8795650-b7f8-4d9d-9b48-5c3648625ccd/1794954194154_avatar.webp';

const fallbackUrl = getFallbackStorageUrl(r2Url);
console.assert(fallbackUrl === expectedSupabase, `Échec: URL attendue ${expectedSupabase}, reçu ${fallbackUrl}`);
console.log('✅ [getFallbackStorageUrl] Conversion R2 -> Supabase Storage validée !');

// 2. getFallbackStorageUrl sur URL Supabase (idempotent / inchangé)
console.assert(getFallbackStorageUrl(expectedSupabase) === expectedSupabase, 'Échec: URL Supabase doit rester inchangée');
console.log('✅ [getFallbackStorageUrl] Idempotence sur URL Supabase validée !');

// 3. getFallbackStorageUrl sur URL externe
const externalUrl = 'https://images.unsplash.com/photo-123';
console.assert(getFallbackStorageUrl(externalUrl) === externalUrl, 'Échec: URL externe doit être conservée');
console.log('✅ [getFallbackStorageUrl] Préservation URL externe validée !');

// 4. getFallbackStorageUrl sur entrée vide ou non-string
console.assert(getFallbackStorageUrl(null) === '', 'Échec: null doit retourner une chaîne vide');
console.assert(getFallbackStorageUrl('') === '', 'Échec: chaîne vide doit retourner une chaîne vide');
console.log('✅ [getFallbackStorageUrl] Robustesse sur entrées nulles/vides validée !');

// 5. Test de réversibilité bidirectionnelle pour médias antérieurs à la migration :
const preMigrationR2Url = 'https://pub-2f882764059641cba8e6c2a55d1bdefe.r2.dev/product-images/b8795650-b7f8-4d9d-9b48-5c3648625ccd/1794800000000_avatar.webp';
const roundtrip = resolveMediaUrl(getFallbackStorageUrl(preMigrationR2Url));
console.assert(roundtrip === preMigrationR2Url, `Échec roundtrip: attendu ${preMigrationR2Url}, reçu ${roundtrip}`);
console.log('✅ [Roundtrip] Réversibilité bidirectionnelle R2 <-> Supabase Storage validée !');

console.log('🎉 TOUS LES TESTS IMAGE FALLBACK SONT PASSÉS AVEC SUCCÈS !');
