// Testar a ideia (protótipo caminho-novo/TI1TestarIdeia.dc.html; aprovado pelo Luiz em 28/11/2026). Um termômetro, NÃO uma
// pesquisa de mercado: centenas de agentes de IA, cada um com um perfil diferente tirado do briefing, olham o protótipo e dizem
// se usariam, quanto pagariam e por quê. Inspirado no MiroFish (personas + rodadas de conversa + relatório), mas rodando no
// Claude do próprio cliente, sem chave nem conta nova.
//
// COMO FUNCIONA (parte 1: o motor)
//  1. entender: UMA pergunta ao Claude lê o briefing e o texto das telas e devolve o resumo do produto e as categorias do
//     público (profissões, cidades, tamanho do negócio, o que usa hoje). Idade, celular, dinheiro e jeito são fixos aqui.
//  2. agentes: o PROGRAMA sorteia os agentes, espalhando cada categoria por igual e sem duas pessoas iguais (nome e idade
//     também saem daqui, não do Claude). Pode reaproveitar os agentes de um teste anterior ("mesmos agentes").
//  3. olhar: lotes de 20 agentes por pergunta; cada um responde usaria/não/dúvida, quanto pagaria, o motivo e uma frase.
//     Resposta que falta ou vem torta NÃO é inventada: o agente fica "sem resposta" e sai das contas.
//  4. relatorio: as contas (porcentagens, preço, mapa por tipo) são feitas AQUI; o Claude só agrupa os motivos em temas
//     (devolvendo os ids de quem disse) e sugere ideias para o protótipo ligadas aos temas fracos.
//  Cada passo grava em .atlas/testes/<n>/ (checkpoint): se a cota do Claude acabar ('claude-cota'), o teste pausa e retoma
//  de onde parou. As instruções dos agentes ficam AQUI no app, nunca no disco do cliente.
//
// COMO TESTAR: `node --test app/adaptadores/testar-ideia.teste.cjs`. No Windows: abrir uma obra com protótipo → Testar a
// ideia → 100 agentes; o teste anda sozinho e no fim abre o relatório.
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { pastaDaObra, gravarAtomico, lerTexto } = require('./obra-fs.cjs')
const { REGRA_CONTEUDO_CLIENTE, blocoDoCliente, umaLinha, extrairJson } = require('./projeto-comum.cjs')

const QUANTIDADES = [100, 250, 500, 1000]
const LOTE = 20
const RODADAS = 6
const LOTE_CONVERSA = 15
const ACOES = new Set(['postar', 'comentar', 'discutir', 'nada'])
const FIXOS = {
  Idade: ['18 a 29', '30 a 44', '45 a 59', '60 ou mais'],
  'Uso de celular': ['Usa de tudo', 'Só WhatsApp e banco', 'Quase não usa'],
  Dinheiro: ['Aperta no fim do mês', 'Dá para investir um pouco', 'Tem folga'],
  Jeito: ['Animado', 'Apressado', 'Detalhista', 'Desconfiado'],
}
const IDADES = { '18 a 29': [18, 29], '30 a 44': [30, 44], '45 a 59': [45, 59], '60 ou mais': [60, 74] }
const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Edson', 'Fábio', 'Gisele', 'Hélio', 'Iara', 'João', 'Kátia', 'Luís', 'Marta', 'Nelson', 'Olga', 'Paulo', 'Rita', 'Sérgio', 'Tânia', 'Vítor', 'Wesley', 'Zélia', 'Alex', 'Bia', 'Caio', 'Denise', 'Elaine', 'Fernando', 'Gustavo', 'Heloísa', 'Igor', 'Jéssica', 'Kleber', 'Larissa', 'Márcio', 'Natália', 'Otávio', 'Priscila', 'Renato', 'Simone', 'Thiago', 'Úrsula', 'Valéria', 'Wagner', 'Yara', 'Raimundo', 'Cida', 'Joel', 'Lúcia', 'Rogério']
const REACOES = new Set(['usaria', 'nao', 'duvida'])
const AVISO = 'São agentes de IA, não pessoas reais: um termômetro, não uma pesquisa de mercado. O Atlas não recomenda nem garante nada.'

