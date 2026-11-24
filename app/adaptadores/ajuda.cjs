// Adaptador real do PonteAjuda (src/app/ponte-ajuda.ts) e do PonteCasosAdmin (src/app/ponte-ajuda-casos.ts) — processo principal do
// Electron (só Windows). Espelha em CommonJS PAGINAS_OFICIAIS, montarPedidoAjuda e normalizarResposta (o teste carrega o TypeScript
// de verdade e compara; manter em sincronia).
//
// O QUE FAZ
//  conversar(contexto, historico, mensagem): monta o pedido SEMPRE com montarPedidoAjuda (mensagem, erro, print e conversa como DADO,
//    REGRA_CONTEUDO_CLIENTE no topo) e fala com o Claude do cliente pelo disparo seguro de projeto-comum.cjs (--setting-sources user,
//    --strict-mcp-config, FERRAMENTAS_NEGADAS, git isolado, env mínimo, garantirSemConfigDeProjeto antes e depois da espera). O Claude
//    é SÓ LEITOR (Read/Glob/Grep na pasta da obra; sem pasta, nenhuma ferramenta) e NEGA Write/Edit/Bash/Task/WebFetch/WebSearch. Pede
//    JSON {texto,passos,traducoes,depois,pagina,naoResolvido} e NÃO confia: a resposta é validada/normalizada aqui (tamanho, texto
//    simples, página só da lista fechada, qualquer promessa de atendimento humano troca a resposta inteira). Resposta que não é JSON
//    vira só `texto` (também normalizado). Uma conversa por vez.
//  tirarPrint(pasta): captura SÓ a janela do Atlas (`capturar` = webContents.capturePage no main), confere que é PNG e grava em
//    userData/ajuda/prints/(hash da obra)/(id) — NUNCA dentro da obra (ela é o repositório GitHub do cliente e a linha faz git push). Nada sai do computador por aqui: o
//    print só aparece para o cliente na tela; o Claude só o lê (Read) se o cliente seguir a conversa com ele.
//  anexarImagem(pasta): diálogo do Windows filtrado a png/jpg/webp; confere assinatura da imagem (SVG/HTML/exe renomeado é recusado),
//    tamanho (20 MB) e que não é link; copia com COPYFILE_EXCL para o mesmo lugar do print.
//  abrirPagina(id): shell.openExternal SÓ de PAGINAS_OFICIAIS (id da lista fechada, URL fixa aqui dentro). Nunca recebe URL.
//  casos.enviar(caso): POST {ATLAS_API_URL}/ajuda-caso com o token do dispositivo (cofre) — o servidor grava em ocorrencias_admin.
//    O cliente_id vem da licença NO SERVIDOR. Tira segredo de novo (defesa em profundidade), https sem redirect, timeout. Endpoint no servidor:
//    supabase/functions/_shared/ajuda-caso.ts; se falhar, falha honesto (a tela diz que não anotou).
//
// COMO TESTAR: `node --test app/adaptadores/*.teste.cjs` (ajuda.teste.cjs: Claude, captura, diálogo e rede simulados). No Windows:
// abrir a Ajuda do Atlas, "Tirar print" cria userData/ajuda/prints/.../print-*.png (fora da obra); escrever uma dúvida devolve passos em português.
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { caminhoSeguro, abrirExterno } = require('../seguro.cjs')
const { pastaDaObra, lerTexto, lerJson } = require('./obra-fs.cjs')
const { REGRA_CONTEUDO_CLIENTE, blocoDoCliente, comoDado, extrairJson } = require('./projeto-comum.cjs')

