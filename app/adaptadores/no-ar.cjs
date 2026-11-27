// Colocar no ar com um clique (M56; telas prototipo/caminho-novo/PB1Publicar… PB5NoAr, aprovadas pelo Luiz em 25/11/2026).
// O cliente aperta "Colocar no ar" e o Atlas faz sozinho, nas contas DO CLIENTE já ligadas no começo da obra (contas-cli.cjs):
//   1. vistoria   — o Claude, SÓ LEITOR (disparo.perguntar), confere segredos, RLS, privacidade e build; reprovado => para e mostra
//                   os pontos (tela PB4). "Corrigir e continuar" manda os pontos pela linha da obra (posobra.executar) e recomeça.
//   2. banco      — Supabase do cliente: cria o projeto em São Paulo (sa-east-1) pela API oficial (api.supabase.com, token do cofre),
//                   senha do banco gerada aqui e guardada SÓ no cofre (nunca em arquivo, log ou linha de comando: vai pelo ambiente),
//                   espera ficar pronto, aplica as migrations pela API de gestão (HTTPS, sem conexão direta ao Postgres) e publica as funções. Obra sem supabase/ = pula.
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
// Saída da CLI ao publicar funções: falta de permissão e instabilidade (internet, Supabase fora) NÃO são defeito da obra.
const RE_SEM_PERMISSAO = /\b(401|403)\b|unauthori[sz]ed|forbidden|invalid access token/i
const { RE_INSTAVEL, RE_BUILD } = require('./contas-cli.cjs')
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

