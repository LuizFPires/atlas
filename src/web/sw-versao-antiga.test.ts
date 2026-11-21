// O service worker antigo guardava o index.html e entregava a versão guardada em toda navegação:
// quem já tinha visitado o site abria /instalar (link do e-mail) e via a página de vendas.
// public/sw-versao-antiga.js recarrega, uma única vez, as abas de quem ainda está com essa versão guardada.
import codigo from '../../public/sw-versao-antiga.js?raw'

type Ouvinte = (e: { waitUntil(p: Promise<unknown>): void }) => void

/** Sobe o script com um service worker de mentira e devolve como disparar os eventos e o que foi recarregado. */
function montar(guardado: Record<string, string[]>) {
  const depositos = new Map(Object.entries(guardado).map(([nome, urls]) => [nome, new Set(urls)]))
  const ouvintes: Record<string, Ouvinte> = {}
  const recarregadas: string[] = []
  let reivindicou = false
  const caches = {
    keys: async () => [...depositos.keys()],
    open: async (nome: string) => {
      if (!depositos.has(nome)) depositos.set(nome, new Set())
      const d = depositos.get(nome)!
      return { keys: async () => [...d].map((url) => ({ url })), put: async (url: string) => { d.add(url) } }
    },
    has: async (nome: string) => depositos.has(nome),
    delete: async (nome: string) => depositos.delete(nome),
  }
  const self = {
    addEventListener: (tipo: string, f: Ouvinte) => { ouvintes[tipo] = f },
    clients: {
      claim: async () => { reivindicou = true },
      matchAll: async () => [
        { url: 'https://atlas.test/instalar?t=abc', // No navegador, a recarga só termina DEPOIS que a ativação acaba (o pedido da página passa pelo service worker,
        // que ainda está ativando). Por isso aqui ela nunca termina: quem esperar por ela trava, igual ao navegador.
        navigate: (u: string) => { if (!reivindicou) return Promise.reject(new Error('aba ainda não é deste service worker')); recarregadas.push(u); return new Promise<void>(() => {}) } },
      ],
    },
  }
  new Function('self', 'caches', 'Response', codigo)(self, caches, class { })
  const disparar = async (tipo: string) => {
    const esperas: Promise<unknown>[] = []
    ouvintes[tipo]?.({ waitUntil: (p) => { esperas.push(p) } })
    const travou = Symbol('travou')
    const fim = await Promise.race([Promise.all(esperas), new Promise((r) => setTimeout(() => r(travou), 200))])
    if (fim === travou) throw new Error(`o evento ${tipo} ficou esperando a recarga da aba: a ativação nunca termina e a página fica carregando para sempre`)
  }
  return { disparar, recarregadas, depositos }
}

const PRECACHE = 'workbox-precache-v2-https://atlas.test/'

test('quem tem a página antiga guardada: a aba é recarregada sozinha, no mesmo endereço', async () => {
  const sw = montar({ [PRECACHE]: ['https://atlas.test/index.html?__WB_REVISION__=abc', 'https://atlas.test/assets/index-1.js'] })
  await sw.disparar('install')
  await sw.disparar('activate')
  expect(sw.recarregadas).toEqual(['https://atlas.test/instalar?t=abc'])
})

test('recarrega uma vez só: na ativação seguinte não mexe mais na aba', async () => {
  const sw = montar({ [PRECACHE]: ['https://atlas.test/index.html?__WB_REVISION__=abc'] })
  await sw.disparar('install')
  await sw.disparar('activate')
  await sw.disparar('activate')
  expect(sw.recarregadas).toHaveLength(1)
})

test('visitante novo, ou quem já está na versão nova: nenhuma aba é recarregada', async () => {
  const novo = montar({})
  await novo.disparar('install')
  await novo.disparar('activate')
  expect(novo.recarregadas).toEqual([])

  const atual = montar({ [PRECACHE]: ['https://atlas.test/assets/index-2.js', 'https://atlas.test/icon-192.png'] })
  await atual.disparar('install')
  await atual.disparar('activate')
  expect(atual.recarregadas).toEqual([])
})

test('a marca sobrevive se o service worker for reiniciado entre instalar e ativar', async () => {
  const guardado = { [PRECACHE]: ['https://atlas.test/index.html?__WB_REVISION__=abc'] }
  const antes = montar(guardado)
  await antes.disparar('install')
  // Reinício: o script sobe de novo, sem memória, mas com o que ficou guardado.
  const depois = montar(Object.fromEntries([...antes.depositos].map(([n, s]) => [n, [...s]])))
  await depois.disparar('activate')
  expect(depois.recarregadas).toEqual(['https://atlas.test/instalar?t=abc'])
})