// ---- espelho de PAGINAS_OFICIAIS -------------------------------------------------------------------------------------------
const PAGINAS_OFICIAIS = Object.freeze({
  'github-apps': 'https://github.com/settings/installations',
  'github-inicio': 'https://github.com',
  'vercel-novo': 'https://vercel.com/new',
  'vercel-painel': 'https://vercel.com/dashboard',
  'supabase-painel': 'https://supabase.com/dashboard',
  'claude-login': 'https://claude.ai/login',
  'claude-planos': 'https://claude.ai/upgrade',
  'registro-br': 'https://registro.br',
})
const HOSTS_PAGINAS = Object.freeze([...new Set(Object.values(PAGINAS_OFICIAIS).map((u) => new URL(u).hostname))])
const ehPaginaId = (v) => typeof v === 'string' && Object.hasOwn(PAGINAS_OFICIAIS, v)

// ---- espelho de textoDaObra / normalizarResposta ---------------------------------------------------------------------------
const textoDaObra = (t, max = 120) => comoDado(t ?? '', max).join(' ').slice(0, max).trim()
// Promessa de GENTE (o Atlas nunca promete atendimento humano). Antes era qualquer "equipe", "agente", "time" ou "WhatsApp", e a
// resposta certa sobre a obra ("a equipe de execução está na etapa M1") virava a frase-padrão (bug do Guilherme, 24/11/2026).
const PROMETE_HUMANO = /\bhuman[oa]s?\b|\batendente|\batendimento\b|\bespecialista|\bsuporte\b|\bconosco\b|\boperador|\bconsultor|\bte\s+transfer|\btransfer\w*\s+(voce|para\s+(um|uma|outr))|\bencaminh\w*\s+(seu|o\s+seu|voce|para)|\bentr\w*\s+em\s+contato|\bcontat(e|ar)\s+(a\s+gente|nos|o\s+atlas)|\b(nosso|nossa|nossos|nossas)\s+(time|equipe|tecnic\w*|whatsapp|telefone|e-?mail|central)|\b(alguem|uma\s+pessoa|um\s+tecnico|uma\s+tecnica|um\s+colega)\s+(da|do|vai|ira|pode|entra|te)\b|\b(chamo|chamar|chama|ligue|ligar|liga)\s+(um|uma|alguem|pra\s+gente|para\s+a\s+gente|para\s+nos)\b|\b(whatsapp|telefone|equipe|time|suporte)\s+do\s+atlas|\bfale\s+com\s+(a\s+gente|nosso|nossa|um|uma|alguem)\b/
const semAcento = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b(sua|seu|suas|seus|da sua|do seu) (equipe|time)s?\b/g, '')
const prometeHumano = (t) => PROMETE_HUMANO.test(semAcento(t))
const RECADO_SEM_HUMANO = 'Eu resolvo isto por aqui com você. Me conta com as suas palavras o que aparece na tela, ou manda outro print.'

function normalizarResposta(bruto) {
  const o = bruto && typeof bruto === 'object' ? bruto : {}
  const limpa = (v, max) => textoDaObra(typeof v === 'string' ? v : '', max)
  const campos = [o.texto, o.depois, ...(Array.isArray(o.passos) ? o.passos : []), ...(Array.isArray(o.traducoes) ? o.traducoes.flatMap((t) => (t && typeof t === 'object' ? Object.values(t) : [])) : [])]
  if (campos.some((c) => typeof c === 'string' && (prometeHumano(c) || prometeHumano(textoDaObra(c, 100000)) || prometeHumano(c.replace(/[\p{Cc}\p{Cf}]/gu, ''))))) return { texto: RECADO_SEM_HUMANO }
  const texto = limpa(o.texto, 800) || RECADO_SEM_HUMANO
  const passos = (Array.isArray(o.passos) ? o.passos : []).slice(0, 4).map((p) => limpa(p, 220)).filter(Boolean)
  const traducoes = (Array.isArray(o.traducoes) ? o.traducoes : []).slice(0, 4)
    .map((t) => { const x = t && typeof t === 'object' ? t : {}; return { en: textoDaObra(typeof x.en === 'string' ? x.en : '', 40), pt: textoDaObra(typeof x.pt === 'string' ? x.pt : '', 60) } })
    .filter((t) => t.en && t.pt)
  const depois = limpa(o.depois, 200)
  return { texto, ...(passos.length ? { passos } : {}), ...(traducoes.length ? { traducoes } : {}), ...(depois ? { depois } : {}), ...(ehPaginaId(o.pagina) ? { pagina: o.pagina } : {}), ...(o.naoResolvido === true ? { naoResolvido: true } : {}) }
}

