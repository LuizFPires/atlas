// M41 — aviso no celular do dono (Web Push, pelo servidor do Atlas). Luiz, 24/11/2026: "não pode ficar no escuro".
// O notebook avisa quando a cota do Claude volta, quando a obra para ou fica pronta. Só vão título e texto curto, com a
// credencial da ativação no cabeçalho (como o link do celular). Nunca trava a obra: sem credencial, sem internet ou sem os
// avisos ligados no celular, só não avisa.
'use strict'
const { CHAVE_COFRE, enderecoDaApi } = require('./licenca.cjs')

const TEXTOS = {
  voltou: (obra) => ({ titulo: 'A obra voltou a trabalhar', texto: `A cota do Claude renovou e a obra ${obra} voltou a trabalhar sozinha.` }),
  parou: (obra, motivo) => ({ titulo: 'A obra parou', texto: `A obra ${obra} parou.${motivo ? ` ${motivo}` : ''} Abra o Atlas: ele mostra o que fazer.` }),
  pronta: (obra) => ({ titulo: 'A obra ficou pronta', texto: `A obra ${obra} ficou pronta. Abra o Atlas para publicar.` }),
}
function textoDoAviso(tipo, obra, motivo) {
  const nome = String(obra || 'sua obra').slice(0, 60)
  const t = (TEXTOS[tipo] || TEXTOS.parou)(nome, motivo ? String(motivo).slice(0, 100) : '')
  return { titulo: t.titulo, texto: t.texto.slice(0, 180) }
}

/** deps: { cofre, hashComputador, api, buscar (fetch) }. */
function criarAvisoCelular({ cofre, hashComputador, api = process.env.ATLAS_API_URL, buscar = globalThis.fetch }) {
  return {
    /** true = o servidor aceitou (mesmo que nenhum celular tenha os avisos ligados). Nunca lança. */
    async avisar(titulo, texto) {
      try {
        const base = enderecoDaApi(api)
        if (!base || typeof buscar !== 'function') return false
        const g = JSON.parse((await cofre.ler(CHAVE_COFRE)) || 'null')
        if (!g || typeof g.token !== 'string' || !g.token) return false
        const r = await buscar(`${base}/celular/avisar`, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
          headers: { 'Content-Type': 'application/json', 'X-Atlas-Dispositivo': g.token },
          body: JSON.stringify({ email: typeof g.email === 'string' ? g.email : '', computador_hash: await hashComputador(), titulo: String(titulo).slice(0, 60), texto: String(texto).slice(0, 180) }),
        })
        return r.ok
      } catch { return false }
    },
  }
}

module.exports = { criarAvisoCelular, textoDoAviso }
