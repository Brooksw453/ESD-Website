/* ============================================
   Service Worker — Offline cache for PWA
   Cache-first for static assets,
   network-first for pages
   ============================================ */

const CACHE_NAME = 'es-designs-v29';
const CORE_ASSETS = [
    '/',
    '/index.html',
    '/css/variables.css',
    '/css/reset.css',
    '/css/base.css',
    '/css/layout.css',
    '/css/components.css',
    '/css/animations.css',
    '/css/pages.css',
    '/css/education.css',
    '/css/responsive.css',
    '/js/app.js',
    '/js/music-player.js',
    '/js/router.js',
    '/js/particles.js',
    '/js/scroll-animations.js',
    '/js/contact-widget.js',
    '/js/analytics.js',
    '/pages/landing.html',
    '/pages/elliptical.html',
    '/pages/vr.html',
    '/pages/vr-anatomy-physiology.html',
    '/pages/education.html',
    '/pages/education-courses.html',
    '/pages/education-demos.html',
    '/pages/education-ally-pro.html',
    '/pages/education-audit.html',
    '/pages/education-wcag-course.html',
    '/js/supabase-client.js',
    '/pages/about.html',
    '/pages/privacy.html',
    '/manifest.json',
    '/assets/images/brand/favicon.svg',
    '/assets/images/brand/esd-logo.png'
];

// Install: cache core assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
    );
    self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: network-first for pages, stale-while-revalidate for static assets
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Audio files: network-only (too large to cache, streaming works better)
    if (url.pathname.startsWith('/assets/audio/')) return;

    // Static assets (CSS, JS, images, fonts): stale-while-revalidate.
    // Serve the cached copy instantly for speed, but always refetch in the
    // background and update the cache, so a deploy is picked up on the next
    // load WITHOUT needing a CACHE_NAME bump. (Cache-first previously pinned
    // returning visitors to stale CSS/JS until the cache name changed.)
    if (url.pathname.match(/\.(css|js|png|jpg|jpeg|svg|webp|woff2?)$/)) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) =>
                cache.match(event.request).then((cached) => {
                    const networked = fetch(event.request).then((response) => {
                        if (response && response.ok) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    }).catch(() => cached);
                    // Fresh if we have no cached copy; otherwise cached now +
                    // fresh next time.
                    return cached || networked;
                })
            )
        );
        return;
    }

    // HTML pages: network-first with cache fallback
    event.respondWith(
        fetch(event.request).then((response) => {
            if (response.ok) {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
        }).catch(() => caches.match(event.request))
    );
});
