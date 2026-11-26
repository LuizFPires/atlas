// M61 — Página de vendas: protótipo com marcações antes de publicar (prototipo/caminho-novo/LC4Pagina). Pedido do Luiz (25/11/2026):
// "mesmo padrão e critério que nós utilizamos na construção do aplicativo, inclusive aproveitando o design system".
//
// O QUE FAZ
//  desenhar / ajustar: o Claude (só leitor) lê o design-system.md e as telas da obra e devolve a página em JSON {html, resumo}.
//    Este adaptador valida (sem <script>/<iframe>/<object>/<embed>, até 300 KB) e grava uma versão IMUTÁVEL em
//    <obra>\vendas\versoes\vNNN\pagina.html (+ versao.json por último). As marcações do cliente (ponto x,y + texto) vão como DADO.
//  aprovar(pasta, chaveTeste): só depois de "Aprovar e publicar". A chave de TESTE do gateway vai DIRETO para as variáveis de produção
//    da Vercel do cliente (`vercel env add`, valor pela entrada padrão), junto com um código do Atlas para a compra de teste
//    (ATLAS_TESTE_TOKEN). Nunca em arquivo, cofre ou log. Depois pede ao Incorporador (linha da obra) a página de verdade a partir de
//    vendas\aprovada.html, e quando a linha termina faz a COMPRA DE TESTE: POST /api/vendas/compra-teste no site, com o código.
//  abrir(pasta, chaveReal): só com a compra de teste ok. Troca para a chave de verdade na Vercel e publica (`vercel deploy --prod`).
// Dinheiro e chaves são SEMPRE do cliente (gateway dele). O Atlas não guarda chave nenhuma.
'use strict'
const fs = require('node:fs')
const crypto = require('node:crypto')
const { caminhoSeguro } = require('../seguro.cjs')
const { pastaAtlas, pastaDaObra, gravarAtomico, lerJson, lerTexto } = require('./obra-fs.cjs')
const { REGRA_CONTEUDO_CLIENTE, blocoDoCliente, extrairJson, garantirSubpasta } = require('./projeto-comum.cjs')

const MAX_HTML = 300_000
const PERIGOSO = /<\s*(script|iframe|object|embed)\b|\son[a-z]+\s*=|javascript:/i
const FASES = ['nada', 'pronta', 'aprovada', 'construindo', 'testando', 'teste-ok', 'teste-falhou', 'abrindo', 'aberta', 'erro']

const htmlSeguro = (h) => typeof h === 'string' && h.length > 20 && h.length <= MAX_HTML && !PERIGOSO.test(h)

/** Stripe: sk_test_/sk_live_ (ou rk_). Asaas: $aact_hmlg_ (sandbox) / $aact_prod_ (de verdade). */
function chaveValida(gateway, modo, chave) {
  if (typeof chave !== 'string' || chave.length > 300 || /\s/.test(chave)) return false
  if (gateway === 'stripe') return (modo === 'teste' ? /^(sk|rk)_test_[A-Za-z0-9]{20,}$/ : /^(sk|rk)_live_[A-Za-z0-9]{20,}$/).test(chave)
  if (gateway === 'asaas') return (modo === 'teste' ? /^\$aact_hmlg_[A-Za-z0-9_=:-]{20,}$/ : /^\$aact_prod_[A-Za-z0-9_=:-]{20,}$/).test(chave)
  return false
}
const VARS = { stripe: { chave: 'STRIPE_SECRET_KEY' }, asaas: { chave: 'ASAAS_API_KEY', ambiente: 'ASAAS_AMBIENTE' } }

const PEDIDO_INCORPORADOR = (gateway) => [
  `Siga o agente incorporador e construa a página de vendas aprovada pelo cliente: vendas/aprovada.html é o desenho APROVADO (mesmo texto e visual; use o design system do app). Rota pública /vendas.`,
  `Cobrança na conta do cliente pelo ${gateway === 'stripe' ? 'Stripe (variável STRIPE_SECRET_KEY)' : 'Asaas (variáveis ASAAS_API_KEY e ASAAS_AMBIENTE: sandbox ou producao)'}, já configurada na Vercel: só leia do ambiente do servidor, nunca grave chave.`,
  'Assinatura confirmada pelo webhook com assinatura conferida; a empresa e o usuário dono nascem só depois do pagamento (ou no plano grátis); cada empresa vê só os dados dela.',
  'Crie também POST /api/vendas/compra-teste: só responde se o cabeçalho x-atlas-teste for igual à variável ATLAS_TESTE_TOKEN E a chave do gateway for de teste; faz uma compra de ponta a ponta no modo de testes do gateway (cria a cobrança, paga com o meio de teste do gateway, espera o aviso, confere que a conta da empresa nasceu e que o e-mail de acesso saiu) e devolve JSON {ok, etapas:[...], erro?}. Com chave de verdade, devolve 404.',
].join(' ')