function criarNoAr({ raiz, cofre, vercel, supabase, git, apiSupabase, sondar, perguntar, corrigir, linhaRodando = () => false, esperar = (ms) => new Promise((r) => setTimeout(r, ms)), agora = () => new Date(), gerarSenha = () => crypto.randomBytes(24).toString('base64url'), esperaBancoMs = 10_000, tentativasBanco = 120, esperaCotaMs = 10 * 60_000, esperasCota = 7 * 24 * 6 }) {
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

  const novoEstado = (nome) => ({ fase: 'rodando', nome, passos: Object.fromEntries(PASSOS.map((p) => [p, 'falta'])), achados: [], endereco: null, erro: null, avisos: [], esperandoCota: false, sub: null, duracoes: {}, diario: [], inicioPasso: null })
  const publico = (e) => e && ({ fase: e.fase, nome: e.nome, passos: PASSOS.map((id) => ({ id, estado: e.passos[id] })), achados: [...e.achados], endereco: e.endereco, erro: e.erro, avisos: [...e.avisos], esperandoCota: e.esperandoCota === true, sub: e.sub ? { ...e.sub } : null, duracoes: { ...(e.duracoes || {}) }, diario: (e.diario || []).map((l) => ({ ...l })) })

  // Acompanhamento (PG1Progresso, 27/11/2026): o que a etapa faz agora, quanto já foi DE VERDADE e o diário com hora.
  const ms = () => agora().getTime()
  /** O que a etapa está fazendo agora. pct = contagem real (null: a tela anda pelo tempo de costume, em segundos). */
  const sub = (e, texto, { pct = null, costume = null } = {}) => { e.sub = { texto, pct: pct === null ? null : Math.max(0, Math.min(100, Math.round(pct))), costume, inicio: e.inicioPasso || ms(), noticia: ms() } }
  /** Notícia de verdade: vai para o diário (com hora) e renova o sinal de vida. */
  const contar = (e, texto) => {
    e.diario.push({ hora: agora().toISOString(), texto })
    if (e.diario.length > 30) e.diario.splice(0, e.diario.length - 30)
    if (e.sub) e.sub.noticia = ms()
  }
  /** Só renova o sinal de vida (conferiu e ainda não mudou). */
  const vivo = (e) => { if (e.sub) e.sub.noticia = ms() }

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

  /** Lê os .sql de supabase/migrations em ordem de nome. */
  function migrationsDaObra(cwd) {
    const dir = path.join(cwd, 'supabase', 'migrations')
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir).filter((f) => /^[A-Za-z0-9_.-]+\.sql$/.test(f)).sort()
      .map((arquivo) => ({ arquivo, versao: arquivo.split('_')[0].replace(/\.sql$/, ''), nome: arquivo.replace(/\.sql$/, '').split('_').slice(1).join('_'), sql: fs.readFileSync(path.join(dir, arquivo), 'utf8') }))
  }
  const literal = (t) => `'${String(t).replace(/'/g, "''")}'`
  /** Uma consulta no banco pela API (até 6 tentativas, ~1 min, para banco recém-criado ou internet instável). */
  async function consultar(ref, token, query, { arquivo = null } = {}) {
    for (let i = 0; ; i++) {
      try { return await apiSupabase('POST', `/v1/projects/${ref}/database/query`, { query }, token) } catch (err) {
        const m = String((err && err.message) || '')
        if (m === 'supabase-401' || m === 'supabase-403') throw Object.assign(new Error('supabase-sem-permissao-banco'), { passo: 'banco' })
        if (/^supabase-4\d\d$/.test(m) && m !== 'supabase-408' && m !== 'supabase-429') {
          const det = resumoDoErro(String(err.detalhe || m))
          throw Object.assign(new Error('supabase-migrations'), { passo: 'banco', detalhe: (arquivo ? `${arquivo}: ` : '') + det })
        }
        if (i >= 5) throw Object.assign(new Error('supabase-conexao'), { passo: 'banco' }) // ~1 min: banco recém-ligado esquentando
        await esperar(esperaBancoMs)
      }
    }
  }
  async function aplicarMigrations(cwd, ref, token, e) {
    const lista = migrationsDaObra(cwd)
    if (!lista.length) return
    await consultar(ref, token, 'create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);')
    const feitas = await consultar(ref, token, 'select version from supabase_migrations.schema_migrations;')
    const ja = new Set((Array.isArray(feitas) ? feitas : []).map((r) => r && String(r.version)))
    let i = 0
    for (const m of lista) {
      i++
      sub(e, `Criando as tabelas · ${i} de ${lista.length}`, { pct: 40 + (35 * (i - 1)) / lista.length })
      if (ja.has(m.versao)) continue
      const registro = `insert into supabase_migrations.schema_migrations (version, name) values (${literal(m.versao)}, ${literal(m.nome)}) on conflict (version) do nothing;`
      // Numa transação só (como o CLI): falhou no meio = nada fica pela metade. "concurrently" não roda em transação.
      const solta = /\bconcurrently\b/i.test(m.sql) || /^\s*(begin|commit|start transaction)\b/im.test(m.sql)
      const query = solta ? `${m.sql}\n;\n${registro}` : `begin;\n${m.sql}\n;\n${registro}\ncommit;`
      await consultar(ref, token, query, { arquivo: m.arquivo })
    }
    contar(e, `Tabelas prontas: ${lista.length} ${lista.length === 1 ? 'arquivo' : 'arquivos'}.`)
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
      sub(e, 'Criando o banco em São Paulo', { pct: 5 })
      const orgs = await apiSupabase('GET', '/v1/organizations', null, token)
      const org = Array.isArray(orgs) ? orgs.find((o) => o && typeof o.slug === 'string') || orgs.find((o) => o && typeof o.id === 'string') : null
      if (!org) throw Object.assign(new Error('supabase-sem-organizacao'), { passo: 'banco' })
      senha = gerarSenha()
      await cofre.guardar(chaveSenha(pasta), senha)
      const criado = await apiSupabase('POST', '/v1/projects', { name: e.nome, organization_slug: org.slug || org.id, db_pass: senha, region: 'sa-east-1' }, token)
      ref = criado && typeof criado.id === 'string' ? criado.id : (criado && criado.ref)
      if (typeof ref !== 'string' || !/^[a-z0-9]{10,40}$/.test(ref)) throw Object.assign(new Error('supabase-nao-criou'), { passo: 'banco' })
      gravarRegistro(pasta, { ...reg, nome: e.nome, ref })
      contar(e, 'Banco criado no Supabase, em São Paulo.')
    }
    for (let i = 0; i < tentativasBanco; i++) {
      // Sem contagem possível: o Supabase só diz "ainda não". A barra anda pelo tempo de costume (10% a 40%).
      if (i === 0) sub(e, 'Esperando o Supabase ligar o banco', { pct: 10 })
      const p = await apiSupabase('GET', `/v1/projects/${ref}`, null, token)
      vivo(e)
      if (e.sub && i > 0) e.sub.pct = Math.min(38, 10 + Math.round((i * esperaBancoMs) / 1000 / 300 * 28))
      if (p && p.status === 'ACTIVE_HEALTHY') { contar(e, 'O Supabase ligou o banco.'); break }
      if (p && /FAILED|REMOVED/.test(String(p.status))) throw Object.assign(new Error('supabase-falhou'), { passo: 'banco' })
      if (i === tentativasBanco - 1) throw Object.assign(new Error('supabase-demorou'), { passo: 'banco' })
      await esperar(esperaBancoMs)
    }
    const envBanco = { SUPABASE_ACCESS_TOKEN: token }
    // Migrations pela API de gestão do Supabase (HTTPS, a mesma que já criou o projeto), NUNCA pela conexão direta do Postgres
    // (`supabase link` + `db push`): essa conexão é bloqueada em muitas redes (porta 5432/6543, IPv6) e travava o passo para
    // sempre em "o banco não aceitou a conexão" (Guilherme, 27/11/2026). Registro na mesma tabela do Supabase CLI.
    await aplicarMigrations(cwd, ref, token, e)
    const pastaFn = path.join(cwd, 'supabase', 'functions')
    if (fs.existsSync(pastaFn)) {
      const funcoes = fs.readdirSync(pastaFn, { withFileTypes: true }).filter((f) => f.isDirectory() && !f.name.startsWith('_') && /^[a-z0-9][a-z0-9_-]{0,60}$/i.test(f.name))
      let j = 0
      for (const f of funcoes) {
        j++
        sub(e, `Publicando as funções · ${j} de ${funcoes.length}`, { pct: 75 + (20 * (j - 1)) / funcoes.length })
        // --use-api: o próprio Supabase monta a função (HTTPS). Sem Docker no computador do cliente e sem conexão direta ao banco.
        for (let i = 0; ; i++) {
          const r = await supabase(['functions', 'deploy', f.name, '--project-ref', ref, '--use-api'], { cwd, env: envBanco, timeoutMs: 300_000 })
          if (r.codigo === 0) break
          const saida = String(r.saida || '')
          if (RE_SEM_PERMISSAO.test(saida)) throw Object.assign(new Error('supabase-sem-permissao-banco'), { passo: 'banco' })
          if (!RE_INSTAVEL.test(saida)) throw Object.assign(new Error('supabase-funcoes'), { passo: 'banco', detalhe: resumoDoErro(saida) })
          if (i >= 2) throw Object.assign(new Error('supabase-conexao'), { passo: 'banco' })
          await esperar(esperaBancoMs)
        }
      }
      if (funcoes.length) contar(e, `Funções do servidor publicadas: ${funcoes.length}.`)
    }
    sub(e, 'Buscando a chave pública do banco', { pct: 95 })
    // A chave pública do banco às vezes aparece só alguns instantes depois do banco pronto: busca de novo. Sem ela o sistema
    // publicaria quebrado (não fala com o banco), então para com o motivo explicado em vez de fingir que deu certo.
    let chave = null
    for (let i = 0; i < 6 && !chave; i++) {
      if (i) await esperar(esperaBancoMs)
      try { chave = chavePublica(await apiSupabase('GET', `/v1/projects/${ref}/api-keys`, null, token)) } catch { chave = null }
    }
    if (!chave) throw Object.assign(new Error('supabase-sem-chave'), { passo: 'banco' })
    contar(e, 'Banco pronto.')
    return { url: `https://${ref}.supabase.co`, chave }
  }

  /** Vercel: tenta de novo (até 3 vezes) quando o erro é internet ou a Vercel instável; erro de verdade (build, conta) volta na hora. */
  async function vercelTentando(args, o) {
    for (let i = 0; ; i++) {
      const r = await vercel(args, o)
      if (r.codigo === 0 || i >= 2 || RE_BUILD.test(String(r.saida || '')) || !RE_INSTAVEL.test(String(r.saida || ''))) return r
      await esperar(esperaBancoMs)
    }
  }

  async function passoPublicar(pasta, e, banco) {
    const cwd = cwdDe(pasta)
    sub(e, 'Ligando a obra à sua conta Vercel', { pct: 5 })
    await vercel(['project', 'add', e.nome], { cwd, timeoutMs: 60_000 }) // já existe = segue (é dele)
    const l = await vercelTentando(['link', '--yes', '--project', e.nome], { cwd, timeoutMs: 60_000 })
    if (l.codigo !== 0) throw Object.assign(new Error('vercel-link'), { passo: 'publicar' })
    if (banco) {
      let exemplo = ''
      try { exemplo = fs.readFileSync(path.join(cwd, '.env.example'), 'utf8') } catch { exemplo = '' }
      const nomes = variaveisSupabase(exemplo)
      const valores = [...nomes.url.map((n) => [n, banco.url]), ...(banco.chave ? nomes.chave.map((n) => [n, banco.chave]) : [])]
      let k = 0
      for (const [n, v] of valores) {
        k++
        sub(e, `Gravando o endereço do banco · ${k} de ${valores.length}`, { pct: 10 + (10 * (k - 1)) / valores.length })
        const r = await vercelTentando(['env', 'add', n, 'production', '--force'], { cwd, entrada: v, timeoutMs: 60_000 })
        if (r.codigo !== 0) throw Object.assign(new Error('vercel-variaveis'), { passo: 'publicar' })
      }
      if (nomes.url.length === 0) e.avisos.push('O sistema não diz onde lê o endereço do banco (.env.example). O Atlas publicou mesmo assim.')
      if (valores.length) contar(e, 'Endereço do banco gravado na Vercel.')
    }
    // A Vercel só responde no fim: a barra anda pelo tempo de costume (2 a 4 min) e para em 90% até a resposta.
    sub(e, 'Montando a versão final na Vercel', { costume: [120, 240] })
    const d = await vercelTentando(['deploy', '--prod', '--yes'], { cwd, timeoutMs: 900_000 })
    if (d.codigo !== 0) {
      // O sistema não compila na Vercel: é defeito da obra, a linha corrige ("Corrigir e continuar"). Outro erro: conta ou Vercel fora.
      const saida = String(d.saida || '')
      const build = RE_BUILD.test(saida)
      throw Object.assign(new Error(build ? 'vercel-build' : 'vercel-deploy'), { passo: 'publicar', detalhe: resumoDoErro(saida) })
    }
    contar(e, `A Vercel publicou o sistema em ${e.nome}.vercel.app.`)
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

  async function passoTeste(endereco, e) {
    // Endereço novo: o DNS e o cadeado (https) podem levar alguns minutos para chegar a este computador. Espera até ~5 min.
    for (let i = 0; i < 30; i++) {
      sub(e, i ? `Abrindo o endereço · tentativa ${i + 1}` : 'Abrindo o endereço de verdade', { costume: [5, 120] })
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
    const marca = (p, s) => {
      if (s === 'agora') { e.inicioPasso = ms(); e.sub = null }
      else if (e.passos[p] === 'agora') { if (e.inicioPasso) e.duracoes[p] = Math.max(0, ms() - e.inicioPasso); e.sub = null }
      e.passos[p] = s
    }
    try {
      if (!pularVistoria) {
        marca('vistoria', 'agora')
        sub(e, 'Conferindo segurança, privacidade e acessos', { costume: [60, 180] })
        const laudo = laudoDoTexto(await vistoriaEsperandoCota(pasta, e))
        if (laudo.laudo === 'reprovado') { marca('vistoria', 'atencao'); e.achados = laudo.achados; e.fase = 'vistoria'; return }
      }
      if (!pularVistoria) contar(e, 'Vistoria aprovada.')
      marca('vistoria', 'feito')
      marca('banco', 'agora')
      const banco = await passoBanco(pasta, e)
      marca('banco', banco ? 'feito' : 'pulado')
      marca('publicar', 'agora')
      const endereco = await passoPublicar(pasta, e, banco)
      gravarRegistro(pasta, { ...lerRegistro(pasta), nome: e.nome, endereco, quando: agora().toISOString() })
      marca('publicar', 'feito')
      marca('github', 'agora')
      sub(e, 'Ligando a publicação ao seu repositório', { costume: [5, 30] })
      const ligado = await passoGithub(pasta)
      marca('github', ligado ? 'feito' : 'atencao')
      if (!ligado) e.avisos.push('Não consegui ligar a publicação automática ao GitHub. As próximas mudanças o Atlas publica pelo botão.')
      marca('teste', 'agora')
      const ok = await passoTeste(endereco, e)
      if (!ok) throw Object.assign(new Error('teste-falhou'), { passo: 'teste' })
      contar(e, 'O sistema respondeu no endereço de verdade.')
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
