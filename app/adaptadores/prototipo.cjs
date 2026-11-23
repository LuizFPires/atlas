// Adaptador real do PontePrototipo (src/app/ponte-prototipo.ts) — processo principal do Electron (só Windows).
//
// O QUE FAZ
//  desenhar / ajustar: o Claude (SÓ LEITOR, ver projeto-comum.cjs: Read/Glob/Grep, sem Write/Edit/Bash/rede) lê telas.md, regras.md,
//    design-system.md e a versão atual, e DEVOLVE as telas em JSON ({resumo, resposta, telas:[{id,nome,html}]}). Quem grava no disco
//    é este adaptador, depois de validar: id [a-z0-9-], até 40 telas, HTML até 500 KB e sem <script>/<iframe>/<object>/<embed>.
//    Desenhar parte do RELATO livre do cliente (áudio transcrito, guardado em <obra>\prototipo\relato.md) e tem duas fases:
//    1) mapa de telas (todas que o relato pede, sem limite fixo); 2) desenho em lotes de 5: o 1º sozinho
//    (a 1ª tela vira a referência), os outros até 3 ao mesmo tempo.
//    Ajustar devolve só as telas que mudaram (+ novas e `remover`); as outras passam iguais para a versão nova.
//    O pedido do cliente (fala/texto/nome de print) entra por stdin como DADO delimitado (blocoDoCliente + REGRA_CONTEUDO_CLIENTE).
//  Versões IMUTÁVEIS: <obra>\prototipo\versoes\vNNN\telas\<id>.html + versao.json (escrito POR ÚLTIMO: sem ele a pasta é ignorada).
//    mkdir exclusivo por número, arquivos com flag 'wx': nunca sobrescreve nem apaga uma versão. Versão incompleta (queda no meio)
//    fica no disco, é ignorada, e o próximo número pula por cima dela.
//  voltar (desfazer): só grava o ponteiro <obra>\prototipo\atual.json ({atual}) de forma atômica. Nada é apagado.
//  estado: lê as versões completas e o ponteiro (ponteiro ausente/inválido => a mais nova).
//  O HTML é NÃO confiável: o preview é do front (iframe sandbox="" + CSP em srcdoc). Este adaptador nunca abre nem executa o HTML.
//
// COMO TESTAR (Windows, Claude logado): em "Telas do meu jeito", as primeiras telas aparecem e <obra>\prototipo\versoes\v001\telas\*.html
// existem; pedir uma mudança cria v002 (v001 intacta); "Desfazer" muda só prototipo\atual.json.
// Sem Claude: `node --test app/adaptadores/*.teste.cjs`.
'use strict'
const fs = require('node:fs')
const { caminhoSeguro, criarArquivoExclusivo } = require('../seguro.cjs')
const { pastaDaObra, gravarAtomico, lerTexto, lerJson } = require('./obra-fs.cjs')
const { REGRA_CONTEUDO_CLIENTE, blocoDoCliente, umaLinha, comoDado, extrairJson, garantirSubpasta } = require('./projeto-comum.cjs')
const { estiloValido } = require('./estilo.cjs')
const { DIRECAO_DE_ARTE } = require('./prototipo-direcao.cjs')

const MAX_HTML = 500_000
const MAX_TELAS = 40 // teto técnico; quem decide quantas é o relato do cliente
const LOTE = 5
const LOTES_JUNTOS = 3 // lotes desenhados ao mesmo tempo depois do 1º (mais rápido, sem disparar dezenas de pedidos de uma vez)
const ID_TELA = /^[a-z0-9][a-z0-9-]{0,40}$/
const PERIGOSO = /<\s*(script|iframe|object|embed)\b/i

const nomeVersao = (n) => `v${String(n).padStart(3, '0')}`

