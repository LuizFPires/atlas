// Verificação de licença no processo principal — o SEGUNDO portão do pós-obra (src/app/ponte-posobra.ts → criarLicencaApi é o primeiro,
// na tela). Espelha em CommonJS a regra de criarLicencaApi: POST {api}/verificar com o e-mail da compra e o hash do computador; o token
// do dispositivo (segredo) vem do COFRE (nunca de arquivo) e viaja só no cabeçalho X-Atlas-Dispositivo.
//
// FAIL-CLOSED: só `pode_construir === true` com `motivo === 'ok'` libera. Sem endereço da API, sem ativação no cofre, erro de rede,
// timeout, redirecionamento, resposta grande/estranha ou qualquer dúvida => { ok:false }. O endereço da API vem de ATLAS_API_URL
// (definido pelo instalador/ambiente do app, NUNCA da tela) e precisa ser https sem usuário/senha. Sem redirect (fetch redirect:'error').
//
// COMO TESTAR: `node --test app/adaptadores/*.teste.cjs` (posobra.teste.cjs simula fetch e cofre). No Windows: com ATLAS_API_URL
// apontando para o servidor de licenças, ativar o app e pedir uma mudança no pós-obra; licença em pausa => o pedido não executa.
'use strict'

const CHAVE_COFRE = 'atlas/dispositivo' // igual a CHAVE_COFRE de src/app/ativacao-api.ts
const MAX_RESPOSTA = 20_000

function enderecoDaApi(bruto) {
  if (typeof bruto !== 'string' || !bruto) return null
  let u
  try { u = new URL(bruto) } catch { return null }
  if (u.protocol !== 'https:' || u.username || u.password) return null
  return u.toString().replace(/\/+$/, '')
}

/** `deps`: { cofre, hashComputador (async () => hex), api (string|null), buscar? (fetch) }. */
function criarLicenca({ cofre, hashComputador, api = process.env.ATLAS_API_URL, buscar = globalThis.fetch, esperar = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  return {
    /** O e-mail da licença (o do dono): para criar o acesso dele ao sistema que publicou. null se não houver. */
    async email() {
      try {
        const bruto = await cofre.ler(CHAVE_COFRE)
        const g = bruto ? JSON.parse(bruto) : null
        return g && typeof g.email === 'string' && g.email ? g.email : null
      } catch { return null }
    },
    async verificar() {
      const base = enderecoDaApi(api)
      if (!base || typeof buscar !== 'function') return { ok: false, motivo: 'indisponivel' }
      let ativ = null
      try {
        const bruto = await cofre.ler(CHAVE_COFRE)
        const g = bruto ? JSON.parse(bruto) : null
        if (g && typeof g.token === 'string' && g.token) ativ = { token: g.token, email: typeof g.email === 'string' ? g.email : '' }
      } catch { /* cofre indisponível = sem licença */ }
      if (!ativ) return { ok: false, motivo: 'negado' }
      // Servidor que pisca (sem internet por um instante, erro 5xx) não é licença negada: tenta 3 vezes (27/11/2026).
      for (let i = 0; ; i++) {
        let r
        try {
          r = await buscar(`${base}/verificar`, {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
            headers: { 'Content-Type': 'application/json', 'X-Atlas-Dispositivo': ativ.token },
            body: JSON.stringify({ email: ativ.email, computador_hash: await hashComputador() }),
          })
        } catch { r = null }
        if (!r || (typeof r.status === 'number' && r.status >= 500)) {
          if (i >= 2) return { ok: false, motivo: 'sem-conexao' }
          await esperar(2000)
          continue
        }
        let texto = ''
        try { texto = await r.text() } catch { return { ok: false, motivo: 'sem-conexao' } }
        if (!r.ok || texto.length > MAX_RESPOSTA) return { ok: false, motivo: 'negado' }
        let d = null
        try { d = JSON.parse(texto) } catch { /* resposta estranha */ }
        if (d && d.pode_construir === true && d.motivo === 'ok') return { ok: true }
        return { ok: false, motivo: 'negado' }
      }
    },
  }
}

module.exports = { criarLicenca, enderecoDaApi, CHAVE_COFRE }
