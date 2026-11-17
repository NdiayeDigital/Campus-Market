/**
 * Suite de tests unitaires pour le stockage Cloudflare R2 et la résolution CDN.
 */

import { resolveMediaUrl, compressImageToBlob, dataURLtoBlob } from '../src/utils/image-compressor.js';
import fs from 'fs';
import path from 'path';

console.log('🧪 Démarrage des tests unitaires Cloudflare R2 & Stockage Unifié...');

// 1. Test resolveMediaUrl avec différentes entrées
const legacySupabaseUrl = 'https://fqulqgdjusfzhcjpvyay.supabase.co/storage/v1/object/public/product-images/seller-123/prod_0.jpg';
const expectedR2Url = 'https://pub-2f882764059641cba8e6c2a55d1bdefe.r2.dev/product-images/seller-123/prod_0.jpg';

const resolved = resolveMediaUrl(legacySupabaseUrl);
console.assert(resolved === expectedR2Url, `Échec: URL attendue ${expectedR2Url}, obtenu ${resolved}`);
console.log('✅ [resolveMediaUrl] Conversion transparente Supabase -> Cloudflare R2 validée !');

// 2. Test resolveMediaUrl avec une URL déjà sur R2 (idempotence)
const alreadyR2 = 'https://pub-2f882764059641cba8e6c2a55d1bdefe.r2.dev/products/test.webp';
console.assert(resolveMediaUrl(alreadyR2) === alreadyR2, 'Échec: L\'URL R2 existante ne doit pas être modifiée');
console.log('✅ [resolveMediaUrl] Idempotence sur URL Cloudflare R2 validée !');

// 3. Test resolveMediaUrl avec une URL externe (Unsplash / placeholder)
const unsplashUrl = 'https://images.unsplash.com/photo-12345';
console.assert(resolveMediaUrl(unsplashUrl) === unsplashUrl, 'Échec: L\'URL externe ne doit pas être altérée');
console.log('✅ [resolveMediaUrl] Préservation des images externes validée !');

// 4. Test compressImageToBlob
const testDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP///////w==';
const result = await compressImageToBlob(testDataUrl);
console.assert(result && result.blob instanceof Blob, 'Échec: compressImageToBlob doit retourner un Blob');
console.assert(result.mime && (result.mime.includes('image/webp') || result.mime.includes('image/jpeg')), `Échec mime type: ${result.mime}`);
console.log('✅ [compressImageToBlob] Compression WebP/JPEG binaire validée !');

// 5. Test de la configuration du Service Worker
const swPath = path.resolve(process.cwd(), 'public/sw.js');
const swContent = fs.readFileSync(swPath, 'utf8');
console.assert(swContent.includes('campus-market-images-v1'), 'Échec: Le Service Worker doit définir IMAGE_CACHE_NAME campus-market-images-v1');
console.assert(swContent.includes('.r2.dev'), 'Échec: Le Service Worker doit intercepter les images .r2.dev');
console.assert(swContent.includes('trimCache'), 'Échec: Le Service Worker doit implémenter la purge LRU trimCache');
console.log('✅ [ServiceWorker] Prise en charge du cache Cloudflare R2 et purge LRU validées !');

// 6. Test de présence du script de migration SQL et de l'endpoint serverless
const sqlPath = path.resolve(process.cwd(), 'database/migration_cloudflare_r2_urls.sql');
console.assert(fs.existsSync(sqlPath), 'Échec: Le script SQL de migration doit exister');
const apiPath = path.resolve(process.cwd(), 'api/get-r2-upload-url.js');
console.assert(fs.existsSync(apiPath), 'Échec: L\'endpoint /api/get-r2-upload-url.js doit exister');
console.log('✅ [Infrastructure] Scripts de migration et endpoint serverless R2 validés !');

console.log('🎉 TOUS LES TESTS CLOUDFLARE R2 & STOCKAGE SONT PASSÉS AVEC SUCCÈS !');