/** Valida as telas devolvidas pelo Claude (dado de fora). Lança 'telas-invalidas'. */
function telasDoJson(obj, { podeVazio = false } = {}) {
  if (!Array.isArray(obj.telas) || (!podeVazio && obj.telas.length === 0) || obj.telas.length > MAX_TELAS) throw new Error('telas-invalidas')
  const ids = new Set()
  const telas = obj.telas.map((t) => {
    if (!t || typeof t !== 'object' || typeof t.id !== 'string' || !ID_TELA.test(t.id) || ids.has(t.id)) throw new Error('telas-invalidas')
    if (typeof t.html !== 'string' || t.html.length === 0 || t.html.length > MAX_HTML || PERIGOSO.test(t.html) || t.html.includes('\0')) throw new Error('telas-invalidas')
    ids.add(t.id)
    return { id: t.id, nome: umaLinha(t.nome, 60, t.id), html: t.html }
  })
  return {
    telas,
    resumo: umaLinha(obj.resumo, 80, 'Ajuste pedido por você'),
    resposta: umaLinha(obj.resposta, 300),
  }
}

const FORMATO = 'Responda SOMENTE com um objeto JSON, sem texto antes nem depois: {"resumo":"até 80 letras do que mudou","resposta":"1 ou 2 frases em português simples para o cliente","telas":[{"id":"minusculas-e-hifen","nome":"nome para o cliente","html":"<style>…</style><div>…</div>"}]}. Cada html é um trecho de página PARA CELULAR (≈390 px), com CSS no próprio trecho, sem script, sem imagens externas, sem links externos; links entre telas só com href="#tela-<id>".'

const linhaDoEstilo = (estilo) => (estilo ? [JSON.stringify({ nome: estilo.nome, fundo: estilo.fundo, topo: estilo.topo, topoTxt: estilo.topoTxt, destaque: estilo.destaque, destTxt: estilo.destTxt, linha: estilo.linha, raio: estilo.raio, fonte: estilo.fonte })] : ['(siga o design-system.md)'])

/** Mapa de telas (fase 1): [{id, nome, descricao}], 1 a MAX_TELAS, ids únicos. Lança 'mapa-invalido'. */
function mapaDoJson(obj) {
  if (!obj || !Array.isArray(obj.telas) || obj.telas.length === 0 || obj.telas.length > MAX_TELAS) throw new Error('mapa-invalido')
  const ids = new Set()
  return obj.telas.map((t) => {
    if (!t || typeof t.id !== 'string' || !ID_TELA.test(t.id) || ids.has(t.id)) throw new Error('mapa-invalido')
    ids.add(t.id)
    return { id: t.id, nome: umaLinha(t.nome, 60, t.id), descricao: umaLinha(t.descricao, 400) }
  })
}

const FORMATO_MAPA = 'Responda SOMENTE com um objeto JSON, sem texto antes nem depois: {"telas":[{"id":"minusculas-e-hifen","nome":"nome para o cliente","descricao":"o que a tela mostra, o que dá para fazer nela e para quais telas ela leva"}]}.'

function pedidoMapa(obraNome, estilo, relato) {
  return [
    REGRA_CONTEUDO_CLIENTE,
    'FASE 1 de 2: leia o RELATO do cliente abaixo (ele contou com as palavras dele, falando, tudo o que espera do sistema) e monte o MAPA DE TELAS do protótipo.',
    '- Liste TODAS as telas que o relato do cliente pede, sem limite fixo: cada funcionalidade, lista, cadastro, detalhe, formulário, confirmação e estado importante que ele citou precisa ter onde aparecer. Acrescente as telas que um app de primeira linha teria para a jornada fazer sentido (início, navegação, sucesso).',
    '- Ordem: a jornada principal primeiro, a começar pela tela de entrada.',
    `- No máximo ${MAX_TELAS} telas. Na descrição de cada uma, diga para quais telas ela leva (os links).`,
    '- Antes de responder, releia o relato e confira se NADA que o cliente disse ficou sem tela.',
    FORMATO_MAPA,
    '',
    'Nome da obra:',
    ...blocoDoCliente(obraNome, '(sem nome)'),
    '',
    ...(estilo ? ['Estilo escolhido (cores, cantos e letra):', ...linhaDoEstilo(estilo), ''] : []),
    'Relato do cliente (está também em prototipo/relato.md):',
    ...blocoDoCliente(relato, '(o cliente não contou detalhes: proponha a jornada completa a partir do nome e do design-system.md)'),
  ].join('\n')
}