/** Números aleatórios com semente (o mesmo teste sorteia sempre os mesmos agentes). */
function semente(n) {
  let s = (Number(n) >>> 0) || 1
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 }
}
const embaralhar = (arr, rnd) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

/** Sorteia `quantidade` agentes: cada categoria de cada eixo aparece quase o mesmo número de vezes; combinações não se repetem. */
function sortearAgentes(eixos, quantidade, seed = 1) {
  const rnd = semente(seed)
  const nomes = Object.keys(eixos)
  const colunas = {}
  for (const e of nomes) {
    const vals = eixos[e]
    const col = []
    while (col.length < quantidade) col.push(...embaralhar(vals, rnd))
    colunas[e] = embaralhar(col.slice(0, quantidade), rnd)
  }
  const vistos = new Set()
  const agentes = []
  for (let i = 0; i < quantidade; i++) {
    const tracos = {}
    for (const e of nomes) tracos[e] = colunas[e][i]
    let chave = JSON.stringify(tracos)
    for (let t = 0; vistos.has(chave) && t < 20; t++) { // colisão: troca uma categoria até ficar única
      const e = nomes[Math.floor(rnd() * nomes.length)]
      tracos[e] = eixos[e][Math.floor(rnd() * eixos[e].length)]
      chave = JSON.stringify(tracos)
    }
    vistos.add(chave)
    const faixa = IDADES[tracos.Idade] || [25, 60]
    const id = `a${String(i + 1).padStart(4, '0')}`
    agentes.push({ id, nome: NOMES[Math.floor(rnd() * NOMES.length)], idade: faixa[0] + Math.floor(rnd() * (faixa[1] - faixa[0] + 1)), tracos })
  }
  return agentes
}

/** Texto das telas do protótipo (sem tags), para o Claude saber o que os agentes vão "ver". */
function textoDoPrototipo(cwd, max = 14_000) {
  const dir = path.join(cwd, 'prototipo')
  let arqs = []
  try { arqs = fs.readdirSync(dir).filter((f) => /\.html?$/i.test(f)).sort() } catch { return '' }
  let total = ''
  for (const f of arqs.slice(0, 40)) {
    let t = ''
    try { t = fs.readFileSync(path.join(dir, f), 'utf8') } catch { continue }
    t = t.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    total += `\n[${f.replace(/\.dc\.html?$|\.html?$/i, '')}] ${t.slice(0, 1500)}`
    if (total.length > max) break
  }
  return total.slice(0, max)
}

function lerBriefing(cwd) {
  for (const f of ['docs/briefing.md', 'docs/PRD.md', 'PRD.md']) { try { return fs.readFileSync(path.join(cwd, f), 'utf8').slice(0, 12_000) } catch { /* próximo */ } }
  return ''
}

const lista = (v, max, tam = 40) => (Array.isArray(v) ? v : []).map((x) => umaLinha(x, tam)).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, max)

function pedidoEntender(briefing, telas) {
  return [
    REGRA_CONTEUDO_CLIENTE,
    'Vamos simular como possíveis clientes reagiriam a um sistema. Leia o BRIEFING e as TELAS do protótipo e responda:',
    '- "produto": nome, o que é (até 30 palavras, português simples), para quem é, o preço por mês se o briefing disser (número em reais, senão null) e as principais telas (até 12, nome curto cada).',
    '- "eixos": as categorias do público de verdade desse sistema, para sortear pessoas diferentes:',
    '  "Profissão": de 4 a 8 profissões ou papéis de quem usaria ou pagaria (inclua também quem pode torcer o nariz);',
    '  "Cidade": de 3 a 5 tipos de lugar (ex.: "Capital", "Interior");',
    '  "Tamanho do negócio": de 3 a 4 faixas (ex.: "Até 5 pessoas");',
    '  "O que usa hoje": de 3 a 5 coisas (ex.: "Caderno", "Planilha", "Outro app", "Nada").',
    'Textos curtos, em português do Brasil. Você não grava nada e não roda comandos.',
    'Responda SOMENTE com JSON: {"produto":{"nome":"...","oQueE":"...","paraQuem":"...","preco":null,"telas":["..."]},"eixos":{"Profissão":["..."],"Cidade":["..."],"Tamanho do negócio":["..."],"O que usa hoje":["..."]}}',
    '', 'BRIEFING:', ...blocoDoCliente(briefing, '(sem briefing)'), '', 'TELAS:', ...blocoDoCliente(telas, '(sem protótipo)'),
  ].join('\n')
}

