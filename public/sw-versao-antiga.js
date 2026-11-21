// Carregado pelo service worker (workbox.importScripts em vite.config.ts).
// O service worker antigo guardava o index.html e entregava a versão guardada em toda navegação. Quem já tinha
// visitado o site abria um endereço novo (ex.: /instalar, o link do e-mail) e via a página de vendas antiga.
// O atual não guarda mais a página; este trecho só socorre quem ainda chega com a versão antiga guardada:
// recarrega a aba uma única vez, no mesmo endereço, assim que a versão nova assume.
const MARCA = 'atlas-recarregar-versao-antiga'

async function temPaginaAntigaGuardada() {
  for (const nome of await caches.keys()) {
    if (!nome.startsWith('workbox-precache')) continue
    const guardados = await (await caches.open(nome)).keys()
    if (guardados.some((r) => new URL(r.url).pathname.endsWith('/index.html'))) return true
  }
  return false
}

// Na instalação a versão antiga ainda está inteira no depósito (a limpeza é na ativação): é a hora de olhar.
// A marca fica guardada porque o navegador pode reiniciar o service worker entre instalar e ativar.
self.addEventListener('install', (e) => {
  e.waitUntil(temPaginaAntigaGuardada().then((tem) => (tem ? caches.open(MARCA) : null)).catch(() => null))
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    if (!(await caches.has(MARCA))) return
    await caches.delete(MARCA)
    // Só dá para recarregar uma aba que já é deste service worker.
    await self.clients.claim()
    const abas = await self.clients.matchAll({ type: 'window' })
    // Sem esperar a recarga: o pedido da página passa por este service worker, que só responde depois de
    // terminar de ativar. Esperar aqui trava os dois e a aba fica carregando para sempre.
    for (const aba of abas) aba.navigate(aba.url).catch(() => null)
  })().catch(() => null))
})