/** deps: raiz, perguntar(pasta, pedido) (Claude só leitor), vercel(args,{cwd,entrada}), pedirConstrucao(pasta, texto), linhaRodando(pasta),
 *  testar(url, token) -> {ok, etapas, erro?, naoPronto?}, esperar(ms), gerarToken() */
function criarPaginaVendas({ raiz, perguntar, vercel, pedirConstrucao, linhaRodando = () => false, testar, esperar = (ms) => new Promise((r) => setTimeout(r, ms)), gerarToken = () => crypto.randomBytes(32).toString('base64url'), tentativasTeste = 30 }) {
  const trabalhos = new Map()
  const arqEstado = (pasta) => caminhoSeguro(raiz, String(pasta), '.atlas', 'vendas.json')
  const lerEstado = (pasta) => {
    let j = null
    try { j = lerJson(arqEstado(pasta)) } catch { j = null }
    const o = j && typeof j === 'object' ? j : {}
    return { fase: FASES.includes(o.fase) ? o.fase : 'nada', etapas: Array.isArray(o.etapas) ? o.etapas.filter((x) => typeof x === 'string').map((x) => x.slice(0, 80)).slice(0, 10) : [], erro: typeof o.erro === 'string' ? o.erro.slice(0, 200) : null }
  }
  const gravarEstado = (pasta, m) => { pastaAtlas(raiz, String(pasta)); gravarAtomico(arqEstado(pasta), JSON.stringify({ versao: 1, ...lerEstado(pasta), ...m }) + '\n') }
  const dirVersao = (pasta, n) => caminhoSeguro(raiz, String(pasta), 'vendas', 'versoes', `v${String(n).padStart(3, '0')}`)
  const versoes = (pasta) => {
    let nomes = []
    try { nomes = fs.readdirSync(caminhoSeguro(raiz, String(pasta), 'vendas', 'versoes')) } catch { nomes = [] }
    return nomes.map((n) => /^v(\d{3})$/.exec(n)).filter(Boolean).map((m) => Number(m[1])).filter((n) => fs.existsSync(caminhoSeguro(raiz, String(pasta), 'vendas', 'versoes', `v${String(n).padStart(3, '0')}`, 'versao.json'))).sort((a, b) => a - b)
  }
  const atual = (pasta) => {
    const l = versoes(pasta)
    if (!l.length) return null
    const n = l[l.length - 1]
    const dir = dirVersao(pasta, n)
    let resumo = ''
    try { resumo = String((lerJson(`${dir}/versao.json`) || {}).resumo || '').slice(0, 400) } catch { resumo = '' }
    return { versao: n, html: lerTexto(`${dir}/pagina.html`), resumo }
  }
  const lancamento = (pasta) => {
    let j = null
    try { j = lerJson(caminhoSeguro(raiz, String(pasta), '.atlas', 'lancamento.json')) } catch { j = null }
    return j && (j.gateway === 'stripe' || j.gateway === 'asaas') ? j.gateway : null
  }
  const site = (pasta) => {
    let j = null
    try { j = lerJson(caminhoSeguro(raiz, String(pasta), '.atlas', 'no-ar.json')) } catch { j = null }
    return j && typeof j.endereco === 'string' && /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(j.endereco) ? j.endereco : null
  }
  const leia = (pasta, ...p) => { try { return lerTexto(caminhoSeguro(raiz, String(pasta), ...p)).slice(0, 20_000) } catch { return '' } }

  function gravarVersao(pasta, html, resumo) {
    if (!htmlSeguro(html)) throw new Error('pagina-invalida')
    const prox = (versoes(pasta).at(-1) || 0) + 1
    garantirSubpasta(raiz, String(pasta), 'vendas', 'versoes')
    let n = prox
    for (; n < prox + 50; n++) { try { fs.mkdirSync(dirVersao(pasta, n)); break } catch (e) { if (e.code !== 'EEXIST') throw e } }
    const dir = dirVersao(pasta, n)
    fs.writeFileSync(`${dir}/pagina.html`, html, { flag: 'wx' })
    fs.writeFileSync(`${dir}/versao.json`, JSON.stringify({ versao: n, resumo: String(resumo || '').slice(0, 400), criada_em: new Date().toISOString() }) + '\n', { flag: 'wx' })
    gravarEstado(pasta, { fase: 'pronta', erro: null })
  }

  const publico = (pasta) => { const a = atual(pasta); const e = lerEstado(pasta); return { ...e, fase: a ? e.fase : 'nada', versao: a ? a.versao : 0, html: a ? a.html : '', resumo: a ? a.resumo : '' } }

  async function pedir(pasta, texto) {
    const r = extrairJson(await perguntar(String(pasta), texto))
    if (!r || typeof r.html !== 'string') throw new Error('pagina-invalida')
    return r
  }

  async function construirETestar(pasta) {
    const gw = lancamento(pasta)
    try {
      gravarEstado(pasta, { fase: 'construindo', etapas: [], erro: null })
      await pedirConstrucao(pasta, PEDIDO_INCORPORADOR(gw))
      await esperar(15_000)
      for (let i = 0; i < 2880 && linhaRodando(pasta); i++) await esperar(15_000)
      gravarEstado(pasta, { fase: 'testando' })
      const token = trabalhos.get(`${pasta}:token`)
      const url = `${site(pasta)}/api/vendas/compra-teste`
      let r = null
      for (let i = 0; i < tentativasTeste; i++) {
        try { r = await testar(url, token) } catch { r = null }
        if (r && !r.naoPronto) break
        await esperar(60_000)
      }
      if (r && r.ok === true) gravarEstado(pasta, { fase: 'teste-ok', etapas: Array.isArray(r.etapas) ? r.etapas : [] })
      else gravarEstado(pasta, { fase: 'teste-falhou', etapas: r && Array.isArray(r.etapas) ? r.etapas : [], erro: r && typeof r.erro === 'string' ? r.erro : 'a compra de teste não respondeu' })
    } catch { gravarEstado(pasta, { fase: 'erro', erro: 'não consegui construir a página agora' }) } finally { trabalhos.delete(`${pasta}:token`) }
  }

  async function porNaVercel(pasta, nome, valor) {
    const r = await vercel(['env', 'add', nome, 'production', '--force'], { cwd: pastaDaObra(raiz, String(pasta)), entrada: valor, timeoutMs: 60_000 })
    if (r.codigo !== 0) throw new Error('vercel-variaveis')
  }

  return {
    async estado(pasta) { pastaDaObra(raiz, String(pasta)); return publico(pasta) },
    async desenhar(pasta, obraNome) {
      pastaDaObra(raiz, String(pasta))
      const gw = lancamento(pasta)
      if (!gw) throw new Error('sem-lancamento')
      const pedido = [
        'Você é o incorporador do Atlas. Desenhe a PÁGINA DE VENDAS (uma página só, HTML e CSS dentro dela, sem <script>, sem <iframe>, sem fontes ou imagens externas) para vender este sistema a outras empresas.',
        'Use EXATAMENTE o design system do próprio app: leia docs/design-system.md (cores, letras, raios, botões) e as telas em prototipo/ para as fotos de tela (desenhe-as em HTML/CSS).',
        `Seções: título forte, como funciona, preços (Grátis, Mensal, Anual${gw === 'asaas' ? ' — anual em até 10× no cartão e mensal no Pix' : ' — anual à vista, sem Pix na mensalidade'}), dúvidas e botão de assinar. Recebimento: ${gw === 'stripe' ? 'Stripe' : 'Asaas'}.`,
        'Responda SÓ com JSON: {"html":"<!doctype html>...","resumo":"uma frase do que fez"}.',
        `Nome do app (dado): ${String(obraNome || '').slice(0, 60)}`,
      ].join('\n')
      const r = await pedir(pasta, pedido)
      gravarVersao(pasta, r.html, r.resumo)
      return publico(pasta)
    },
    async ajustar(pasta, marcacoes) {
      pastaDaObra(raiz, String(pasta))
      const lista = (Array.isArray(marcacoes) ? marcacoes : []).slice(0, 20)
        .map((m) => ({ x: Math.round(Number(m && m.x) || 0), y: Math.round(Number(m && m.y) || 0), texto: String((m && m.texto) || '').trim().slice(0, 600) }))
        .filter((m) => m.texto)
      if (!lista.length) throw new Error('sem-marcacoes')
      const a = atual(pasta)
      if (!a) throw new Error('sem-pagina')
      const pedido = [
        'Você é o incorporador do Atlas. Ajuste a página de vendas abaixo conforme as marcações do cliente (cada uma tem o ponto em pixels e o que ele quer). Mantenha o design system do app e tudo o que ele não pediu para mudar. Sem <script> e sem <iframe>.',
        REGRA_CONTEUDO_CLIENTE,
        '## Marcações do cliente (dado)',
        ...blocoDoCliente(lista.map((m, i) => `${i + 1}. no ponto (${m.x}, ${m.y}): ${m.texto}`).join('\n'), '(nenhuma)'),
        '## Página atual (dado)',
        ...blocoDoCliente(a.html, '(vazia)'),
        'Responda SÓ com JSON: {"html":"<!doctype html>...","resumo":"o que você mudou, em uma frase"}.',
      ].join('\n')
      const r = await pedir(pasta, pedido)
      gravarVersao(pasta, r.html, r.resumo)
      return publico(pasta)
    },
    /** "Aprovar e publicar": a chave de TESTE vai para a Vercel; o Incorporador constrói; o Atlas faz a compra de teste. Não espera. */
    async aprovar(pasta, chaveTeste) {
      pasta = String(pasta)
      pastaDaObra(raiz, pasta)
      const gw = lancamento(pasta)
      const a = atual(pasta)
      if (!gw || !a) throw new Error('sem-pagina')
      if (!site(pasta)) throw new Error('obra-fora-do-ar')
      if (!chaveValida(gw, 'teste', String(chaveTeste || '').trim())) throw new Error('chave-invalida')
      if (trabalhos.has(pasta)) throw new Error('ja-construindo')
      const token = gerarToken()
      await porNaVercel(pasta, VARS[gw].chave, String(chaveTeste).trim())
      if (VARS[gw].ambiente) await porNaVercel(pasta, VARS[gw].ambiente, 'sandbox')
      await porNaVercel(pasta, 'ATLAS_TESTE_TOKEN', token)
      fs.writeFileSync(caminhoSeguro(raiz, pasta, 'vendas', 'aprovada.html'), a.html)
      gravarEstado(pasta, { fase: 'aprovada', etapas: [], erro: null })
      trabalhos.set(`${pasta}:token`, token)
      const p = construirETestar(pasta).finally(() => trabalhos.delete(pasta))
      trabalhos.set(pasta, p)
      return publico(pasta)
    },
    /** Abrir as vendas de verdade: só com a compra de teste ok. */
    async abrir(pasta, chaveReal) {
      pasta = String(pasta)
      const gw = lancamento(pasta)
      if (lerEstado(pasta).fase !== 'teste-ok' && lerEstado(pasta).fase !== 'aberta') throw new Error('teste-nao-passou')
      if (!gw || !chaveValida(gw, 'real', String(chaveReal || '').trim())) throw new Error('chave-invalida')
      gravarEstado(pasta, { fase: 'abrindo' })
      try {
        await porNaVercel(pasta, VARS[gw].chave, String(chaveReal).trim())
        if (VARS[gw].ambiente) await porNaVercel(pasta, VARS[gw].ambiente, 'producao')
        const d = await vercel(['deploy', '--prod', '--yes'], { cwd: pastaDaObra(raiz, pasta), timeoutMs: 900_000 })
        if (d.codigo !== 0) throw new Error('vercel-deploy')
      } catch (e) { gravarEstado(pasta, { fase: 'teste-ok', erro: 'não consegui abrir as vendas agora' }); throw e }
      gravarEstado(pasta, { fase: 'aberta', erro: null })
      return publico(pasta)
    },
    _esperar: (pasta) => trabalhos.get(String(pasta)),
  }
}

module.exports = { criarPaginaVendas, chaveValida, htmlSeguro, PEDIDO_INCORPORADOR }
