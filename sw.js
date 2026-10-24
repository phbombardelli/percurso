/*
 * O app que ficou instalado no endereço antigo tem um service worker que
 * guarda a versão velha. Este o substitui: apaga o cache, se desinstala e
 * manda as janelas abertas para o endereço novo, /arena/.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const nome of await caches.keys()) await caches.delete(nome);
      await self.registration.unregister();
      for (const c of await self.clients.matchAll({ type: 'window' })) {
        c.navigate(c.url.replace('/percurso/', '/arena/'));
      }
    })(),
  );
});