function pedidoOlhar(produto, agentes) {
  return [
    REGRA_CONTEUDO_CLIENTE,
    'Você vai interpretar, um de cada vez, as pessoas da lista abaixo. Cada uma é diferente: responda do jeito DELA (idade, trabalho, dinheiro, jeito), sem puxar para o lado bom. Desconfiados desconfiam; quem aperta no fim do mês acha caro com facilidade. É uma simulação.',
    `O produto: ${produto.nome} — ${produto.oQueE}. Para: ${produto.paraQuem}.${produto.preco ? ` Preço: R$ ${produto.preco} por mês.` : ''} Telas: ${produto.telas.join(', ')}.`,
    'Para cada pessoa diga: "r" ("usaria", "nao" ou "duvida"), "pagaria" (quanto pagaria por mês em reais, número inteiro; 0 se nada), "motivo" (até 12 palavras), "fala" (o que ela diria, até 14 palavras, no jeito dela), "forte" (o que mais gostou, até 6 palavras) e "fraco" (o que mais incomodou, até 6 palavras).',
    'Use exatamente os ids da lista. Você não grava nada e não roda comandos.',
    'Responda SOMENTE com JSON: [{"id":"a0001","r":"usaria","pagaria":29,"motivo":"...","fala":"...","forte":"...","fraco":"..."}]',
    '', 'PESSOAS:',
    ...agentes.map((a) => `- ${a.id}: ${a.nome}, ${a.idade} anos; ${Object.entries(a.tracos).map(([k, v]) => `${k}: ${v}`).join('; ')}`),
  ].join('\n')
}

function pedidoConversa(produto, feed, falam) {
  return [
    REGRA_CONTEUDO_CLIENTE,
    `Uma rede social simulada está conversando sobre o sistema "${produto.nome}" (${produto.oQueE}). Abaixo, a CONVERSA até agora e QUEM FALA AGORA. Interprete cada pessoa do jeito dela (idade, trabalho, jeito, o que achou antes).`,
    'Para cada pessoa escolha uma "acao": "postar" (fala nova), "comentar" (responde concordando a um post), "discutir" (responde discordando de um post) ou "nada". Em comentar/discutir, "em" é o código do post [pN]. "texto" até 20 palavras. Se a conversa a fizer mudar de ideia, "muda" é a nova opinião ("usaria", "nao" ou "duvida"); senão null. Mudar de ideia é raro: só com bom motivo.',
    'Use exatamente os ids de quem fala. Você não grava nada e não roda comandos.',
    'Responda SOMENTE com JSON: [{"id":"a0001","acao":"comentar","em":"p3","texto":"...","muda":null}]',
    '', 'CONVERSA:',
    ...(feed.length ? feed.map((f) => `- [${f.post}] ${f.quem} (${f.r === 'usaria' ? 'gostou' : f.r === 'nao' ? 'não gostou' : 'em dúvida'}): ${f.texto}`) : ['- (ninguém falou ainda)']),
    '', 'QUEM FALA AGORA:',
    ...falam.map((a) => `- ${a.id}: ${a.nome}, ${a.idade} anos; ${a.tracos['Profissão'] || ''}; jeito ${a.tracos.Jeito || ''}; achou antes: ${a.r} ("${a.fala}")`),
  ].join('\n')
}

function limparReacao(x) {
  if (!x || typeof x !== 'object' || !REACOES.has(x.r)) return null
  const p = Number(x.pagaria)
  return { r: x.r, pagaria: Number.isFinite(p) && p >= 0 && p <= 100_000 ? Math.round(p) : null, motivo: umaLinha(x.motivo, 120), fala: umaLinha(x.fala, 140), forte: umaLinha(x.forte, 60), fraco: umaLinha(x.fraco, 60) }
}

