// Chamadas da TELA ao servidor de licenças, feitas pelo processo principal do Electron (só Windows).
//
// POR QUE EXISTE: a tela do app abre de um arquivo (file://). O servidor só aceita chamadas de navegador vindas do site
// (CORS com a origem do site), então um fetch direto da tela é barrado antes de sair: a ativação nunca funcionaria.
// O processo principal não é navegador e não passa por essa regra; ele faz a chamada e devolve status e corpo à tela.
//
// O QUE FAZ
//  postar(rota, corpo, cabecalhos): POST {ATLAS_API_URL}{rota}. A tela NÃO escolhe o endereço: a base é fixa (https) e a rota
//    tem de estar em ROTAS. Do que a tela manda, só o cabeçalho X-Atlas-Dispositivo passa. Sem redirecionamento, com timeout,
//    resposta cortada em MAX_RESPOSTA. Devolve { status, corpo } (corpo em texto).
//  Erros (códigos): rota-nao-permitida, corpo-invalido, servidor-indisponivel, sem-conexao.
//
// COMO TESTAR: `node --test app/adaptadores/servidor.teste.cjs`. No Windows: no app instalado, pedir o código de ativação
// tem de fazer o e-mail chegar (antes era barrado e a tela dizia "sem internet").
'use strict'

const ROTAS = ['/ativar/solicitar-codigo', '/ativar/solicitar-codigo-link', '/ativar/confirmar', '/verificar', '/licenca/resumo', '/pagamento/checkout',
  // M33: o notebook busca os pedidos do celular e publica o resultado (e o status das obras, do M30).
  '/celular/sinal', '/celular/resposta', '/celular/projeto', '/celular/referencia', '/status-obras/publicar',
  // M41: avisos no celular do dono (a cota voltou, a obra parou, a obra ficou pronta).
  '/celular/avisar']
const MAX_CORPO = 20_000
const MAX_RESPOSTA = 20_000
// Limites próprios: as telas do protótipo sobem (até 1,5 MB), a foto de referência desce (até ~2,8 MB em base64) e a lista de
// pedidos pode trazer relatos longos. Todo o resto continua no limite pequeno.
const LIMITES = {
  '/celular/projeto': { corpo: 10_500_000, resposta: MAX_RESPOSTA }, // M42: até 10 MB de telas (prototipo-link.ts)
  '/celular/referencia': { corpo: MAX_CORPO, resposta: 3_000_000 },
  '/celular/sinal': { corpo: MAX_CORPO, resposta: 300_000 },
  '/status-obras/publicar': { corpo: 80_000, resposta: MAX_RESPOSTA },
}

function enderecoDaApi(bruto) {
  if (typeof bruto !== 'string' || !bruto) return null
  let u
  try { u = new URL(bruto) } catch { return null }
  if (u.protocol !== 'https:' || u.username || u.password) return null
  return u.toString().replace(/\/+$/, '')
}

/** `deps`: { api (string|null), buscar? (fetch) }. */
function criarServidor({ api = process.env.ATLAS_API_URL, buscar = globalThis.fetch } = {}) {
  return {
    async postar(rota, corpo, cabecalhos) {
      if (typeof rota !== 'string' || !ROTAS.includes(rota)) throw new Error('rota-nao-permitida')
      if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) throw new Error('corpo-invalido')
      let texto
      try { texto = JSON.stringify(corpo) } catch { throw new Error('corpo-invalido') }
      const lim = LIMITES[rota] ?? { corpo: MAX_CORPO, resposta: MAX_RESPOSTA }
      if (typeof texto !== 'string' || texto.length > lim.corpo) throw new Error('corpo-invalido')
      const base = enderecoDaApi(api)
      if (!base || typeof buscar !== 'function') throw new Error('servidor-indisponivel')
      const headers = { 'Content-Type': 'application/json' }
      const disp = cabecalhos && typeof cabecalhos === 'object' ? cabecalhos['X-Atlas-Dispositivo'] : undefined
      if (typeof disp === 'string' && disp && disp.length <= 500 && !/[\r\n]/.test(disp)) headers['X-Atlas-Dispositivo'] = disp
      try {
        const r = await buscar(`${base}${rota}`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(rota === '/celular/projeto' || rota === '/celular/referencia' ? 60_000 : 15_000), headers, body: texto })
        return { status: r.status, corpo: (await r.text()).slice(0, lim.resposta) }
      } catch { throw new Error('sem-conexao') }
    },
  }
}

module.exports = { criarServidor, ROTAS }
