const CACHE_NAME = "progressly-static-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) => name.startsWith("progressly-") && name !== CACHE_NAME,
            )
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Authentication, API calls, page navigations and RSC requests stay on the network.
  if (
    request.method !== "GET" ||
    request.mode === "navigate" ||
    request.cache === "no-store" ||
    url.origin !== self.location.origin ||
    !(
      url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/")
    )
  )
    return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) {
          try {
            await cache.put(request, response.clone());
          } catch {
            /* Storage may be full. */
          }
        }
        return response;
      } catch {
        return new Response("Static asset unavailable offline.", {
          status: 503,
        });
      }
    })(),
  );
});
