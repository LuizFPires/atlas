// Link provisório do protótipo para o celular (decisão do Luiz em 22/11/2026: servidor do Atlas, secreto, 7 dias).
//
//  publicar(nome, documento): o documento é o protótipo navegável já protegido (montarNavegavel: CSP sem script logo no
//    começo); qualquer outra coisa nem sai do computador. POST {api}/prototipo/link com e-mail e hash do computador; a
//    credencial do dispositivo (do COFRE) vai só no cabeçalho X-Atlas-Dispositivo. Devolve { url, expira_em }; a url TEM de
//    ser https://<site>/p/<token>, senão é erro (nunca um link inventado).
//  abrirWhatsApp(url): só o link que ESTE computador acabou de gerar, sempre por https://wa.me (a tela não escolhe destino).
//
// COMO TESTAR: `node --test app/adaptadores/link-celular.teste.cjs`. No Windows: no protótipo, "Ver no celular" mostra o QR;
// apontar a câmera do celular abre as telas e dá para navegar tocando nos botões.
'use strict'
const { CHAVE_COFRE, enderecoDaApi } = require('./licenca.cjs')

const MAX_DOCUMENTO = 1_500_000
const PROTEGIDO = /^<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'/
const LINK_RE = /^https:\/\/[a-z0-9.-]+\/p\/[A-Za-z0-9_-]{40,64}$/

/** deps: { cofre, hashComputador, api, buscar (fetch), shell (openExternal) }. */
function criarLinkCelular({ cofre, hashComputador, api = process.env.ATLAS_API_URL, buscar = globalThis.fetch, shell }) {
  const gerados = new Set()
  return {
    async publicar(nome, documento) {
      if (typeof documento !== 'string' || documento.length > MAX_DOCUMENTO || !PROTEGIDO.test(documento)) throw new Error('prototipo-invalido')
      const base = enderecoDaApi(api)
      if (!base || typeof buscar !== 'function') throw new Error('servidor-indisponivel')
      let ativ = null
      try {
        const g = JSON.parse((await cofre.ler(CHAVE_COFRE)) || 'null')
        if (g && typeof g.token === 'string' && g.token) ativ = { token: g.token, email: typeof g.email === 'string' ? g.email : '' }
      } catch { /* cofre indisponível */ }
      if (!ativ) throw new Error('link-negado')
      let r, d
      try {
        r = await buscar(`${base}/prototipo/link`, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000),
          headers: { 'Content-Type': 'application/json', 'X-Atlas-Dispositivo': ativ.token },
          body: JSON.stringify({ email: ativ.email, computador_hash: await hashComputador(), nome: String(nome ?? '').slice(0, 60), documento }),
        })
        d = JSON.parse((await r.text()).slice(0, 4096))
      } catch { throw new Error('sem-conexao') }
      if (r.status === 403) throw new Error('link-negado')
      if (r.status === 429) throw new Error('muitos-links')
      if (!r.ok) throw new Error('link-indisponivel')
      if (!d || typeof d.url !== 'string' || !LINK_RE.test(d.url) || typeof d.expira_em !== 'string' || Number.isNaN(Date.parse(d.expira_em))) throw new Error('resposta-estranha')
      gerados.add(d.url)
      return { url: d.url, expira_em: d.expira_em }
    },

    async abrirWhatsApp(url) {
      if (typeof url !== 'string' || !gerados.has(url)) throw new Error('link-desconhecido')
      await shell.openExternal(`https://wa.me/?text=${encodeURIComponent(`Protótipo do meu sistema, feito no Atlas: ${url}`)}`)
    },
  }
}

module.exports = { criarLinkCelular }
