// Diário da obra (M41): tudo o que acontece na obra, com hora, em português simples, em <obra>/.atlas/diario.jsonl.
// "Não pode ficar no escuro" (Luiz, 24/11/2026). Quem escreve é o próprio Atlas (linha, vigia), nunca o Claude da obra.
// Nunca guarda segredo: tokens, chaves e senhas são apagados antes de gravar (texto e detalhe).
'use strict'
const fs = require('node:fs')
const path = require('node:path')

const MAX_LINHAS = 500
const TIPOS = new Set(['info', 'trabalho', 'parada', 'pedido', 'retomada', 'entrega', 'defeito'])

const SEGREDOS = [
  /\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{16,}/g,
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\b(?:password|senha|secret|token|api[_-]?key|service_role[_a-z]*|[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD))\s*[=:]\s*\S+/gi,
]
const semSegredo = (s) => SEGREDOS.reduce((t, re) => t.replace(re, '[oculto]'), String(s || ''))
const limpar = (s, max) => {
  const t = semSegredo(s).replace(/[*`#]+/g, '').replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : t.slice(0, t.lastIndexOf(' ', max - 1) > 40 ? t.lastIndexOf(' ', max - 1) : max - 1) + '…'
}

function criarDiario({ agora = () => new Date() } = {}) {
  const arquivo = (dir) => path.join(dir, '.atlas', 'diario.jsonl')

  function ler(dir, limite = 200) {
    let bruto = ''
    try { bruto = fs.readFileSync(arquivo(dir), 'utf8') } catch { return [] }
    const linhas = []
    for (const l of bruto.split('\n')) {
      if (!l.trim()) continue
      try { const e = JSON.parse(l); if (e && typeof e.texto === 'string' && typeof e.em === 'string') linhas.push(e) } catch { /* linha estragada: pula */ }
    }
    return linhas.slice(-Math.max(1, limite))
  }

  /** Acrescenta um acontecimento. O mesmo texto logo em seguida não se repete. Nunca lança (o diário é extra). */
  function registrar(dir, { tipo = 'info', texto, detalhe } = {}) {
    try {
      const t = limpar(texto, 240)
      if (!t) return null
      const ultimas = ler(dir, MAX_LINHAS)
      const ult = ultimas.at(-1)
      if (ult && ult.texto === t) return ult
      const e = { em: agora().toISOString(), tipo: TIPOS.has(tipo) ? tipo : 'info', texto: t, ...(detalhe ? { detalhe: limpar(detalhe, 400) } : {}) }
      fs.mkdirSync(path.dirname(arquivo(dir)), { recursive: true })
      if (ultimas.length >= MAX_LINHAS) {
        const manter = [...ultimas.slice(-(MAX_LINHAS - 1)), e].map((x) => JSON.stringify(x)).join('\n') + '\n'
        const tmp = arquivo(dir) + '.tmp'
        fs.writeFileSync(tmp, manter)
        fs.renameSync(tmp, arquivo(dir))
      } else {
        fs.appendFileSync(arquivo(dir), JSON.stringify(e) + '\n')
      }
      return e
    } catch { return null }
  }

  return { registrar, ler }
}

module.exports = { criarDiario, MAX_LINHAS, semSegredo }
