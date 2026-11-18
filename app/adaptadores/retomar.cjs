// Adaptador real do PonteRetomar (src/app/ponte-retomar.ts) — processo principal do Electron (só Windows).
//
// O QUE FAZ
//  obraEmAndamento(): varre C:\Users\<você>\Atlas\Obras (só subpastas reais, sem link), lê o PLAN.md de cada uma e devolve a MAIS
//    RECENTE que ainda não chegou a 100% (a mesma regra de estaEmAndamento do front), com nome, % ponderado, etapa em que ficou
//    e quando parou (data de <obra>\.atlas\linha.json, ou do PLAN.md). Nada em andamento => null (o app abre em Minhas obras).
//    Obra com a linha rodando agora NÃO é "parada": não entra.
//  continuar({pasta}): religa a linha do ponto em que parou — igual a religarLinha do front: se a parada era a cota e o Claude já
//    voltou a responder, retoma por PonteCota.retomar (quando houver adaptador de cota); depois PontePainel.continuar (tira a
//    pausa, reafirma o recomendado.json do modo da obra e liga a skill /construir). Ocorrência que exige o cliente não é contornada.
//
// COMO TESTAR (Windows): começar uma obra, fechar o Atlas (ou reiniciar o computador) com ela a meio caminho e abrir o Atlas:
// a primeira tela deve ser a de Retomar com o nome, o % e a etapa; "Continuar obra" religa (o claude volta ao Gerenciador de Tarefas).
// Sem Claude: `node --test app/adaptadores/*.teste.cjs`.
'use strict'
const fs = require('node:fs')
const { caminhoSeguro } = require('../seguro.cjs')
const { NOME_PASTA, lerTexto } = require('./obra-fs.cjs')
const { comoDado } = require('./plan-md.cjs')
const { lerPlanoDoTexto } = require('./painel.cjs')

/** Nome da obra = o que vem depois de "# PLAN — " (DADO: normalizado para uma linha). */
function nomeDoPlan(texto, pasta) {
  const m = /^#\s+PLAN\s+[—–-]\s+(.+?)\s*$/m.exec(texto)
  return (m && comoDado(m[1], 160).join(' ').slice(0, 80)) || pasta
}

const mtime = (caminho) => { try { return fs.statSync(caminho).mtimeMs } catch { return 0 } }

/** `deps`: { raiz, painel (real), cota? (PonteCota), construcao (para saber se a linha roda agora) } */
function criarRetomar({ raiz, painel, cota, construcao }) {
  return {
    async obraEmAndamento() {
      let nomes
      try { nomes = fs.readdirSync(raiz, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.isSymbolicLink() && NOME_PASTA.test(d.name)).map((d) => d.name) } catch { return null }
      let melhor = null
      for (const pasta of nomes) {
        try {
          if (construcao.linha.rodando(pasta)) continue
          const texto = lerTexto(caminhoSeguro(raiz, pasta, 'PLAN.md'))
          if (texto === null) continue
          const p = lerPlanoDoTexto(texto)
          if (!p.milestones.length || !(p.pct < 100)) continue
          const quando = Math.max(mtime(caminhoSeguro(raiz, pasta, '.atlas', 'linha.json')), mtime(caminhoSeguro(raiz, pasta, 'PLAN.md')))
          if (melhor && melhor.quando >= quando) continue
          const prox = p.milestones.find((m) => m.n === p.proximo)
          melhor = {
            quando,
            obra: {
              nome: nomeDoPlan(texto, pasta), pasta, pct: Math.round(p.pct),
              etapa: prox ? { n: prox.n, nome: comoDado(prox.titulo, 80).join(' ').slice(0, 60) || 'Etapa' } : null,
              paradaEm: quando ? new Date(quando).toISOString() : null,
            },
          }
        } catch { /* pasta estranha: ignora */ }
      }
      return melhor ? melhor.obra : null
    },

    async continuar(obra) {
      const pasta = obra && obra.pasta
      const estado = await painel.ler(pasta) // valida a pasta (caminhoSeguro) e lê a parada
      if (estado.parada === 'cota' && cota) {
        const c = await cota.ler(pasta)
        if (c.esgotada && c.renovada) await cota.retomar(pasta)
      }
      await painel.continuar(pasta)
    },
  }
}

module.exports = { criarRetomar, nomeDoPlan }
