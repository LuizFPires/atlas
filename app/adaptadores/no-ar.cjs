// Colocar no ar com um clique (M56; telas prototipo/caminho-novo/PB1Publicar… PB5NoAr, aprovadas pelo Luiz em 25/11/2026).
// O cliente aperta "Colocar no ar" e o Atlas faz sozinho, nas contas DO CLIENTE já ligadas no começo da obra (contas-cli.cjs):
//   1. vistoria   — o Claude, SÓ LEITOR (disparo.perguntar), confere segredos, RLS, privacidade e build; reprovado => para e mostra
//                   os pontos (tela PB4). "Corrigir e continuar" manda os pontos pela linha da obra (posobra.executar) e recomeça.
//   2. banco      — Supabase do cliente: cria o projeto em São Paulo (sa-east-1) pela API oficial (api.supabase.com, token do cofre),
//                   senha do banco gerada aqui e guardada SÓ no cofre (nunca em arquivo, log ou linha de comando: vai pelo ambiente),
//                   espera ficar pronto, aplica as migrations (`supabase db push`) e publica as funções. Obra sem supabase/ = pula.
//   3. publicar   — Vercel do cliente: cria o projeto com o nome escolhido, grava as variáveis do Supabase (valor pela entrada
//                   padrão, nunca na linha de comando) e publica em produção. Endereço: https://<nome>.vercel.app
//   4. github     — liga o projeto da Vercel ao repositório da obra: mudança aprovada no pós-obra entra no ar sozinha.
//   5. teste      — abre o endereço de verdade e confere que o sistema responde.
//   6. celular    — o endereço vira QR e mensagem de WhatsApp na tela (o QR é feito no app, sem serviço de fora).
// O registro <obra>\.atlas\no-ar.json guarda SÓ o que não é segredo (nome, ref do projeto, endereço, data) para religar sem recriar.
// O Atlas não paga, não cria conta, não digita senha do cliente. Nada destrutivo: banco novo e vazio; projeto existente é reaproveitado.
//
// COMO TESTAR: `node --test app/adaptadores/no-ar.teste.cjs` (sem rede, sem CLI). No Windows/Mac com as contas ligadas: obra a 100% →
// "Colocar no ar" → os 6 passos andam sozinhos e o endereço abre no celular.
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { caminhoSeguro } = require('../seguro.cjs')
const { pastaAtlas, pastaDaObra, gravarAtomico, lerJson } = require('./obra-fs.cjs')
const { extrairJson, umaLinha } = require('./projeto-comum.cjs')

const PASSOS = ['vistoria', 'banco', 'publicar', 'github', 'teste', 'celular']
const NOME = /^[a-z0-9]([a-z0-9-]{1,46}[a-z0-9])$/
const CHAVE_SUPABASE = 'contas/supabase'
const chaveSenha = (pasta) => `no-ar/${crypto.createHash('sha256').update(String(pasta)).digest('hex').slice(0, 16)}/banco`

const nomeValido = (n) => typeof n === 'string' && NOME.test(n) && !n.includes('--')

/** "Ponto da Ampla" -> "pontodaampla" (o mesmo jeito do slugDaObra do front, com hífen permitido). */
function nomeDaObra(texto) {
  const s = String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-')
  return s.slice(0, 40).replace(/-+$/, '') || 'meu-sistema'
}

/** Nomes para sugerir quando o escolhido não está livre. */
function candidatos(base, extra = '') {
  const b = nomeDaObra(base)
  const e = extra ? nomeDaObra(extra) : ''
  const lista = [b, e && `${b}${e}`, e && `${b}-${e}`, e && `${e}-${b}`, `${b}-app`, `meu-${b}`, `${b}-sistema`]
  return [...new Set(lista.filter((n) => n && nomeValido(n)))]
}

