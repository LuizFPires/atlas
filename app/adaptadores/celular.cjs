// Adaptador real do PonteCelular (src/app/ponte-celular.ts) — processo principal do Electron (só Windows).
//
// O QUE FAZ (e o que NÃO faz)
//  enderecoApp(): o endereço de download do app do Claude, FIXO no código e conferido contra hosts oficiais do Claude (nada vindo
//    de dado vira endereço). O QR é desenhado pela tela, localmente (qrcode-generator, mesmo do M23); nenhum serviço externo recebe o endereço.
//  aplicar(prefs): valida ESTRITO (frequência de lista fechada, 3 avisos booleanos; lixo = 'prefs-invalidas', não "conserta") e
//    guarda em <dados do app>\celular\prefs.json (atômico, sem segredo: frequência e avisos não são segredo). É a fonte que os
//    avisos (ocorrências, fim de etapa, fim da obra) devem ler: `prefsAtuais()`.
//  CONEXÃO COM O CELULAR: NÃO IMPLEMENTADA, de propósito, e o adaptador NÃO FINGE. `aplicar` guarda a escolha e, enquanto a
//    conexão não estiver confirmada (dep `conexao()` devolvendo true), REJEITA com 'celular-nao-conectado'; a tela então diz, com
//    calma, "guardei a sua escolha, o celular ainda não está ligado". Só resolve quando há conexão confirmada.
//    O QUE SE SABE (CLI 2.1.322, `claude remote-control --help`): existe `claude remote-control` ("controlar sessões locais pelo
//    claude.ai/code ou pelo app do Claude no celular"), um servidor de longa duração que CRIA as próprias sessões (--spawn same-dir|
//    worktree|session, --permission-mode, --settings, --continue/--session-id para reanexar). O QUE NÃO ESTÁ CLARO e por isso fica
//    pendente (app/PENDENTE-ENTREGAR.md): (1) como a linha de produção (`claude -p`, sem tela) aparece no app do celular: o Remote
//    Control abre sessões suas, não anexa a um processo `-p` já rodando; (2) como entregar a ELAS as mesmas restrições da linha
//    (--setting-sources user, ferramentas por subcomando, git isolado, env mínimo), já que o celular passaria a dar ordens ao Claude
//    do cliente; (3) se as notificações push usam a conta claude.ai do próprio cliente e como o Atlas sabe que o celular conectou
//    (para `conexao()` ser verdade e não um palpite). Enquanto isso, nada é iniciado: este arquivo não dá spawn de remote-control.
//
// COMO TESTAR (Windows): `node --test app/adaptadores/*.teste.cjs`. Na máquina: mexer na frequência na tela do celular: aparece o
// recado "guardei a sua escolha..." e o arquivo <userData>\celular\prefs.json muda (JSON legível, sem nenhum segredo).
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { urlOficial } = require('../seguro-puro.cjs')
const { gravarAtomico, lerJson } = require('./obra-fs.cjs')

/** Só estes hosts valem para o app do celular (subconjunto dos oficiais, todos do Claude). */
const HOSTS_CLAUDE = Object.freeze(['claude.ai', 'www.claude.ai', 'support.claude.com', 'docs.claude.com'])
const ENDERECO_APP = 'https://claude.ai/download'
const FREQUENCIAS = ['30m', '1h', '3h', 'etapa'] // espelha ponte-celular.ts
const AVISOS = ['precisa', 'etapa', 'fim']
const PADRAO = Object.freeze({ frequencia: '1h', avisos: Object.freeze({ precisa: true, etapa: true, fim: true }) })

/** Validação ESTRITA das preferências vindas da tela (a tela já valida; aqui é fronteira de processo). Lança 'prefs-invalidas'. */
function validarPrefs(x) {
  if (!x || typeof x !== 'object' || !FREQUENCIAS.includes(x.frequencia) || !x.avisos || typeof x.avisos !== 'object') throw new Error('prefs-invalidas')
  const avisos = {}
  for (const id of AVISOS) {
    if (typeof x.avisos[id] !== 'boolean') throw new Error('prefs-invalidas')
    avisos[id] = x.avisos[id]
  }
  return { frequencia: x.frequencia, avisos }
}

/** `deps`: { dados (pasta de dados do app, ex.: userData\celular), conexao? (async () => boolean: o celular está mesmo ligado?), agora? } */
function criarCelular({ dados, conexao = async () => false, agora = () => new Date() }) {
  const enderecoApp = () => urlOficial(ENDERECO_APP, HOSTS_CLAUDE)
  const arquivo = () => path.join(dados, 'prefs.json')

  /** Lê o que foi guardado (para os avisos). Sem arquivo ou estragado: o padrão. */
  const prefsAtuais = () => {
    try { return validarPrefs(lerJson(arquivo())) } catch { return structuredClone(PADRAO) }
  }

  return {
    enderecoApp,
    prefsAtuais,
    async aplicar(prefs) {
      const p = validarPrefs(prefs)
      fs.mkdirSync(dados, { recursive: true })
      gravarAtomico(arquivo(), JSON.stringify({ versao: 1, ...p, guardadoEm: agora().toISOString() }) + '\n')
      let ligado = false
      try { ligado = (await conexao()) === true } catch { ligado = false }
      if (!ligado) throw new Error('celular-nao-conectado') // guardado, mas NÃO aplicado a nenhuma sessão: a tela avisa com calma
    },
  }
}

module.exports = { criarCelular, validarPrefs, HOSTS_CLAUDE, ENDERECO_APP, PADRAO }
