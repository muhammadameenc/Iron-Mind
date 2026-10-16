const CACHE_NAME = "iron-mind-v3-equations";
const urlsToCache = [
    "./",
    "./index.html",
    "./style.css?v=iron-mind-v3-equations",
    "./script.js?v=iron-mind-v3-equations",
    "./manifest.json",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./vendor/mathlive/mathlive.min.js",
    "./vendor/mathlive/mathlive-fonts.css",
    "./vendor/mathlive/mathlive-static.css",
    "./vendor/mathlive/fonts/KaTeX_AMS-Regular.woff2",
    "./vendor/mathlive/fonts/KaTeX_Caligraphic-Bold.woff2",
    "./vendor/mathlive/fonts/KaTeX_Caligraphic-Regular.woff2",
    "./vendor/mathlive/fonts/KaTeX_Fraktur-Bold.woff2",
    "./vendor/mathlive/fonts/KaTeX_Fraktur-Regular.woff2",
    "./vendor/mathlive/fonts/KaTeX_Main-Bold.woff2",
    "./vendor/mathlive/fonts/KaTeX_Main-BoldItalic.woff2",
    "./vendor/mathlive/fonts/KaTeX_Main-Italic.woff2",
    "./vendor/mathlive/fonts/KaTeX_Main-Regular.woff2",
    "./vendor/mathlive/fonts/KaTeX_Math-BoldItalic.woff2",
    "./vendor/mathlive/fonts/KaTeX_Math-Italic.woff2",
    "./vendor/mathlive/fonts/KaTeX_SansSerif-Bold.woff2",
    "./vendor/mathlive/fonts/KaTeX_SansSerif-Italic.woff2",
    "./vendor/mathlive/fonts/KaTeX_SansSerif-Regular.woff2",
    "./vendor/mathlive/fonts/KaTeX_Script-Regular.woff2",
    "./vendor/mathlive/fonts/KaTeX_Size1-Regular.woff2",
    "./vendor/mathlive/fonts/KaTeX_Size2-Regular.woff2",
    "./vendor/mathlive/fonts/KaTeX_Size3-Regular.woff2",
    "./vendor/mathlive/fonts/KaTeX_Size4-Regular.woff2",
    "./vendor/mathlive/fonts/KaTeX_Typewriter-Regular.woff2",
    "./vendor/mathlive/LICENSE.txt"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            }).then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(cacheName => cacheName !== CACHE_NAME)
                    .map(cacheName => caches.delete(cacheName))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // Network-first strategy to always get latest updates
            return fetch(event.request).then(networkResponse => {
                // Update the cache with the new response
                if (networkResponse && networkResponse.status === 200 && event.request.method === "GET") {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Fallback to cache if network fails
                return cachedResponse;
            });
        })
    );
});