/** Nomes das variáveis do Supabase que o app lê (do .env.example da obra). Só nomes: nunca valores. */
function variaveisSupabase(textoEnvExample) {
  const nomes = String(textoEnvExample || '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split('=')[0].trim()).filter((n) => /^[A-Z][A-Z0-9_]{0,80}$/.test(n))
  const url = nomes.filter((n) => /SUPABASE_URL$/.test(n))
  const chave = nomes.filter((n) => /SUPABASE_(ANON|PUBLISHABLE)(_KEY)?$/.test(n))
  return { url, chave }
}

/** A chave pública (anon/publishable) da resposta de /v1/projects/<ref>/api-keys. Nunca a secreta. */
function chavePublica(lista) {
  if (!Array.isArray(lista)) return null
  const ok = (k) => k && typeof k.api_key === 'string' && k.api_key.length > 20
  const pub = lista.find((k) => ok(k) && k.type === 'publishable') || lista.find((k) => ok(k) && k.name === 'anon')
  return pub ? pub.api_key : null
}

/** O que o Claude respondeu na vistoria -> {laudo, achados[]} limpo. Resposta estranha = reprovado (fail-closed). */
function laudoDoTexto(texto) {
  let j = null
  try { j = extrairJson(texto) } catch { j = null }
  if (!j || typeof j !== 'object') return { laudo: 'reprovado', achados: ['Não consegui ler o resultado da vistoria. O Atlas vai conferir de novo.'] }
  const laudo = ['aprovado', 'aprovado-com-ressalvas', 'reprovado'].includes(j.laudo) ? j.laudo : 'reprovado'
  const achados = (Array.isArray(j.bloqueia) ? j.bloqueia : []).slice(0, 6).map((s) => umaLinha(s, 240)).filter(Boolean)
  if (laudo === 'reprovado' && achados.length === 0) achados.push('A vistoria não aprovou, mas não disse o motivo. O Atlas vai conferir de novo.')
  return { laudo, achados: laudo === 'reprovado' ? achados : [] }
}

const PEDIDO_VISTORIA = [
  'Você é o vistoriador (habite-se). Esta obra vai para a internet agora. Só LEIA: não altere nada.',
  'Confira e aponte só o que impede abrir ao público:',
  '1. Segredos no código (chaves, tokens, service_role, arquivos .env versionados). A service_role nunca no front.',
  '2. Toda tabela com dados de pessoas em supabase/migrations tem RLS ligado e políticas (cada pessoa vê só o que é dela).',
  '3. Existe página de privacidade (LGPD) se o app tem cadastro; existe jeito de apagar a conta.',
  '4. O .env.example lista todas as variáveis que o app lê.',
  'Explique cada problema em uma frase em português simples, para quem não programa (ex.: "Um funcionário conseguia ver o ponto de outro funcionário.").',
  'Responda SOMENTE com JSON: {"laudo":"aprovado|aprovado-com-ressalvas|reprovado","bloqueia":["frase simples"]}',
].join('\n')

/**
 * deps:
 *  raiz, cofre
 *  vercel(args, {cwd, entrada?, timeoutMs?}) -> {codigo, saida}      (CLI do cliente, contas-cli.rodarFerramenta)
 *  supabase(args, {cwd, env?, timeoutMs?}) -> {codigo, saida}
 *  git(args, {cwd}) -> {codigo, saida}
 *  apiSupabase(metodo, caminho, corpo|null, token) -> json            (só api.supabase.com)
 *  sondar(url) -> {status, cabecalhos, corpo}                         (só https://<nome>.vercel.app)
 *  perguntar(pasta, pedido) -> texto                                  (disparo só leitor)
 *  corrigir(pasta, achados[]) -> void                                 (posobra pela linha da obra)
 *  linhaRodando(pasta) -> boolean                                     (a correção ainda está na linha?)
 *  esperar(ms), agora(), gerarSenha()
 */
// Saída das ferramentas do banco (Supabase CLI): o que é defeito da obra (SQL) e o que é conexão. Resumo sem segredos.
const RE_SQL = /SQLSTATE|syntax error|does not exist|already exists|violates|ERROR:\s|at statement \d+/i
const RE_CONEXAO = /connect|timeout|timed out|no route|network|unreachable|dial tcp|i\/o|ECONN|EAI_AGAIN|temporarily unavailable/i
function erroDeSql(saida) { return RE_SQL.test(saida) && !/password authentication failed/i.test(saida) }
function erroDeConexao(saida) { return RE_CONEXAO.test(saida) }
/** As linhas que explicam o erro (ERROR, statement, hint), sem endereço de conexão, senha, chave ou token; no máximo 600 letras. */
function resumoDoErro(saida) {
  const limpas = String(saida)
    .replace(/postgres(ql)?:\/\/\S+/gi, '[conexão]')
    .replace(/\b(sbp_|sb_secret_|eyJ)[A-Za-z0-9._-]{10,}/g, '[chave]')
    .replace(/(password|senha|pass)\s*[=:]\s*\S+/gi, '$1=[oculta]')
    .split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const importantes = limpas.filter((l) => /error|erro|statement|hint|detail|failed|falhou/i.test(l))
  return (importantes.length ? importantes : limpas.slice(-4)).join(' · ').slice(0, 600)
}

function criarNoAr({ raiz, cofre, vercel, supabase, git, apiSupabase, sondar, perguntar, corrigir, linhaRodando = () => false, esperar = (ms) => new Promise((r) => setTimeout(r, ms)), agora = () => new Date(), gerarSenha = () => crypto.randomBytes(24).toString('base64url'), esperaBancoMs = 10_000, tentativasBanco = 60, esperaCotaMs = 10 * 60_000, esperasCota = 7 * 24 * 6 }) {
  const jobs = new Map() // pasta -> estado vivo

  const arquivoRegistro = (pasta) => caminhoSeguro(raiz, String(pasta), '.atlas', 'no-ar.json')
  const lerRegistro = (pasta) => {
    let j = null
    try { j = lerJson(arquivoRegistro(pasta)) } catch { j = null }
    if (!j || typeof j !== 'object') return {}
    const out = {}
    if (nomeValido(j.nome)) out.nome = j.nome
    if (typeof j.ref === 'string' && /^[a-z0-9]{10,40}$/.test(j.ref)) out.ref = j.ref
    if (typeof j.endereco === 'string' && /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(j.endereco)) out.endereco = j.endereco
    if (typeof j.quando === 'string') out.quando = j.quando.slice(0, 40)
    return out
  }
  const gravarRegistro = (pasta, r) => { pastaAtlas(raiz, String(pasta)); gravarAtomico(arquivoRegistro(pasta), JSON.stringify({ versao: 1, ...r }) + '\n') }
  const cwdDe = (pasta) => pastaDaObra(raiz, String(pasta))

  const novoEstado = (nome) => ({ fase: 'rodando', nome, passos: Object.fromEntries(PASSOS.map((p) => [p, 'falta'])), achados: [], endereco: null, erro: null, avisos: [], esperandoCota: false })
  const publico = (e) => e && ({ fase: e.fase, nome: e.nome, passos: PASSOS.map((id) => ({ id, estado: e.passos[id] })), achados: [...e.achados], endereco: e.endereco, erro: e.erro, avisos: [...e.avisos], esperandoCota: e.esperandoCota === true })

  async function nomeLivre(nome, pasta = null) {
    if (!nomeValido(nome)) return 'invalido'
    if (pasta) { const r = lerRegistro(pasta); if (r.nome === nome) return 'seu' }
    try {
      const r = await sondar(`https://${nome}.vercel.app/`)
      const erro = String((r.cabecalhos && (r.cabecalhos['x-vercel-error'] || r.cabecalhos['X-Vercel-Error'])) || '')
      if (r.status === 404 && erro === 'DEPLOYMENT_NOT_FOUND') return 'livre'
      if (r.status >= 200 && r.status < 500) return 'ocupado'
      return 'incerto'
    } catch { return 'incerto' }
  }

  /** Defeitos da obra que a linha corrige (o texto vai como o pedido de correção). */
  const CORRIGIVEIS = {
    'supabase-migrations': (det) => `As tabelas do banco não subiram no Supabase de verdade (supabase/migrations). Corrija as migrations para que "supabase db push" rode limpo num banco novo, sem apagar dados.${det ? ` Erro do banco: ${det}` : ''}`,
    'vercel-build': (det) => `O sistema não compila na Vercel ("npm run build" falhou). Corrija para que o build de produção passe limpo.${det ? ` Erro do build: ${det}` : ''}`,
    'supabase-funcoes': (det) => `As funções do servidor (supabase/functions) não subiram no Supabase. Corrija para que "supabase functions deploy" funcione.${det ? ` Erro: ${det}` : ''}`,
  }

  async function passoBanco(pasta, e) {
    const cwd = cwdDe(pasta)
    if (!fs.existsSync(path.join(cwd, 'supabase'))) return null // obra sem banco
    let token = null
    try { token = await cofre.ler(CHAVE_SUPABASE) } catch { token = null }
    if (!token) throw Object.assign(new Error('sem-conta-supabase'), { passo: 'banco' })
    const reg = lerRegistro(pasta)
    let ref = reg.ref
    let senha = null
    try { senha = await cofre.ler(chaveSenha(pasta)) } catch { senha = null }
    if (!ref) {
      const orgs = await apiSupabase('GET', '/v1/organizations', null, token)
      const org = Array.isArray(orgs) ? orgs.find((o) => o && typeof o.slug === 'string') || orgs.find((o) => o && typeof o.id === 'string') : null
      if (!org) throw Object.assign(new Error('supabase-sem-organizacao'), { passo: 'banco' })
      senha = gerarSenha()
      await cofre.guardar(chaveSenha(pasta), senha)
      const criado = await apiSupabase('POST', '/v1/projects', { name: e.nome, organization_slug: org.slug || org.id, db_pass: senha, region: 'sa-east-1' }, token)
      ref = criado && typeof criado.id === 'string' ? criado.id : (criado && criado.ref)
      if (typeof ref !== 'string' || !/^[a-z0-9]{10,40}$/.test(ref)) throw Object.assign(new Error('supabase-nao-criou'), { passo: 'banco' })
      gravarRegistro(pasta, { ...reg, nome: e.nome, ref })
    }
    for (let i = 0; i < tentativasBanco; i++) {
      const p = await apiSupabase('GET', `/v1/projects/${ref}`, null, token)
      if (p && p.status === 'ACTIVE_HEALTHY') break
      if (p && /FAILED|REMOVED/.test(String(p.status))) throw Object.assign(new Error('supabase-falhou'), { passo: 'banco' })
      if (i === tentativasBanco - 1) throw Object.assign(new Error('supabase-demorou'), { passo: 'banco' })
      await esperar(esperaBancoMs)
    }
    const envBanco = { SUPABASE_ACCESS_TOKEN: token, ...(senha ? { SUPABASE_DB_PASSWORD: senha } : {}) }
    if (fs.existsSync(path.join(cwd, 'supabase', 'migrations'))) {
      // Banco recém-criado às vezes ainda não aceita conexão: tenta de novo sozinho. Erro de SQL é defeito da obra: não adianta
      // repetir; vai resumido (sem senha nem endereço de conexão) para a tela e, no "Corrigir e continuar", para a linha (26/11/2026).
      for (let i = 0; ; i++) {
        const l = await supabase(['link', '--project-ref', ref], { cwd, env: envBanco, timeoutMs: 120_000 })
        const d = l.codigo === 0 ? await supabase(['db', 'push', '--yes'], { cwd, env: envBanco, timeoutMs: 300_000 }) : l
        if (d.codigo === 0) break
        const saida = String(d.saida || '')
        if (erroDeSql(saida)) throw Object.assign(new Error('supabase-migrations'), { passo: 'banco', detalhe: resumoDoErro(saida) })
        if (i >= 2) throw Object.assign(new Error(erroDeConexao(saida) ? 'supabase-conexao' : l.codigo !== 0 ? 'supabase-link' : 'supabase-migrations'), { passo: 'banco', detalhe: resumoDoErro(saida) })
        await esperar(esperaBancoMs)
      }
    }
    const pastaFn = path.join(cwd, 'supabase', 'functions')
    if (fs.existsSync(pastaFn)) {
      for (const f of fs.readdirSync(pastaFn, { withFileTypes: true })) {
        if (!f.isDirectory() || f.name.startsWith('_') || !/^[a-z0-9][a-z0-9_-]{0,60}$/i.test(f.name)) continue
        const r = await supabase(['functions', 'deploy', f.name, '--project-ref', ref], { cwd, env: envBanco, timeoutMs: 300_000 })
        if (r.codigo !== 0) throw Object.assign(new Error('supabase-funcoes'), { passo: 'banco', detalhe: resumoDoErro(String(r.saida || '')) })
      }
    }
    const chaves = await apiSupabase('GET', `/v1/projects/${ref}/api-keys`, null, token)
    return { url: `https://${ref}.supabase.co`, chave: chavePublica(chaves) }
  }

  async function passoPublicar(pasta, e, banco) {
    const cwd = cwdDe(pasta)
    await vercel(['project', 'add', e.nome], { cwd, timeoutMs: 60_000 }) // já existe = segue (é dele)
    const l = await vercel(['link', '--yes', '--project', e.nome], { cwd, timeoutMs: 60_000 })
    if (l.codigo !== 0) throw Object.assign(new Error('vercel-link'), { passo: 'publicar' })
    if (banco) {
      let exemplo = ''
      try { exemplo = fs.readFileSync(path.join(cwd, '.env.example'), 'utf8') } catch { exemplo = '' }
      const nomes = variaveisSupabase(exemplo)
      const valores = [...nomes.url.map((n) => [n, banco.url]), ...(banco.chave ? nomes.chave.map((n) => [n, banco.chave]) : [])]
      for (const [n, v] of valores) {
        const r = await vercel(['env', 'add', n, 'production', '--force'], { cwd, entrada: v, timeoutMs: 60_000 })
        if (r.codigo !== 0) throw Object.assign(new Error('vercel-variaveis'), { passo: 'publicar' })
      }
      if (nomes.url.length === 0) e.avisos.push('O sistema não diz onde lê o endereço do banco (.env.example). O Atlas publicou mesmo assim.')
    }
    const d = await vercel(['deploy', '--prod', '--yes'], { cwd, timeoutMs: 900_000 })
    if (d.codigo !== 0) {
      // O sistema não compila na Vercel: é defeito da obra, a linha corrige ("Corrigir e continuar"). Outro erro: conta ou Vercel fora.
      const saida = String(d.saida || '')
      const build = /error TS\d+|Command ".*build.*" exited|Build failed|Module not found|SyntaxError|Failed to compile/i.test(saida)
      throw Object.assign(new Error(build ? 'vercel-build' : 'vercel-deploy'), { passo: 'publicar', detalhe: resumoDoErro(saida) })
    }
    return `https://${e.nome}.vercel.app`
  }

  async function passoGithub(pasta) {
    const cwd = cwdDe(pasta)
    const r = await git(['remote', 'get-url', 'origin'], { cwd })
    const url = String(r.saida || '').trim()
    if (r.codigo !== 0 || !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?(\.git)?$/.test(url)) return false
    const c = await vercel(['git', 'connect', '--yes'], { cwd, timeoutMs: 60_000 })
    return c.codigo === 0
  }

  async function passoTeste(endereco) {
    for (let i = 0; i < 6; i++) {
      try {
        const r = await sondar(`${endereco}/`)
        if (r.status === 200 && /<html|<!doctype/i.test(String(r.corpo || ''))) return true
      } catch { /* tenta de novo */ }
      await esperar(10_000)
    }
    return false
  }

  /** A vistoria usa o Claude. Cota acabou ('claude-cota'): não é erro, a obra espera renovar sozinha (a tela mostra que está
   *  esperando) e continua de onde parou. Depois de ~7 dias tentando, vira erro explicado com "Tentar de novo". */
  async function vistoriaEsperandoCota(pasta, e) {
    for (let i = 0; ; i++) {
      try {
        const texto = await perguntar(pasta, PEDIDO_VISTORIA)
        e.esperandoCota = false
        return texto
      } catch (err) {
        if (!(err && err.message === 'claude-cota') || i >= esperasCota) { e.esperandoCota = false; throw err }
        e.esperandoCota = true
        await esperar(esperaCotaMs)
      }
    }
  }

  async function rodar(pasta, e, { pularVistoria = false } = {}) {
    const marca = (p, s) => { e.passos[p] = s }
    try {
      if (!pularVistoria) {
        marca('vistoria', 'agora')
        const laudo = laudoDoTexto(await vistoriaEsperandoCota(pasta, e))
        if (laudo.laudo === 'reprovado') { marca('vistoria', 'atencao'); e.achados = laudo.achados; e.fase = 'vistoria'; return }
      }
      marca('vistoria', 'feito')
      marca('banco', 'agora')
      const banco = await passoBanco(pasta, e)
      marca('banco', banco ? 'feito' : 'pulado')
      marca('publicar', 'agora')
      const endereco = await passoPublicar(pasta, e, banco)
      gravarRegistro(pasta, { ...lerRegistro(pasta), nome: e.nome, endereco, quando: agora().toISOString() })
      marca('publicar', 'feito')
      marca('github', 'agora')
      const ligado = await passoGithub(pasta)
      marca('github', ligado ? 'feito' : 'atencao')
      if (!ligado) e.avisos.push('Não consegui ligar a publicação automática ao GitHub. As próximas mudanças o Atlas publica pelo botão.')
      marca('teste', 'agora')
      const ok = await passoTeste(endereco)
      if (!ok) throw Object.assign(new Error('teste-falhou'), { passo: 'teste' })
      marca('teste', 'feito')
      marca('celular', 'feito')
      e.endereco = endereco
      e.fase = 'noar'
    } catch (err) {
      const passo = err && err.passo && PASSOS.includes(err.passo) ? err.passo : PASSOS.find((p) => e.passos[p] === 'agora') || 'publicar'
      marca(passo, 'erro')
      e.fase = 'erro'
      e.erro = { passo, motivo: String((err && err.message) || 'falhou').slice(0, 60), ...(err && typeof err.detalhe === 'string' && err.detalhe ? { detalhe: err.detalhe } : {}) }
    }
  }

  return {
    PASSOS,
    nomeLivre,
    /** Nome sugerido (o do registro, se já publicou) e alternativas livres. */
    async sugerir(pasta, obraNome, extra = '') {
      const reg = lerRegistro(pasta)
      if (reg.nome) return { nome: reg.nome, livres: [reg.nome] }
      const livres = []
      for (const n of candidatos(obraNome, extra)) {
        if (livres.length >= 4) break
        if ((await nomeLivre(n)) === 'livre') livres.push(n)
      }
      return { nome: livres[0] || null, livres }
    },
    /** Começa (ou recomeça) a colocar no ar. Não espera terminar: a tela acompanha por estado(). */
    async iniciar(pasta, nome) {
      pasta = String(pasta)
      cwdDe(pasta)
      if (!nomeValido(nome)) throw new Error('nome-invalido')
      const atual = jobs.get(pasta)
      if (atual && atual.fase === 'rodando') throw new Error('ja-rodando')
      const situacao = await nomeLivre(nome, pasta)
      if (situacao === 'ocupado' || situacao === 'invalido') throw new Error('nome-ocupado')
      const e = novoEstado(nome)
      jobs.set(pasta, e)
      e.promessa = rodar(pasta, e)
      return publico(e)
    },
    estado(pasta) {
      pasta = String(pasta)
      const e = jobs.get(pasta)
      if (e) return publico(e)
      const reg = lerRegistro(pasta)
      if (reg.endereco) return { fase: 'noar', nome: reg.nome || null, passos: PASSOS.map((id) => ({ id, estado: 'feito' })), achados: [], endereco: reg.endereco, erro: null, avisos: [] }
      return { fase: 'parado', nome: reg.nome || null, passos: PASSOS.map((id) => ({ id, estado: 'falta' })), achados: [], endereco: null, erro: null, avisos: [] }
    },
    /** A vistoria achou pontos: manda pela linha da obra e recomeça sozinho quando a linha terminar (a tela chama de novo). */
    /**
     * Antes de colocar no ar (o Atlas é autoexplicativo, 26/11/2026): a obra precisa de banco? Vai criar um novo? A conta do
     * Supabase está ligada? Quantos bancos ATIVOS ela já tem (a conta grátis aceita 2)? Nunca trava: se a API não responde,
     * bancosAtivos fica null e a tela só não mostra a contagem.
     */
    async conferirAntes(pasta) {
      pasta = String(pasta)
      let token = null
      try { token = await cofre.ler(CHAVE_SUPABASE) } catch { token = null }
      const contaLigada = Boolean(token)
      if (!fs.existsSync(path.join(cwdDe(pasta), 'supabase'))) return { precisaBanco: false, bancoNovo: false, contaLigada, bancosAtivos: null }
      const bancoNovo = !lerRegistro(pasta).ref
      if (!contaLigada || !bancoNovo) return { precisaBanco: true, bancoNovo, contaLigada, bancosAtivos: null }
      let bancosAtivos = null
      try {
        const lista = await apiSupabase('GET', '/v1/projects', null, token)
        if (Array.isArray(lista)) bancosAtivos = lista.filter((p) => p && typeof p.status === 'string' && !/INACTIVE|PAUS|REMOVED|GOING_DOWN|FAILED/.test(p.status)).length
      } catch { bancosAtivos = null }
      return { precisaBanco: true, bancoNovo, contaLigada, bancosAtivos }
    },
    async corrigir(pasta) {
      pasta = String(pasta)
      const e = jobs.get(pasta)
      // Corrige pela linha: os pontos da vistoria OU um erro que é defeito da obra (tabelas ou funções do banco que não subiram).
      const doBanco = e && e.fase === 'erro' && e.erro && CORRIGIVEIS[e.erro.motivo] ? [CORRIGIVEIS[e.erro.motivo](e.erro.detalhe || '')] : null
      if (!e || (!doBanco && (e.fase !== 'vistoria' || e.achados.length === 0))) throw new Error('nada-para-corrigir')
      await corrigir(pasta, doBanco || e.achados)
      e.fase = 'corrigindo'
      e.achados = []
      // Quando a linha terminar a correção, recomeça sozinho pela vistoria (confere de novo antes de abrir as portas).
      e.promessa = (async () => {
        await esperar(15_000)
        for (let i = 0; i < 2880 && linhaRodando(pasta); i++) await esperar(15_000)
        Object.assign(e, novoEstado(e.nome))
        await rodar(pasta, e)
      })()
      return publico(e)
    },
    /** Teste: espera o trabalho em andamento. */
    _esperar: (pasta) => (jobs.get(String(pasta)) || {}).promessa,
  }
}

module.exports = { criarNoAr, nomeValido, nomeDaObra, candidatos, variaveisSupabase, chavePublica, laudoDoTexto, chaveSenha, PASSOS, PEDIDO_VISTORIA }
