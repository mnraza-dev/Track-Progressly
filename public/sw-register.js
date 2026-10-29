if ("serviceWorker" in navigator) {
  const enabled = document.currentScript?.dataset.enabled === "true";
  const isProgresslyWorker = (worker) =>
    worker && new URL(worker.scriptURL).pathname === "/service-worker.js";

  async function configureServiceWorker() {
    if (enabled) {
      await navigator.serviceWorker.register("/service-worker.js", {
        updateViaCache: "none",
      });
      return;
    }
    // Remove the previous catch-all worker and its cached homepage during development.
    const registrations = await navigator.serviceWorker.getRegistrations();
    const controlled = isProgresslyWorker(navigator.serviceWorker.controller);
    await Promise.all(
      registrations
        .filter(
          (registration) =>
            isProgresslyWorker(registration.active) ||
            isProgresslyWorker(registration.waiting) ||
            isProgresslyWorker(registration.installing),
        )
        .map((registration) => registration.unregister()),
    );
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("progressly-"))
          .map((name) => caches.delete(name)),
      );
    }
    if (controlled) window.location.reload();
  }

  if (document.readyState === "complete") {
    void configureServiceWorker().catch(console.error);
  } else {
    window.addEventListener(
      "load",
      () => {
        void configureServiceWorker().catch(console.error);
      },
      { once: true },
    );
  }
}
