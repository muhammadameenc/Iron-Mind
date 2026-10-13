const CACHE_NAME = "iron-mind-v5-account-workspaces";
const urlsToCache = [
    "./",
    "./index.html",
    "./style.css?v=iron-mind-v5-account-workspaces",
    "./script.js?v=iron-mind-v5-account-workspaces",
    "./manifest.json",
    "./supabase-config.js",
    "./supabase-config.production.js",
    "./supabase-auth.js",
    "./supabase-sync.js?v=iron-mind-task-settings-sync-v1",
    "./workspace-bootstrap.js",
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
const cacheableUrls = new Set(urlsToCache.map(url => new URL(url, self.location.href).href));
const cacheablePaths = new Set(urlsToCache.map(url => new URL(url, self.location.href).pathname));

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
    const requestUrl = new URL(event.request.url);
    if(event.request.method !== "GET" || requestUrl.origin !== self.location.origin || !cacheablePaths.has(requestUrl.pathname)) return;

    event.respondWith(
        fetch(event.request).then(networkResponse => {
            // Cache only the explicit static application assets listed above.
            if(networkResponse?.status === 200 && cacheableUrls.has(event.request.url)){
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
            }
            return networkResponse;
        }).catch(async () => {
            return (await caches.match(event.request)) || caches.match(event.request, { ignoreSearch:true });
        })
    );
});
