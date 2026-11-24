// Carregado pelo service worker (workbox.importScripts em vite.config.ts). M41: avisos da obra no celular (Web Push).
// O aviso só traz título, texto curto e o link do app; tocar abre o Atlas (ou traz para a frente se já estiver aberto).
self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = {} }
  const titulo = typeof d.titulo === 'string' && d.titulo ? d.titulo.slice(0, 60) : 'Atlas'
  const texto = typeof d.texto === 'string' ? d.texto.slice(0, 180) : 'Há novidade na sua obra.'
  e.waitUntil(self.registration.showNotification(titulo, { body: texto, icon: '/icon-192.png', badge: '/icon-192.png', data: { url: '/app' }, tag: 'atlas-obra', renotify: true }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const atlas = abertas.find((c) => new URL(c.url).pathname.startsWith('/app'))
    if (atlas) return atlas.focus()
    return self.clients.openWindow('/app')
  })())
})
