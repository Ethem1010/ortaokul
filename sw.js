// Servis çalışanı: uygulamanın dosyalarını telefona kaydeder, böylece
// ilk açılıştan sonra internet olmadan da açılır. Öğrenci verilerine dokunmaz.
// Uygulama dosyalarını güncellediğinizde aşağıdaki sürüm adını değiştirin.

const SURUM = 'ogrenci-takip-v10';
const DOSYALAR = ['./', 'index.html', 'stil.css', 'app.js', 'ikon.png', 'ikon-192.png', 'ikon-512.png', 'manifest.webmanifest'];

self.addEventListener('install', (olay) => {
  olay.waitUntil(caches.open(SURUM).then((c) => c.addAll(DOSYALAR)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (olay) => {
  olay.waitUntil(
    caches.keys()
      .then((adlar) => Promise.all(adlar.filter((a) => a !== SURUM).map((a) => caches.delete(a))))
      .then(() => self.clients.claim())
  );
});

// Önce telefondaki kopyayı ver (hızlı ve internetsiz); internet varsa arka planda yenisini al.
self.addEventListener('fetch', (olay) => {
  const istek = olay.request;
  if (istek.method !== 'GET' || new URL(istek.url).origin !== location.origin) return;
  olay.respondWith(
    caches.open(SURUM).then(async (c) => {
      const kayitli = await c.match(istek, { ignoreSearch: true }) || (istek.mode === 'navigate' ? await c.match('index.html') : undefined);
      const agdan = fetch(istek).then((yanit) => {
        if (yanit.ok) c.put(istek, yanit.clone());
        return yanit;
      }).catch(() => kayitli);
      return kayitli || agdan;
    })
  );
});
