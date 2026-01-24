/* eslint-disable no-restricted-globals */
const CACHE_NAME = "monevo-static-v1";
const API_CACHE = "monevo-api-v1";
const CORE_ASSETS = ["/", "/index.html", "/manifest.json", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

const isSameOrigin = (request) => {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch (_) {
    return false;
  }
};

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (!isSameOrigin(event.request)) return;

  const { request } = event;
  const isNavigation = request.mode === "navigate";
  const isAsset = ["script", "style", "image", "font"].includes(
    request.destination
  );

  const isApiRequest =
    isSameOrigin(request) &&
    request.destination === "" &&
    request.headers.get("accept")?.includes("application/json");

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/offline.html"))
        )
    );
    return;
  }

  if (isApiRequest) {
    event.respondWith(
      caches.open(API_CACHE).then((cache) =>
        fetch(request)
          .then((response) => {
            const responseClone = response.clone();
            cache.put(request, responseClone);
            return response;
          })
          .catch(() => cache.match(request))
      )
    );
    return;
  }

  const isMedia =
    request.url.includes("/course_images/") ||
    request.url.includes("/lesson_images/") ||
    request.url.includes("/badges/") ||
    request.url.includes("/uploads/");

  if (isAsset || isMedia) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return response;
        });
      })
    );
  }
});