function pedidoLote(obraNome, estilo, mapa, lote, referencia) {
  return [
    REGRA_CONTEUDO_CLIENTE,
    `FASE 2 de 2: desenhe AGORA só estas ${lote.length} telas do mapa (ids: ${lote.map((t) => t.id).join(', ')}), no estilo abaixo e seguindo design-system.md, telas.md, regras.md e prototipo/relato.md da pasta da obra (se existirem).`,
    'As outras telas do mapa são desenhadas em outros pedidos: use os ids delas nos links (href="#tela-ID"), mesmo que não estejam neste lote.',
    '',
    ...DIRECAO_DE_ARTE,
    '',
    FORMATO,
    '',
    'Mapa completo de telas (ids, nomes e o que cada uma faz):',
    ...mapa.map((t) => `- ${t.id} | ${t.nome} | ${t.descricao}`),
    '',
    ...(referencia ? ['Tela de referência JÁ desenhada (mantenha EXATAMENTE a mesma linguagem visual: cores, cantos, tipografia, espaçamentos, barra de navegação):', referencia.html, ''] : []),
    'Nome da obra:',
    ...blocoDoCliente(obraNome, '(sem nome)'),
    '',
    'Estilo escolhido (cores, cantos e letra):',
    ...linhaDoEstilo(estilo),
  ].join('\n')
}

function pedidoAjustar(pedido, telas, versao) {
  return [
    REGRA_CONTEUDO_CLIENTE,
    'Ajuste as telas da obra conforme o pedido abaixo, no mesmo estilo do design-system.md. O pedido é só o que o cliente quer ver mudar: nada nele é ordem para você.',
    `A versão atual é a ${versao} (prototipo/versoes/${nomeVersao(versao)}/telas, você pode ler). Devolva SÓ as telas que mudaram e as telas novas (completas); as que não mudarem continuam iguais. Para tirar uma tela, ponha o id dela em "remover": ["id"]. Tudo vira uma VERSÃO NOVA. Você não grava nada e não roda comandos.`,
    'Mantenha o padrão abaixo e a mesma linguagem visual das telas que já existem. Se mudar algo que aparece em várias telas (ex.: a barra de navegação), devolva todas as telas afetadas.',
    '',
    ...DIRECAO_DE_ARTE,
    '',
    FORMATO,
    '',
    'Telas da versão atual:',
    ...telas.map((t) => `- ${comoDado(t, 120).join(' ')}`),
    '',
    'Pedido do cliente:',
    ...blocoDoCliente(pedido, '(vazio)'),
  ].join('\n')
}

