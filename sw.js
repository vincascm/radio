var CACHE = 'radio-cache-v1';

var PRECACHE_URLS = [
  '/',
  '/index.html',
  '/radio.json',
  '/static/img/icon.svg'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.map(function(key) {
          if (key !== CACHE) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var fetchPromise = fetch(event.request).then(function(response) {
        if (response && response.ok && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        return cached;
      });
      return cached || fetchPromise;
    })
  );
});
