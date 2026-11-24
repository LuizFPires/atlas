// Ações das fichas de trava (prototipo/caminho-novo/T1Travas, aprovada pelo Luiz em 24/11/2026).
//  - SITE_DA_TRAVA: o site oficial de cada trava (fixo aqui; a tela só diz o tipo). Abre ao lado, no navegador do Atlas.
//  - deixarPublico(pasta): só com a trava "minutos do GitHub" aberta e depois da confirmação na tela. Projeto público não gasta
//    minutos. Grava <obra>\.atlas\visibilidade.json ({ publico: true, desde }) para lembrar de voltar.
//  - revisar(pastas): ao abrir o Atlas e de hora em hora. Obra pública cuja trava do GitHub já fechou volta para PRIVADO sozinha;
//    se falhar, tenta na próxima revisão (nunca esquece, porque o arquivo só some depois de voltar).
'use strict'
const fs = require('node:fs')
const { caminhoSeguro } = require('../seguro.cjs')
const { pastaDaObra, pastaAtlas, gravarAtomico, lerJson } = require('./obra-fs.cjs')
const { tipoDaTrava } = require('./travas.cjs')

const SITE_DA_TRAVA = {
  'supabase-dormindo': 'https://supabase.com/dashboard/projects',
  'github-minutos': 'https://github.com/settings/billing/spending_limit',
  'vercel-limite': 'https://vercel.com/account/plans',
}

/** deps: { raiz, rodarGh(args, cwd) → {codigo}, agora? } */
function criarTravasAcoes({ raiz, rodarGh, agora = () => new Date() }) {
  const arquivo = (pasta) => caminhoSeguro(raiz, pasta, '.atlas', 'visibilidade.json')
  const minutosAbertos = (pasta) => {
    const l = lerJson(caminhoSeguro(raiz, pasta, 'docs', 'ocorrencias.json'))
    return !!(l && Array.isArray(l.ocorrencias) && l.ocorrencias.some((o) => tipoDaTrava(o) === 'github-minutos'))
  }
  const self = {
    publico: (pasta) => { const v = lerJson(arquivo(pasta)); return !!(v && v.publico === true) },

    async deixarPublico(pasta) {
      const cwd = pastaDaObra(raiz, pasta)
      if (!minutosAbertos(pasta)) throw new Error('sem-trava')
      const r = await rodarGh(['repo', 'edit', '--visibility', 'public', '--accept-visibility-change-consequences'], cwd)
      if (r.codigo !== 0) throw new Error('gh-falhou')
      pastaAtlas(raiz, pasta)
      gravarAtomico(arquivo(pasta), JSON.stringify({ versao: 1, publico: true, desde: agora().toISOString() }) + '\n')
      return { ok: true }
    },

    async revisar(pastas) {
      for (const pasta of pastas) {
        try {
          if (!self.publico(pasta) || minutosAbertos(pasta)) continue
          const r = await rodarGh(['repo', 'edit', '--visibility', 'private', '--accept-visibility-change-consequences'], pastaDaObra(raiz, pasta))
          if (r.codigo === 0) fs.unlinkSync(arquivo(pasta))
        } catch { /* tenta na próxima revisão */ }
      }
    },
  }
  return self
}

module.exports = { criarTravasAcoes, SITE_DA_TRAVA }