function pedidoTemas(produto, fortes, fracos) {
  return [
    REGRA_CONTEUDO_CLIENTE,
    `Agentes de IA disseram o que mais gostaram e o que mais incomodou no sistema "${produto.nome}". Agrupe em TEMAS (até 6 fortes e até 6 fracos), cada tema com um nome curto (até 6 palavras) e a lista dos ids de quem disse aquilo.`,
    'Depois sugira até 4 "ideias" para melhorar o protótipo, cada uma ligada a um tema fraco (pelo índice do tema em "fracos"), com "titulo" (até 6 palavras) e "como" (até 25 palavras, português simples). Não invente números: as contas são feitas fora daqui.',
    'Você não grava nada e não roda comandos.',
    'Responda SOMENTE com JSON: {"fortes":[{"tema":"...","ids":["a0001"]}],"fracos":[{"tema":"...","ids":["a0002"]}],"ideias":[{"titulo":"...","como":"...","fraco":0}]}',
    '', 'GOSTARAM:', ...fortes.map(([id, t]) => `- ${id}: ${t}`), '', 'INCOMODOU:', ...fracos.map(([id, t]) => `- ${id}: ${t}`),
  ].join('\n')
}

/** Contas do relatório, feitas pelo programa (os números não dependem do Claude). */
function contas(agentes, reacoes) {
  const resp = agentes.filter((a) => reacoes[a.id])
  const conta = (lista) => {
    const c = { usaria: 0, nao: 0, duvida: 0 }
    for (const a of lista) c[reacoes[a.id].r]++
    const tot = lista.length || 1
    return { total: lista.length, usaria: c.usaria, nao: c.nao, duvida: c.duvida, pctUsaria: Math.round((c.usaria / tot) * 100), pctNao: Math.round((c.nao / tot) * 100), pctDuvida: Math.round((c.duvida / tot) * 100) }
  }
  const porTipo = {}
  const eixos = agentes[0] ? Object.keys(agentes[0].tracos) : []
  for (const e of eixos) {
    const vals = [...new Set(agentes.map((a) => a.tracos[e]))]
    porTipo[e] = vals.map((v) => ({ valor: v, ...conta(resp.filter((a) => a.tracos[e] === v)) })).filter((x) => x.total > 0).sort((a, b) => b.pctUsaria - a.pctUsaria)
  }
  const faixas = [[0, 0, 'R$ 0'], [1, 19, 'até R$ 19'], [20, 39, 'R$ 20 a 39'], [40, 69, 'R$ 40 a 69'], [70, Infinity, 'R$ 70 ou mais']]
  const precos = resp.map((a) => reacoes[a.id].pagaria).filter((p) => p !== null)
  const preco = faixas.map(([de, ate, rotulo]) => ({ rotulo, n: precos.filter((p) => p >= de && p <= ate).length }))
  const ord = precos.slice().sort((a, b) => a - b)
  return { geral: conta(resp), semResposta: agentes.length - resp.length, porTipo, preco, mediana: ord.length ? ord[Math.floor(ord.length / 2)] : null }
}

/**
 * deps: { raiz, disparo (modelo rápido: perguntar(null, pedido, opts) → texto), agora, agendar(fn, ms) (retomar depois da cota),
 *         avisar(pasta, n) (a tela recarrega) }
 */