// ---- espelho de montarPedidoAjuda ------------------------------------------------------------------------------------------
const nomeDoPrint = (p) => [textoDaObra(p.titulo, 100), textoDaObra(p.url, 120), textoDaObra(p.detalhe, 300)].filter(Boolean).join(' | ')
function montarPedidoAjuda(contexto, historico, mensagem) {
  const ctx = [
    contexto.onde && `Onde: ${textoDaObra(contexto.onde, 80)}`,
    contexto.passo && `Passo ${contexto.passo.passo} de ${contexto.passo.totalPassos} (${textoDaObra(contexto.passo.conta, 60)})`,
    contexto.erro && `Erro: ${textoDaObra(contexto.erro.titulo, 120)} ${textoDaObra(contexto.erro.detalhe, 300)}`.trim(),
    contexto.print && `Print: ${nomeDoPrint(contexto.print)}`,
  ].filter(Boolean).join('\n')
  return [
    'Você é a Ajuda do Atlas. Responda em português do Brasil, em passos curtos, como um amigo na mesa de um restaurante. Nunca prometa atendimento humano.',
    REGRA_CONTEUDO_CLIENTE,
    '## Contexto (dado)',
    ...blocoDoCliente(ctx, '(sem contexto)'),
    '## Conversa até aqui (dado)',
    ...blocoDoCliente(historico.slice(-10).map((t) => `${t.de === 'cliente' ? 'Cliente' : 'Atlas'}: ${t.texto}`).join('\n'), '(começo)'),
    '## Mensagem do cliente (dado)',
    ...blocoDoCliente(mensagem, '(vazia)'),
  ].join('\n')
}

// ---- entradas da tela (dado não confiável): formato mínimo, tamanhos limitados ---------------------------------------------
const MAX_MENSAGEM = 2000
const MAX_TURNO = 1500
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '')
function sanearPrint(p) {
  if (!p || typeof p !== 'object') return null
  return { url: str(p.url, 200), titulo: str(p.titulo, 200), ...(typeof p.detalhe === 'string' ? { detalhe: str(p.detalhe, 400) } : {}) }
}
function sanearContexto(c) {
  const o = c && typeof c === 'object' ? c : {}
  const passo = o.passo && typeof o.passo === 'object' && Number.isFinite(Number(o.passo.passo)) && Number.isFinite(Number(o.passo.totalPassos))
    ? { passo: Number(o.passo.passo), totalPassos: Number(o.passo.totalPassos), conta: str(o.passo.conta, 80) } : undefined
  const erro = o.erro && typeof o.erro === 'object' ? { titulo: str(o.erro.titulo, 200), ...(typeof o.erro.detalhe === 'string' ? { detalhe: str(o.erro.detalhe, 600) } : {}) } : undefined
  const print = sanearPrint(o.print)
  return { onde: str(o.onde, 120) || undefined, passo, erro, print }
}
function sanearHistorico(h) {
  return (Array.isArray(h) ? h : []).slice(-10).map((t) => ({ de: t && t.de === 'atlas' ? 'atlas' : 'cliente', texto: str(t && t.texto, MAX_TURNO) }))
}

const RE_IMAGEM_DO_PRINT = /^imagem ((?:print|anexo)-[a-z0-9-]{1,60}\.(?:png|jpg|webp))$/
const INSTRUCAO_JSON = [
  'Responda SOMENTE com um objeto JSON (sem texto fora dele), neste formato:',
  '{"texto":"frase curta","passos":["no máximo 4 passos curtos"],"traducoes":[{"en":"Save","pt":"Salvar"}],"depois":"frase final opcional","pagina":"id opcional","naoResolvido":false}',
  `"pagina" é UM destes ids (ou omita): ${Object.keys(PAGINAS_OFICIAIS).join(', ')}. Nunca escreva endereço. "naoResolvido": true só se você não achou saída.`,
  'Você só lê; não altera arquivos nem roda comandos.',
].join('\n')

