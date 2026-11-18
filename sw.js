const C = 'planner-v4';
const F = ['./', 'index.html', 'style.css', 'script.js', 'smart.js', 'manifest.json'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(c => c.addAll(F)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== C).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(r => { const copia = r.clone(); caches.open(C).then(c => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request))
  );
});
