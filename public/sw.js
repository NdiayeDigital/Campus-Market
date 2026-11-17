/**
 * Service Worker PWA optimisé pour Campus Market (v19).
 *
 * STRATÉGIES DE CACHE :
 * 1. SUPABASE API EXCLUSION : Aucune mise en cache HTTP pour *.supabase.co/* (données toujours fraîches en direct).
 * 2. CACHE-FIRST : Polices distantes (Google Fonts, cdnjs FontAwesome) et images locales statiques (/assets/).
 * 3. NETWORK-FIRST (avec fallback offline) : HTML et bundles JS/CSS Vite pour réception immédiate des mises à jour.
 */

const CACHE_NAME = 'campus-market-v25';
const IMAGE_CACHE_NAME = 'campus-market-images-v1';

const STATIC_PRECACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/assets/logo.webp',
    '/assets/placeholder.webp',
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

// Purge LRU pour ne pas saturer l'espace de stockage de l'appareil
async function trimCache(cacheName, maxItems) {
    try {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        if (keys.length > maxItems) {
            await cache.delete(keys[0]);
        }
    } catch {}
}

// Activation : purge immédiate des anciens caches applicatifs (en préservant le cache d'images)
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME && cache !== IMAGE_CACHE_NAME) {
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

    // Ignorer immédiatement les schémas non HTTP/HTTPS (chrome-extension:, moz-extension:, blob:, data:, etc.)
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // RÈGLE 1 : Exclusion stricte des requêtes dynamiques Supabase (Auth, REST, Realtime, Functions)
    const isSupabaseDynamic = (url.hostname.includes('supabase.co') && !url.pathname.includes('/storage/v1/object/public/')) ||
        url.pathname.startsWith('/rest/v1') ||
        url.pathname.startsWith('/auth/v1') ||
        url.pathname.startsWith('/realtime/v1');

    if (isSupabaseDynamic) {
        return; // Requête réseau directe sans interception
    }

    // Ne pas intercepter les requêtes non-GET
    if (request.method !== 'GET') {
        return;
    }

    // RÈGLE 1.5 : CACHE-FIRST pour médias distants (Cloudflare R2 & Supabase Storage Public)
    const isR2Image = url.hostname.includes('.r2.dev') || url.hostname.startsWith('cdn.campusmarket-uidt.com');
    const isSupabasePublicStorage = url.hostname.includes('supabase.co') && url.pathname.includes('/storage/v1/object/public/');

    if (isR2Image || isSupabasePublicStorage) {
        event.respondWith(
            caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(request);
                if (cachedResponse) {
                    return cachedResponse;
                }
                try {
                    const networkResponse = await fetch(request);
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(request, networkResponse.clone()).catch(() => {});
                        trimCache(IMAGE_CACHE_NAME, 150);
                    }
                    return networkResponse;
                } catch {
                    return caches.match('/assets/placeholder.webp');
                }
            })
        );
        return;
    }

    // RÈGLE 2 : CACHE-FIRST pour polices Google Fonts, FontAwesome cdnjs et images statiques
    const isFontOrIcon =
        url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com') ||
        url.hostname.includes('cdnjs.cloudflare.com');

    const isStaticAsset =
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.jpeg') ||
        url.pathname.endsWith('.webp') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.ico') ||
        url.pathname.startsWith('/images/');

    if (isFontOrIcon || isStaticAsset) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, copy).catch((err) => {
                                console.warn('[SW] Cache.put (statique) ignoré:', err?.message);
                            });
                        });
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
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, copy).catch((err) => {
                            console.warn('[SW] Cache.put (network-first) ignoré:', err?.message);
                        });
                    });
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
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch {
            try {
                data = { body: event.data.text() };
            } catch {
                data = {};
            }
        }
    }

    const title = data.title || '🛍️ Nouvelle commande - Campus Market';
    const reference = data.reference || '';
    const isBroadcast = (data.tag && data.tag.startsWith('broadcast-')) || !reference;
    const uniqueTag = reference
        ? `order-${reference.replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now()}`
        : `alert-${Date.now()}`;

    const actionTitle = isBroadcast ? '✨ Découvrir' : '👀 Voir la commande';

    const options = {
        body: data.body || 'Une nouvelle commande vient d\'arriver sur votre boutique !',
        icon: data.icon || '/assets/logo-192x192.png',
        badge: data.badge || '/assets/logo-192x192.png',
        vibrate: [300, 100, 300, 100, 300],
        tag: uniqueTag,
        renotify: true,
        requireInteraction: true,
        silent: false,
        data: {
            url: data.url || (isBroadcast ? '/' : '/#seller'),
            timestamp: Date.now(),
        },
        actions: [
            { action: 'open', title: actionTitle },
        ],
    };

    // RÈGLE ANDROID CHROME CRUCIALE : showNotification doit impérativement être résolu dans event.waitUntil
    event.waitUntil(
        self.registration.showNotification(title, options).catch((err) => {
            console.error('[SW] Erreur showNotification:', err);
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/#seller';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (let client of windowClients) {
                if ('focus' in client) {
                    if ('navigate' in client && targetUrl) {
                        client.navigate(targetUrl);
                    }
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