// ---- imagens ---------------------------------------------------------------------------------------------------------------
const MAX_IMAGEM = 20 * 1024 * 1024
/** Assinatura de PNG, JPEG ou WEBP (RIFF....WEBP). Devolve a extensão ou null. SVG/HTML/exe renomeado não passa. */
function tipoDaImagem(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp'
  return null
}
const EXT_ANEXO = ['png', 'jpg', 'jpeg', 'webp']
const nomeNovo = (prefixo, ext) => `${prefixo}-${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}-${crypto.randomBytes(3).toString('hex')}.${ext}`

// ---- segredos (espelho de tirarSegredos de ponte-ajuda-casos.ts) ------------------------------------------------------------
function tirarSegredos(t) {
  return t
    .replace(/\b(?:sk|pk|rk|ghp|gho|ghu|ghs|github_pat|xox[baprs]|AKIA|EAA)[-_A-Za-z0-9]{8,}/g, '[segredo]')
    .replace(/\beyJ[\w-]{10,}(?:\.[\w-]{5,})*/g, '[segredo]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [segredo]')
    .replace(/[\w-]*(?:key|token|secret|pass(?:word|wd)?|senha|chave)[\w-]*[ \t]*[:=][ \t]*\n?[ \t]*\S+/gi, '[segredo]')
    .replace(/\S+\s+(?:como|de|é a|e a)\s+(?=(?:senha|password|passwd|pass|chave|token|segredo|secret|pin)(?![A-Za-zÀ-ÿ]))/gi, '[segredo] ')
    .replace(/(?<![A-Za-zÀ-ÿ])(senha|password|passwd|pass|chave|api[_ -]?key|access[_ -]?token|secret[_ -]?key|auth[_ -]?token|key|token|segredo|secret|cpf|cnpj|cart[ãa]o|card|c[óo]digo|code|pin|cookie)(?![A-Za-zÀ-ÿ])(?:\s*\n\s*\S+|(?:[^\n.!?]|[.!?](?!\s|$))*)/gi, '$1 [segredo]')
    .replace(/\b\d(?:[ -]?\d){12,18}\b/g, '[segredo]')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[e-mail]')
    .replace(/\b[A-Fa-f0-9]{32,}\b/g, '[segredo]')
    .replace(/\b[A-Za-z0-9+/_=-]{40,}\b/g, '[segredo]')
    .replace(/(https?:\/\/[^\s?#]*)[?#]\S*/gi, '$1?…')
    .replace(/[?&#][\w.-]+=\S*/g, '?…')
    .replace(/([?#])\S+/g, '$1…')
}

const CHAVE_COFRE = 'atlas/dispositivo'

/**
 * `deps`: { raiz, dadosApp, disparo (criarDisparo de projeto-comum.cjs), shell, dialog, janela, capturar (async () => Buffer PNG da janela do Atlas) }.
 * Só `raiz`, `dadosApp`, `disparo` e `shell` são obrigatórios; sem `capturar`/`dialog` o print e o anexo devolvem null (a tela já trata).
 */
// ---- estado da obra (bug do Guilherme, 24/11/2026) --------------------------------------------------------------------------
// "Estamos em 0% ainda, está acontecendo ou está parado?" precisa de resposta de verdade. Com a obra aberta, a Ajuda recebe um
// retrato curto do que os arquivos da obra dizem (PLAN, roteiro da /construir, últimos movimentos do canteiro). É DADO: vai dentro
// do bloco delimitado, nunca como instrução. Sem nada disso na pasta, não manda nada (não inventa).
const PARTES = ['planejando', 'fazendo', 'revisando (qualidade, segurança e desempenho)', 'juntando ao projeto e medindo']
const QUEM = { implementador: 'Equipe de execução', qa: 'Inspetor de qualidade', seguranca: 'Técnico de segurança', desempenho: 'Engenheiro de desempenho', coordenador: 'Mestre de obras', plantonista: 'Plantonista', despachante: 'Despachante do GitHub' }
const hora = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
function estadoDaObra(dir, agora = Date.now()) {
  const linhas = []
  const plan = lerTexto(path.join(dir, 'PLAN.md'), 400_000)
  if (plan !== null) {
    let total = 0, feitas = 0, etapas = 0
    for (const l of plan.split(/\r?\n/)) { if (/^##\s+(?:Milestone\s+|M)\d+/i.test(l)) etapas++; const t = l.match(/^\s*[-*]\s+\[( |x|X)\]/); if (t) { total++; if (t[1] !== ' ') feitas++ } }
    linhas.push(`${feitas} de ${total} tarefas aprovadas, em ${etapas} etapas. Uma tarefa só conta depois que passa pela revisão de qualidade, segurança e desempenho, no fim de cada etapa: até lá o número fica parado mesmo com a obra andando.`)
  }
  const rot = lerJson(path.join(dir, '.atlas', 'roteiro.json')) || lerJson(path.join(dir, '.codex', 'roteiro.json')) || lerJson(path.join(dir, '.claude', 'roteiro.json'))
  if (rot && typeof rot === 'object' && typeof rot.milestone === 'string') {
    const e = Math.max(0, Math.min(3, Number(rot.etapa_concluida) || 0))
    linhas.push(`Etapa em andamento: ${str(rot.milestone, 10)} · ${str(rot.titulo, 80) || 'sem título'} · parte ${e + 1} de 4 (${PARTES[e]})${Number.isInteger(rot.pr) ? ` · pedido de revisão #${rot.pr}` : ''}`)
  }
  const evs = lerTexto(path.join(dir, '.canteiro', 'eventos.jsonl'), 2_000_000)
  if (evs) {
    const ult = evs.trim().split(/\r?\n/).slice(-10).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter((x) => x && Number.isFinite(x.ts))
    if (ult.length) {
      const fim = ult[ult.length - 1]
      const min = Math.max(0, Math.round((agora - fim.ts) / 60000))
      linhas.push(`Último movimento: ${hora(fim.ts)} (há ${min} min).`)
      linhas.push('Últimos movimentos:', ...ult.map((x) => `${hora(x.ts)} ${QUEM[x.agente] || str(x.agente, 30) || 'linha'}: ${str(x.ev, 30)} ${str(x.alvo, 80)}`.trim()))
    }
  }
  const oc = lerJson(path.join(dir, 'docs', 'ocorrencias.json'))
  const abertas = oc && Array.isArray(oc.ocorrencias) ? oc.ocorrencias.filter((o) => o && o.status !== 'resolvida' && o.status !== 'baixada').length : 0
  if (abertas) linhas.push(`Bloqueios externos abertos: ${abertas}.`)
  return linhas.length ? linhas.join('\n') : null
}
const INSTRUCAO_OBRA = 'Se a pergunta for sobre a obra (andamento, 0%, demora, se está parada), responda com o Estado da obra acima e, se precisar, leia PLAN.md, .claude/roteiro.json e .canteiro/eventos.jsonl. Diga em que etapa está, quem está trabalhando agora e no quê, por que o número ainda não mexeu e quando ele deve mexer. Se o último movimento for antigo, diga que parece parada e o que fazer. Seja específico; nunca responda com frase genérica.'

function criarAjuda({ raiz, dadosApp, disparo, shell, dialog = null, janela = () => null, capturar = null }) {
  /** nome do arquivo -> { dir, pasta } (só o que ESTE adaptador gravou nesta sessão). */
  const emitidos = new Map()
  let conversando = false

  /** Pasta do print: SEMPRE em userData\ajuda\prints\<hash da obra>\<id>, FORA da obra (a obra é o repositório GitHub do cliente e a
   *  linha de produção faz git add/commit/push: um print com dado sensível nunca pode cair lá). Uma subpasta por print, para o Claude
   *  receber --add-dir só daquele arquivo. */
  function pastaDePrints(pasta) {
    let obra = null
    if (typeof pasta === 'string' && pasta) { try { pastaDaObra(raiz, pasta); obra = pasta } catch { obra = null } }
    const grupo = crypto.createHash('sha256').update(obra ?? '').digest('hex').slice(0, 16)
    const dir = path.join(dadosApp, 'ajuda', 'prints', grupo, crypto.randomBytes(6).toString('hex'))
    fs.mkdirSync(dir, { recursive: true })
    return { dir, pasta: obra }
  }
  const registrar = (nome, dest) => { emitidos.set(nome, { pasta: dest.pasta, dir: dest.dir }); if (emitidos.size > 200) emitidos.delete(emitidos.keys().next().value) }
  const retorno = (nome, titulo, url) => ({ url, titulo, detalhe: `imagem ${nome}` })

  return {
    async conversar(contexto, historico, mensagem) {
      if (conversando) throw new Error('ajuda-ocupada')
      const ctx = sanearContexto(contexto)
      const hist = sanearHistorico(historico)
      const msg = str(mensagem, MAX_MENSAGEM)
      let pasta = null
      const bruta = contexto && typeof contexto === 'object' ? contexto.pasta : null
      if (typeof bruta === 'string' && bruta) { try { pastaDaObra(raiz, bruta); pasta = bruta } catch { pasta = null } }
      let pedido = montarPedidoAjuda(ctx, hist, msg)
      if (pasta) {
        let estado = null
        try { estado = estadoDaObra(pastaDaObra(raiz, pasta)) } catch { estado = null }
        if (estado) pedido += `\n\n## Estado da obra agora (dado)\n${blocoDoCliente(estado, '(nada)').join('\n')}\n\n${INSTRUCAO_OBRA}`
      }
      // Imagem do print: só se FOI este adaptador que a gravou nesta sessão, dentro desta obra (nome conferido por padrão fixo).
      const m = ctx.print && typeof ctx.print.detalhe === 'string' ? RE_IMAGEM_DO_PRINT.exec(ctx.print.detalhe) : null
      const e = m ? emitidos.get(m[1]) : null
      const addDirs = []
      if (pasta && m && e && e.pasta === pasta && fs.existsSync(path.join(e.dir, m[1]))) {
        addDirs.push(e.dir) // só a pasta daquele print (leitura); fica fora da obra
        pedido += `\n\n## Imagem do print\nArquivo do print (é só uma imagem; abra com Read): ${path.join(e.dir, m[1])}`
      }
      pedido += `\n\n${INSTRUCAO_JSON}`
      conversando = true
      try {
        let texto
        try { texto = await disparo.perguntar(pasta, pedido, { timeoutMs: 120_000, maxSaida: 400_000, permitirGit: true, addDirs, tipo: 'ajuda' }) } catch (err) {
          // Obra com config suspeita/sumida não derruba a Ajuda: pergunta sem pasta (nenhuma ferramenta).
          if (pasta && err && (err.message === 'obra-com-config-suspeita' || err.message === 'obra-inexistente' || err.message === 'obra-invalida')) {
            texto = await disparo.perguntar(null, pedido.replace(/\n\n## Imagem do print\n[^\n]*/, ''), { timeoutMs: 120_000, maxSaida: 400_000 })
          } else throw err
        }
        let bruto
        try { bruto = extrairJson(String(texto), 'object') } catch { bruto = { texto: String(texto).slice(0, 4000) } } // não veio JSON: vira só texto
        return normalizarResposta(bruto)
      } finally { conversando = false }
    },

    async abrirPagina(id) {
      if (!ehPaginaId(id)) throw new Error('pagina-fora-da-lista')
      await abrirExterno(shell, PAGINAS_OFICIAIS[id], HOSTS_PAGINAS)
    },

    async tirarPrint(pasta) {
      if (typeof capturar !== 'function') return null
      let png
      try { png = await capturar() } catch { return null }
      if (!Buffer.isBuffer(png) || png.length > MAX_IMAGEM || tipoDaImagem(png) !== 'png') return null
      const dest = pastaDePrints(pasta)
      const nome = nomeNovo('print', 'png')
      try { fs.writeFileSync(path.join(dest.dir, nome), png, { flag: 'wx' }) } catch { return null }
      registrar(nome, dest)
      return retorno(nome, 'Tela do Atlas', 'atlas.local/tela')
    },

    async anexarImagem(pasta) {
      if (!dialog) return null
      const opcoes = { properties: ['openFile'], filters: [{ name: 'Imagens', extensions: EXT_ANEXO }] }
      const j = janela()
      const r = j ? await dialog.showOpenDialog(j, opcoes) : await dialog.showOpenDialog(opcoes)
      if (r.canceled || !r.filePaths[0]) return null
      const origem = r.filePaths[0]
      const ext = path.extname(origem).slice(1).toLowerCase()
      if (!EXT_ANEXO.includes(ext)) return null
      let buf
      try {
        const st = fs.lstatSync(origem)
        if (st.isSymbolicLink() || !st.isFile() || st.size > MAX_IMAGEM) return null
        buf = fs.readFileSync(origem)
      } catch { return null }
      const tipo = tipoDaImagem(buf)
      if (!tipo) return null // SVG, HTML ou executável com nome de imagem
      const dest = pastaDePrints(pasta)
      const nome = nomeNovo('anexo', tipo)
      try { fs.writeFileSync(path.join(dest.dir, nome), buf, { flag: 'wx' }) } catch { return null }
      registrar(nome, dest)
      return retorno(nome, 'Imagem anexada', 'imagem-anexada')
    },
  }
}

const MAX_CASO = 1200
/** Adaptador real de casos não resolvidos. `deps`: { cofre, hashComputador, api (string|null), buscar? }. Sem endereço/token/endpoint: falha honesta. */
function criarCasos({ cofre, hashComputador, api = process.env.ATLAS_API_URL, buscar = globalThis.fetch }) {
  const base = (() => {
    if (typeof api !== 'string' || !api) return null
    try { const u = new URL(api); return u.protocol === 'https:' && !u.username && !u.password ? u.toString().replace(/\/+$/, '') : null } catch { return null }
  })()
  return {
    async enviar(caso) {
      if (!caso || caso.tipo !== 'ajuda_nao_resolvida' || typeof caso.descricao !== 'string' || !caso.descricao.trim()) throw new Error('caso-invalido')
      const descricao = tirarSegredos(caso.descricao).slice(0, MAX_CASO)
      if (!base || typeof buscar !== 'function') throw new Error('indisponivel')
      let ativ = null
      try { const g = JSON.parse((await cofre.ler(CHAVE_COFRE)) ?? 'null'); if (g && typeof g.token === 'string' && g.token) ativ = g } catch { /* sem cofre = sem licença */ }
      if (!ativ) throw new Error('indisponivel')
      const r = await buscar(`${base}/ajuda-caso`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
        headers: { 'Content-Type': 'application/json', 'X-Atlas-Dispositivo': ativ.token },
        body: JSON.stringify({ email: typeof ativ.email === 'string' ? ativ.email : '', computador_hash: await hashComputador(), tipo: 'ajuda_nao_resolvida', descricao }),
      })
      if (!r.ok) throw new Error('indisponivel')
    },
  }
}

module.exports = { criarAjuda, criarCasos, normalizarResposta, montarPedidoAjuda, tirarSegredos, tipoDaImagem, PAGINAS_OFICIAIS, HOSTS_PAGINAS, RECADO_SEM_HUMANO }
