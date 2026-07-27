const CACHE_NAME = "iron-mind-v2";
const urlsToCache = [
    "./",
    "./index.html",
    "./style.css?v=iron-mind-v2",
    "./script.js?v=iron-mind-v2",
    "./manifest.json",
    "./icons/icon-192.png",
    "./icons/icon-512.png"
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
