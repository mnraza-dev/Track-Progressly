if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((r) => console.log('SW registered:', r.scope))
      .catch((e) => console.error('SW registration failed:', e));
  });
}