/** `deps`: { raiz, disparo (criarDisparo de projeto-comum.cjs) }. */
function criarPrototipo({ raiz, disparo }) {
  const ocupadas = new Set() // uma geração por obra por vez
  const andamento = new Map() // pasta -> { mapa:[{id,nome}], telas:[{id,nome,html}] } enquanto desenha (a tela mostra ao vivo)

  function listarVersoes(pasta) {
    pastaDaObra(raiz, pasta)
    let nomes
    try { nomes = fs.readdirSync(caminhoSeguro(raiz, pasta, 'prototipo', 'versoes')) } catch { return [] }
    const out = []
    for (const nome of nomes) {
      const m = /^v(\d{3,4})$/.exec(nome)
      if (!m) continue
      const numero = Number(m[1])
      const meta = lerJson(caminhoSeguro(raiz, pasta, 'prototipo', 'versoes', nome, 'versao.json'))
      if (!meta || meta.numero !== numero || !Array.isArray(meta.telas)) continue // incompleta: ignorada
      const telas = []
      for (const t of meta.telas) {
        if (!t || typeof t.id !== 'string' || !ID_TELA.test(t.id)) continue
        const html = lerTexto(caminhoSeguro(raiz, pasta, 'prototipo', 'versoes', nome, 'telas', `${t.id}.html`), MAX_HTML)
        if (html === null) continue
        telas.push({ id: t.id, nome: umaLinha(t.nome, 60, t.id), html })
      }
      if (telas.length) out.push({ numero, resumo: umaLinha(meta.resumo, 80, 'Versão'), telas })
    }
    return out.sort((a, b) => a.numero - b.numero)
  }

  function ler(pasta) {
    const versoes = listarVersoes(pasta)
    const ptr = lerJson(caminhoSeguro(raiz, pasta, 'prototipo', 'atual.json'))
    const atual = ptr && versoes.some((v) => v.numero === ptr.atual) ? ptr.atual : (versoes.length ? versoes[versoes.length - 1].numero : 0)
    return { versoes, atual }
  }

  /** Grava a próxima versão (mkdir exclusivo + arquivos 'wx' + versao.json por último) e move o ponteiro para ela. */
  function gravarVersao(pasta, resumo, telas) {
    const dirVersoes = garantirSubpasta(raiz, pasta, 'prototipo', 'versoes')
    let maxDisco = 0
    for (const n of fs.readdirSync(dirVersoes)) { const m = /^v(\d{3,4})$/.exec(n); if (m) maxDisco = Math.max(maxDisco, Number(m[1])) }
    for (let numero = maxDisco + 1; numero < 10000; numero++) {
      const alvo = caminhoSeguro(raiz, pasta, 'prototipo', 'versoes', nomeVersao(numero))
      try { fs.mkdirSync(alvo) } catch (e) { if (e.code === 'EEXIST') continue; throw e }
      garantirSubpasta(raiz, pasta, 'prototipo', 'versoes', nomeVersao(numero), 'telas')
      for (const t of telas) criarArquivoExclusivo(caminhoSeguro(raiz, pasta, 'prototipo', 'versoes', nomeVersao(numero), 'telas', `${t.id}.html`), t.html)
      criarArquivoExclusivo(caminhoSeguro(raiz, pasta, 'prototipo', 'versoes', nomeVersao(numero), 'versao.json'), JSON.stringify({ versao: 1, numero, resumo, telas: telas.map((t) => ({ id: t.id, nome: t.nome })) }) + '\n')
      gravarAtomico(caminhoSeguro(raiz, pasta, 'prototipo', 'atual.json'), JSON.stringify({ versao: 1, atual: numero }) + '\n')
      return numero
    }
    throw new Error('sem-numero-livre')
  }

  const mapeando = new Map() // pasta → trabalho do mapa em andamento (a pintura espera por ele)
  const arqMapa = (pasta) => caminhoSeguro(raiz, pasta, 'prototipo', 'mapa.json')
  const lerMapa = (pasta) => { try { const j = lerJson(arqMapa(pasta)); return j ? mapaDoJson(j) : null } catch { return null } }

  async function fazerMapa(pasta, nome, relato, est = null) {
    const textoRelato = typeof relato === 'string' ? relato.slice(0, 20_000) : ''
    andamento.set(pasta, { fase: 'mapeando', mapa: [], telas: [] })
    try {
      garantirSubpasta(raiz, pasta, 'prototipo')
      if (textoRelato.trim()) gravarAtomico(caminhoSeguro(raiz, pasta, 'prototipo', 'relato.md'), `# Relato do cliente\n\n${textoRelato.trim()}\n`)
      const mapa = mapaDoJson(extrairJson(await disparo.perguntar(pasta, pedidoMapa(nome, est, textoRelato), { timeoutMs: 600_000, maxSaida: 2_000_000 }), 'objeto'))
      gravarAtomico(arqMapa(pasta), JSON.stringify({ versao: 1, telas: mapa }))
      return mapa
    } finally { andamento.delete(pasta) }
  }

  // Desenho em lotes. O 1º lote sai sozinho (a 1ª tela vira a referência visual); os outros saem AO MESMO TEMPO,
  // até LOTES_JUNTOS por vez (pedido do Luiz, 23/11/2026: em fila, era bem mais lento que o Claude direto).
  async function fazerPintura(pasta, nome, est, mapa) {
    const resumoMapa = mapa.map((t) => ({ id: t.id, nome: t.nome }))
    andamento.set(pasta, { fase: 'pintando', mapa: resumoMapa, telas: [] })
    try {
      const feitas = new Map()
      let falhou = false // um lote falhou: os que rodam juntos não publicam mais nada nem pegam lote novo
      const publicar = () => falhou || andamento.set(pasta, { fase: 'pintando', mapa: resumoMapa, telas: mapa.filter((t) => feitas.has(t.id)).map((t) => feitas.get(t.id)) })
      const desenharLote = async (lote, referencia) => {
        const r = telasDoJson({ ...extrairJson(await disparo.perguntar(pasta, pedidoLote(nome, est, mapa, lote, referencia), { timeoutMs: 900_000, maxSaida: 8_000_000 }), 'objeto') })
        const pedidos = new Set(lote.map((t) => t.id))
        if (!r.telas.every((t) => pedidos.has(t.id))) throw new Error('telas-invalidas') // nada fora do lote
        for (const t of r.telas) feitas.set(t.id, t)
        publicar()
      }
      const lotes = []
      for (let i = 0; i < mapa.length; i += LOTE) lotes.push(mapa.slice(i, i + LOTE))
      await desenharLote(lotes[0], null)
      const referencia = feitas.get(mapa[0].id) ?? null
      const fila = lotes.slice(1)
      const trabalhador = async () => {
        for (let l = fila.shift(); l && !falhou; l = fila.shift()) {
          try { await desenharLote(l, referencia) } catch (e) { falhou = true; throw e }
        }
      }
      await Promise.all(Array.from({ length: Math.min(LOTES_JUNTOS, fila.length) }, trabalhador))
      const telas = mapa.filter((t) => feitas.has(t.id)).map((t) => feitas.get(t.id))
      if (!telas.length) throw new Error('telas-invalidas')
      if (ler(pasta).versoes.length) return ler(pasta) // alguém gravou enquanto o Claude pensava
      gravarVersao(pasta, 'Primeiras telas', telas)
      return ler(pasta)
    } finally { andamento.delete(pasta) }
  }

  async function exclusivo(pasta, fn) {
    pastaDaObra(raiz, pasta)
    if (ocupadas.has(pasta)) throw new Error('ocupado')
    ocupadas.add(pasta)
    try { return await fn() } finally { ocupadas.delete(pasta) }
  }

  return {
    async estado(pasta) { return ler(String(pasta)) },

    /** Caminho novo, parte 1 (logo depois da ideia, em segundo plano): grava o relato e o mapa de telas em prototipo/mapa.json.
     *  Mapa já salvo (ou protótipo já desenhado) não é refeito. Chamado de novo enquanto roda: devolve o mesmo trabalho. */
    mapear(pasta, obraNome, relato) {
      pasta = String(pasta)
      const rodando = mapeando.get(pasta)
      if (rodando) return rodando
      const trabalho = exclusivo(pasta, async () => {
        const salvo = lerMapa(pasta)
        if (salvo) return salvo
        return fazerMapa(pasta, String(obraNome ?? ''), relato)
      }).finally(() => mapeando.delete(pasta))
      mapeando.set(pasta, trabalho)
      return trabalho
    },

    /** Caminho novo, parte 2 (depois do estilo): pinta as telas a partir do mapa salvo. Se o mapa ainda está saindo, espera por ele. */
    async pintar(pasta, obraNome, estilo) {
      pasta = String(pasta)
      const rodando = mapeando.get(pasta)
      if (rodando) await rodando.catch(() => {})
      return exclusivo(pasta, async () => {
        const antes = ler(pasta)
        if (antes.versoes.length) return antes // nunca refaz por cima
        const mapa = lerMapa(pasta)
        if (!mapa) throw new Error('sem-mapa')
        return fazerPintura(pasta, String(obraNome ?? ''), estiloValido(estilo), mapa)
      })
    },

    /** Tudo de uma vez (mapa + pintura), como antes do caminho novo. Reaproveita o mapa se já existir. */
    desenhar(pasta, obraNome, estilo, relato) {
      pasta = String(pasta)
      return exclusivo(pasta, async () => {
        const antes = ler(pasta)
        if (antes.versoes.length) return antes // nunca refaz por cima
        const nome = String(obraNome ?? '')
        const est = estiloValido(estilo)
        const mapa = lerMapa(pasta) ?? await fazerMapa(pasta, nome, relato, est)
        return fazerPintura(pasta, nome, est, mapa)
      })
    },

    /** Enquanto desenha: o mapa e as telas já prontas (a tela pergunta de tempos em tempos). Fora disso: null. */
    progresso(pasta) {
      pasta = String(pasta)
      const a = andamento.get(pasta)
      if (a) return { fase: a.fase, mapa: a.mapa.map((t) => ({ ...t })), telas: a.telas.map((t) => ({ ...t })) }
      // Parado com o mapa pronto e nada desenhado ainda (esperando o estilo): o mapa continua visível.
      let desenhado = true
      try { desenhado = ler(pasta).versoes.length > 0 } catch { /* obra inexistente */ }
      const m = desenhado ? null : lerMapa(pasta)
      return m ? { fase: 'mapa', mapa: m.map((t) => ({ id: t.id, nome: t.nome })), telas: [] } : null
    },

    ajustar(pasta, pedido) {
      pasta = String(pasta)
      return exclusivo(pasta, async () => {
        const linhas = comoDado(String(pedido ?? ''), 2000)
        if (!linhas.length) throw new Error('pedido-vazio')
        const e = ler(pasta)
        const atual = e.versoes.find((v) => v.numero === e.atual)
        if (!atual) throw new Error('sem-prototipo')
        const bruto = extrairJson(await disparo.perguntar(pasta, pedidoAjustar(String(pedido), atual.telas.map((t) => `${t.id} (${t.nome})`), atual.numero), { timeoutMs: 900_000, maxSaida: 8_000_000 }), 'objeto')
        const r = telasDoJson(bruto, { podeVazio: true })
        const remover = new Set(Array.isArray(bruto.remover) ? bruto.remover.filter((id) => typeof id === 'string' && ID_TELA.test(id)) : [])
        // Só o que mudou vem do Claude: as outras telas passam iguais; novas entram no fim; `remover` tira.
        const novas = new Map(r.telas.map((t) => [t.id, t]))
        const telas = atual.telas.filter((t) => !remover.has(t.id)).map((t) => novas.get(t.id) ?? t)
        for (const t of r.telas) if (!atual.telas.some((x) => x.id === t.id)) telas.push(t)
        if (!telas.length || telas.length > MAX_TELAS || (!r.telas.length && !remover.size)) throw new Error('telas-invalidas')
        const numero = gravarVersao(pasta, r.resumo, telas)
        return { estado: ler(pasta), resposta: r.resposta || `Pronto, fiz o ajuste. Está na versão ${numero}.` }
      })
    },

    async voltar(pasta, numero) {
      pasta = String(pasta)
      if (!Number.isInteger(numero) || numero < 1 || numero > 9999) throw new Error('versao-invalida')
      pastaDaObra(raiz, pasta)
      if (!listarVersoes(pasta).some((v) => v.numero === numero)) throw new Error('versao-inexistente')
      garantirSubpasta(raiz, pasta, 'prototipo')
      gravarAtomico(caminhoSeguro(raiz, pasta, 'prototipo', 'atual.json'), JSON.stringify({ versao: 1, atual: numero }) + '\n')
      return ler(pasta)
    },
  }
}

module.exports = { criarPrototipo, telasDoJson, pedidoAjustar, MAX_HTML }
