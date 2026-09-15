/**
 * Service Worker PWA optimisé pour Campus Market (v19).
 *
 * STRATÉGIES DE CACHE :
 * 1. SUPABASE API EXCLUSION : Aucune mise en cache HTTP pour *.supabase.co/* (données toujours fraîches en direct).
 * 2. CACHE-FIRST : Polices distantes (Google Fonts, cdnjs FontAwesome) et images locales statiques (/assets/).
 * 3. NETWORK-FIRST (avec fallback offline) : HTML et bundles JS/CSS Vite pour réception immédiate des mises à jour.
 */

const CACHE_NAME = 'campus-market-v19';

const STATIC_PRECACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/assets/logo.webp',
    '/assets/logo-192x192.png',
    '/assets/logo-512x512.png',
];

// Installation : préchargement du squelette minimal
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pré-mise en cache des assets statiques de base');
            return cache.addAll(STATIC_PRECACHE).catch((err) => {
                console.warn('[SW] Pré-cache partiel:', err);
            });
        })
    );
    self.skipWaiting();
});

// Activation : purge immédiate des anciens caches obsolètes
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[SW] Suppression ancien cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Interception réseau intelligente
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // RÈGLE 1 : Exclusion stricte de toutes les requêtes Supabase (Auth, REST, Storage, Realtime)
    if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/rest/v1')) {
        return; // Requête réseau directe sans interception
    }

    // Ne pas intercepter les requêtes non-GET
    if (request.method !== 'GET') {
        return;
    }

    // RÈGLE 2 : CACHE-FIRST pour polices Google Fonts, FontAwesome cdnjs et images statiques
    const isFontOrIcon =
        url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com') ||
        url.hostname.includes('cdnjs.cloudflare.com');

    const isStaticAsset =
        url.pathname.startsWith('/assets/') ||
        url.pathname.startsWith('/images/') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.webp') ||
        url.pathname.endsWith('.svg');

    if (isFontOrIcon || isStaticAsset) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return networkResponse;
                }).catch(() => caches.match('/assets/logo.webp'));
            })
        );
        return;
    }

    // RÈGLE 3 : NETWORK-FIRST pour HTML et bundles JS/CSS de Vite
    // Priorité au réseau pour servir le code déployé le plus récent, avec repli cache si hors-ligne
    event.respondWith(
        fetch(request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const copy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                }
                return networkResponse;
            })
            .catch(async () => {
                const cached = await caches.match(request);
                if (cached) {
                    return cached;
                }
                // Si navigation HTML hors-ligne, retourner l'index.html mis en cache
                if (request.mode === 'navigate' || request.destination === 'document') {
                    return (await caches.match('/index.html')) || (await caches.match('/'));
                }
                return new Response('Ressource hors-ligne indisponible', { status: 503, statusText: 'Offline' });
            })
    );
});

// Notifications Push
self.addEventListener('push', (event) => {
    if (event.data) {
        try {
            const data = event.data.json();
            const options = {
                body: data.body,
                icon: '/assets/logo-192x192.png',
                badge: '/assets/logo-192x192.png',
                vibrate: [200, 100, 200],
                data: {
                    url: data.url || '/',
                },
            };
            event.waitUntil(self.registration.showNotification(data.title, options));
        } catch {
            // Ignorer
        }
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((windowClients) => {
            for (let client of windowClients) {
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