function criarTestarIdeia({ raiz, disparo, agora = () => new Date(), agendar = (fn, ms) => setTimeout(fn, ms), avisar = () => {} }) {
  const rodando = new Map()
  const cwdDe = (pasta) => pastaDaObra(raiz, String(pasta))
  const dirTestes = (cwd) => path.join(cwd, '.atlas', 'testes')
  const dirTeste = (cwd, n) => path.join(dirTestes(cwd), String(n))
  const arq = (cwd, n, nome) => path.join(dirTeste(cwd, n), nome)
  const ler = (cwd, n, nome, padrao) => { const t = lerTexto(arq(cwd, n, nome), 8_000_000); if (t === null) return padrao; try { const v = JSON.parse(t); return v === null || v === undefined ? padrao : v } catch { return padrao } }
  const gravar = (cwd, n, nome, v) => { fs.mkdirSync(dirTeste(cwd, n), { recursive: true }); gravarAtomico(arq(cwd, n, nome), JSON.stringify(v)) }
  const numeros = (cwd) => { try { return fs.readdirSync(dirTestes(cwd)).filter((d) => /^\d{1,4}$/.test(d)).map(Number).sort((a, b) => a - b) } catch { return [] } }
  const validarN = (n) => { const x = Number(n); if (!Number.isInteger(x) || x < 1 || x > 9999) throw new Error('teste-invalido'); return x }

  async function perguntar(pedido) { return disparo.perguntar(null, pedido, { timeoutMs: 240_000, maxSaida: 2_000_000 }) }

  async function passoEntender(cwd, n, meta) {
    const j = extrairJson(await perguntar(pedidoEntender(lerBriefing(cwd), textoDoPrototipo(cwd))), 'objeto')
    const p = j.produto && typeof j.produto === 'object' ? j.produto : {}
    const preco = Number(p.preco)
    const produto = { nome: umaLinha(p.nome, 60, 'o sistema'), oQueE: umaLinha(p.oQueE, 240), paraQuem: umaLinha(p.paraQuem, 160), preco: Number.isFinite(preco) && preco > 0 && preco < 100_000 ? Math.round(preco) : null, telas: lista(p.telas, 12) }
    const e = j.eixos && typeof j.eixos === 'object' ? j.eixos : {}
    const eixos = {
      'Profissão': lista(e['Profissão'], 8),
      Cidade: lista(e.Cidade, 5),
      'Tamanho do negócio': lista(e['Tamanho do negócio'], 4),
      'O que usa hoje': lista(e['O que usa hoje'], 5),
      ...FIXOS,
    }
    for (const [k, v] of Object.entries(eixos)) if (v.length < 2) eixos[k] = k === 'Profissão' ? ['Dono do negócio', 'Funcionário', 'Cliente final'] : ['Um tipo', 'Outro tipo']
    gravar(cwd, n, 'produto.json', { produto, eixos })
    return { ...meta, etapa: 'agentes' }
  }

  function passoAgentes(cwd, n, meta) {
    let agentes = null
    if (meta.mesmosDe) {
      const ant = ler(cwd, meta.mesmosDe, 'agentes.json', null)
      if (Array.isArray(ant) && ant.length) agentes = ant.slice(0, meta.quantidade)
    }
    if (!agentes) agentes = sortearAgentes(ler(cwd, n, 'produto.json', {}).eixos, meta.quantidade, n * 7919)
    gravar(cwd, n, 'agentes.json', agentes)
    return { ...meta, etapa: 'olhar', quantidade: agentes.length }
  }

  async function passoOlhar(cwd, n, meta) {
    const agentes = ler(cwd, n, 'agentes.json', [])
    const { produto } = ler(cwd, n, 'produto.json', {})
    const reacoes = ler(cwd, n, 'reacoes.json', {})
    const tentados = new Set(ler(cwd, n, 'tentados.json', []))
    const faltam = agentes.filter((a) => !reacoes[a.id] && !tentados.has(a.id))
    for (let i = 0; i < faltam.length; i += LOTE) {
      const lote = faltam.slice(i, i + LOTE)
      const ids = new Set(lote.map((a) => a.id))
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        const pendentes = lote.filter((a) => !reacoes[a.id])
        if (!pendentes.length) break
        let resp = []
        try { resp = extrairJson(await perguntar(pedidoOlhar(produto, pendentes)), 'array') } catch (e) { if (e && e.message === 'claude-cota') throw e; resp = [] }
        for (const x of resp) { const r = limparReacao(x); if (r && ids.has(x.id) && !reacoes[x.id]) reacoes[x.id] = r }
      }
      for (const a of lote) tentados.add(a.id) // quem não respondeu em 2 tentativas fica "sem resposta" (nada é inventado)
      gravar(cwd, n, 'reacoes.json', reacoes)
      gravar(cwd, n, 'tentados.json', [...tentados])
      gravar(cwd, n, 'teste.json', { ...meta, feitos: Object.keys(reacoes).length, olhados: tentados.size })
      avisar(n)
    }
    return { ...ler(cwd, n, 'teste.json', meta), etapa: 'conversa' }
  }

  async function passoConversa(cwd, n, meta) {
    const agentes = ler(cwd, n, 'agentes.json', [])
    const { produto } = ler(cwd, n, 'produto.json', {})
    const reacoes = ler(cwd, n, 'reacoes.json', {})
    const eventos = ler(cwd, n, 'conversa.json', [])
    const mudancas = ler(cwd, n, 'mudancas.json', {})
    const rnd = semente(n * 104729 + (meta.rodada || 0))
    const com = agentes.filter((a) => reacoes[a.id])
    const porId = new Map(agentes.map((a) => [a.id, a]))
    const k = Math.min(100, Math.max(10, Math.round(com.length * 0.12)))
    const peso = (a) => ({ Animado: 1.4, Apressado: 1.1, Detalhista: 0.9, Desconfiado: 1.2 }[a.tracos.Jeito] || 1)
    for (let rodada = (meta.rodada || 0) + 1; rodada <= RODADAS; rodada++) {
      // quem fala nesta rodada: sorteio com peso pelo jeito (como o "activity_level" do MiroFish)
      const falam = com.map((a) => [a, rnd() * peso(a)]).sort((x, y) => y[1] - x[1]).slice(0, k).map(([a]) => a)
      for (let i = 0; i < falam.length; i += LOTE_CONVERSA) {
        const lote = falam.slice(i, i + LOTE_CONVERSA)
        // o "feed": os posts mais recentes, metade de quem pensa igual e metade de quem pensa diferente
        const posts = eventos.filter((e) => e.post)
        const recentes = posts.slice(-40)
        const feed = embaralhar(recentes, rnd).slice(0, 12).map((e) => ({ post: e.post, quem: `${porId.get(e.de).nome}, ${porId.get(e.de).idade}`, r: e.r, texto: e.texto }))
        if (!feed.length) for (const a of embaralhar(com, rnd).slice(0, 8)) feed.push({ post: null, quem: `${a.nome}, ${a.idade}`, r: reacoes[a.id].r, texto: reacoes[a.id].fala })
        const validos = new Set(feed.map((f) => f.post).filter(Boolean))
        const ids = new Set(lote.map((a) => a.id))
        let resp = []
        try { resp = extrairJson(await perguntar(pedidoConversa(produto, feed.map((f, j) => ({ ...f, post: f.post || `p0-${j}` })), lote.map((a) => ({ ...a, r: reacoes[a.id].r, fala: reacoes[a.id].fala })))), 'array') } catch (e) { if (e && e.message === 'claude-cota') throw e; resp = [] }
        const vistos = new Set()
        for (const x of resp) {
          if (!x || !ids.has(x.id) || vistos.has(x.id) || !ACOES.has(x.acao) || x.acao === 'nada') continue
          vistos.add(x.id)
          const texto = umaLinha(x.texto, 160)
          if (!texto) continue
          const alvo = typeof x.em === 'string' && validos.has(x.em) ? eventos.find((e) => e.post === x.em) : null
          const acao = x.acao !== 'postar' && !alvo ? 'postar' : x.acao
          if (REACOES.has(x.muda) && x.muda !== reacoes[x.id].r) {
            if (!mudancas[x.id]) mudancas[x.id] = { de: reacoes[x.id].r }
            reacoes[x.id] = { ...reacoes[x.id], r: x.muda }
            mudancas[x.id].para = x.muda
          }
          eventos.push({ rodada, post: `p${eventos.length + 1}`, de: x.id, para: acao === 'postar' ? null : alvo.de, acao, texto, r: reacoes[x.id].r })
        }
      }
      gravar(cwd, n, 'conversa.json', eventos)
      gravar(cwd, n, 'reacoes.json', reacoes)
      gravar(cwd, n, 'mudancas.json', mudancas)
      meta = { ...meta, rodada }
      gravar(cwd, n, 'teste.json', meta)
      avisar(n)
    }
    return { ...meta, etapa: 'relatorio' }
  }

  async function passoRelatorio(cwd, n, meta) {
    const agentes = ler(cwd, n, 'agentes.json', [])
    const reacoes = ler(cwd, n, 'reacoes.json', {})
    const { produto } = ler(cwd, n, 'produto.json', {})
    const c = contas(agentes, reacoes)
    const fortes = agentes.filter((a) => reacoes[a.id] && reacoes[a.id].forte).map((a) => [a.id, reacoes[a.id].forte])
    const fracos = agentes.filter((a) => reacoes[a.id] && reacoes[a.id].fraco).map((a) => [a.id, reacoes[a.id].fraco])
    let temas = { fortes: [], fracos: [], ideias: [] }
    try { temas = extrairJson(await perguntar(pedidoTemas(produto, fortes.slice(0, 1000), fracos.slice(0, 1000))), 'objeto') } catch (e) { if (e && e.message === 'claude-cota') throw e }
    const validos = new Set(agentes.map((a) => a.id))
    const tema = (arr, campo) => (Array.isArray(arr) ? arr : []).slice(0, 6).map((t) => {
      const ids = [...new Set((Array.isArray(t && t.ids) ? t.ids : []).filter((id) => validos.has(id) && reacoes[id] && reacoes[id][campo]))]
      const ex = ids.map((id) => agentes.find((a) => a.id === id)).find((a) => a && reacoes[a.id].fala)
      return { tema: umaLinha(t && t.tema, 60), n: ids.length, ids, exemplo: ex ? { id: ex.id, fala: reacoes[ex.id].fala, quem: `${ex.nome}, ${ex.idade}` } : null }
    }).filter((t) => t.tema && t.n > 0).sort((a, b) => b.n - a.n)
    const fracosT = tema(temas.fracos, 'fraco')
    const fracosOrig = (Array.isArray(temas.fracos) ? temas.fracos : []).map((t) => umaLinha(t && t.tema, 60))
    const ideias = (Array.isArray(temas.ideias) ? temas.ideias : []).slice(0, 4).map((i) => {
      const nome = fracosOrig[Number(i && i.fraco)]
      const ligado = fracosT.find((t) => t.tema === nome)
      return { titulo: umaLinha(i && i.titulo, 60), como: umaLinha(i && i.como, 220), tema: ligado ? ligado.tema : null, n: ligado ? ligado.n : 0 }
    }).filter((i) => i.titulo)
    const ev = ler(cwd, n, 'conversa.json', [])
    const mud = Object.values(ler(cwd, n, 'mudancas.json', {})).filter((m) => m.para && m.para !== m.de)
    const conversa = { postam: ev.filter((e) => e.acao === 'postar').length, comentam: ev.filter((e) => e.acao === 'comentar').length, discutem: ev.filter((e) => e.acao === 'discutir').length }
    gravar(cwd, n, 'relatorio.json', { aviso: AVISO, produto, ...c, conversa, mudaram: mud.length, passaramAGostar: mud.filter((m) => m.para === 'usaria').length, fortes: tema(temas.fortes, 'forte'), fracos: fracosT, ideias, criadoEm: agora().toISOString() })
    return { ...meta, etapa: 'pronto', terminadoEm: agora().toISOString() }
  }

  function rodar(pasta, n) {
    const chave = `${pasta}#${n}`
    if (rodando.has(chave)) return rodando.get(chave)
    const p = rodarAgora(pasta, n).finally(() => rodando.delete(chave))
    rodando.set(chave, p)
    return p
  }
  async function rodarAgora(pasta, n) {
    const cwd = cwdDe(pasta)
    try {
      let meta = ler(cwd, n, 'teste.json', null)
      while (meta && meta.etapa !== 'pronto') {
        meta = { ...meta, estado: 'rodando', motivo: null }
        gravar(cwd, n, 'teste.json', meta)
        if (meta.etapa === 'entender') meta = await passoEntender(cwd, n, meta)
        else if (meta.etapa === 'agentes') meta = passoAgentes(cwd, n, meta)
        else if (meta.etapa === 'olhar') meta = await passoOlhar(cwd, n, meta)
        else if (meta.etapa === 'conversa') meta = await passoConversa(cwd, n, meta)
        else if (meta.etapa === 'relatorio') meta = await passoRelatorio(cwd, n, meta)
        else throw new Error('etapa-invalida')
        gravar(cwd, n, 'teste.json', { ...meta, estado: meta.etapa === 'pronto' ? 'pronto' : 'rodando' })
        avisar(n)
      }
    } catch (e) {
      const cota = e && e.message === 'claude-cota'
      const meta = ler(cwd, n, 'teste.json', {})
      gravar(cwd, n, 'teste.json', { ...meta, estado: cota ? 'pausado-cota' : 'erro', motivo: cota ? 'claude-cota' : String((e && e.message) || 'erro').slice(0, 80) })
      avisar(n)
      if (cota) agendar(() => { void rodar(pasta, n) }, 15 * 60_000)
    }
  }

  const resumo = (cwd, n) => {
    const m = ler(cwd, n, 'teste.json', null)
    if (!m) return null
    const r = m.etapa === 'pronto' ? ler(cwd, n, 'relatorio.json', null) : null
    return { n, criadoEm: m.criadoEm, quantidade: m.quantidade, mesmosDe: m.mesmosDe || null, versao: m.versao || null, etapa: m.etapa, estado: m.estado, motivo: m.motivo || null, feitos: m.feitos || 0, olhados: m.olhados || 0, rodada: m.rodada || 0, termometro: r ? r.geral : null, maisContra: r && r.fracos[0] ? r.fracos[0].tema : null }
  }

  return {
    QUANTIDADES, AVISO,
    async listar(pasta) { const cwd = cwdDe(pasta); return numeros(cwd).map((n) => resumo(cwd, n)).filter(Boolean).reverse() },
    async iniciar(pasta, { quantidade, mesmosDe = null, versao = null } = {}) {
      const cwd = cwdDe(pasta)
      const q = Number(quantidade)
      if (!QUANTIDADES.includes(q)) throw new Error('quantidade-invalida')
      const ns = numeros(cwd)
      if (ns.some((x) => { const m = ler(cwd, x, 'teste.json', {}); return m.estado === 'rodando' || m.estado === 'pausado-cota' })) throw new Error('teste-em-andamento')
      const ant = mesmosDe === null || mesmosDe === undefined ? null : validarN(mesmosDe)
      if (ant !== null && !ns.includes(ant)) throw new Error('teste-invalido')
      const n = (ns[ns.length - 1] || 0) + 1
      gravar(cwd, n, 'teste.json', { n, criadoEm: agora().toISOString(), quantidade: q, mesmosDe: ant, versao: versao === null ? null : umaLinha(versao, 20), etapa: ant ? 'agentes' : 'entender', estado: 'rodando', feitos: 0, olhados: 0 })
      if (ant) { const p = ler(cwd, ant, 'produto.json', null); if (p) gravar(cwd, n, 'produto.json', p); else gravar(cwd, n, 'teste.json', { ...ler(cwd, n, 'teste.json', {}), etapa: 'entender' }) }
      void rodar(String(pasta), n)
      return { n }
    },
    async estado(pasta, n) { return resumo(cwdDe(pasta), validarN(n)) },
    async relatorio(pasta, n) { const cwd = cwdDe(pasta); return ler(cwd, validarN(n), 'relatorio.json', null) },
    /** O que a Praça desenha: cada agente (cor = opinião agora) e as últimas falas da conversa. */
    async cena(pasta, n) {
      const cwd = cwdDe(pasta)
      const x = validarN(n)
      const agentes = ler(cwd, x, 'agentes.json', [])
      const reacoes = ler(cwd, x, 'reacoes.json', {})
      const ev = ler(cwd, x, 'conversa.json', [])
      return {
        agentes: agentes.map((a) => ({ id: a.id, nome: a.nome, idade: a.idade, tracos: a.tracos, r: reacoes[a.id] ? reacoes[a.id].r : null, fala: reacoes[a.id] ? reacoes[a.id].fala : null })),
        eventos: ev.slice(-300).map((e) => ({ rodada: e.rodada, de: e.de, para: e.para, acao: e.acao, texto: e.texto, r: e.r })),
      }
    },
    async retomar(pasta, n) { const x = validarN(n); cwdDe(pasta); void rodar(String(pasta), x); return { ok: true } },
    /** Ao abrir o Atlas: testes que estavam rodando ou pausados pela cota continuam sozinhos. */
    async retomarTodos(pastas) { for (const p of pastas) { try { const cwd = cwdDe(p); for (const n of numeros(cwd)) { const m = ler(cwd, n, 'teste.json', {}); if (m.estado === 'rodando' || m.estado === 'pausado-cota') void rodar(p, n) } } catch { /* obra sumiu */ } } },
    /** Para testes: espera o teste rodando terminar. */
    _rodar: rodar,
  }
}

module.exports = { criarTestarIdeia, sortearAgentes, contas, textoDoPrototipo, limparReacao, QUANTIDADES, FIXOS }
