// Recursos do Claude Code instalado no computador do cliente (economia de tokens, Luiz em 24/11/2026: "fazer mais com menos",
// sem perder qualidade). O Atlas lê `claude --help` UMA vez (sem gastar token) e só liga as opções que esse Claude conhece:
//  - --tools <lista>: só as ferramentas que o pedido usa vão para o Claude (cada ferramenta a mais é texto que ele relê a cada passo);
//  - --exclude-dynamic-system-prompt-sections: a parte que muda (pasta, git status) sai do começo e o resto fica no cache;
//  - --effort <nível>: quanto o Claude "pensa" (pensar também é token de saída, o mais caro).
// Claude antigo sem essas opções: nada muda (uma opção desconhecida faria o Claude recusar o pedido).
'use strict'
const { executarClaude, resolverClaude } = require('../seguro.cjs')

const OPCOES = ['--tools', '--effort', '--exclude-dynamic-system-prompt-sections']
const ESFORCOS = new Set(['low', 'medium', 'high', 'xhigh', 'max'])

function criarRecursosClaude({ executar = executarClaude, resolver = resolverClaude } = {}) {
  let conhecidas = new Set()
  let carregando = null
  return {
    /** Lê o --help (uma vez por abertura do Atlas). Nunca lança. */
    carregar() {
      if (!carregando) {
        carregando = (async () => {
          try {
            if (!resolver(process.env)) { carregando = null; return }
            const r = await executar(['--help'], { timeoutMs: 20_000, maxSaida: 400_000 })
            const t = String((r && r.saida) || '')
            conhecidas = new Set(OPCOES.filter((o) => new RegExp(`(^|\\s)${o.replace(/-/g, '\\-')}(\\s|,|$)`, 'm').test(t)))
          } catch { conhecidas = new Set() }
        })()
      }
      return carregando
    },
    tem: (opcao) => conhecidas.has(opcao),
  }
}

/** `ferramentas`: "Read,Glob,Grep", "" (nenhuma) ou null (não restringe). */
function argsEnxutos(recursos, ferramentas) {
  const out = []
  if (recursos && typeof ferramentas === 'string' && recursos.tem('--tools')) out.push('--tools', ferramentas)
  if (recursos && recursos.tem('--exclude-dynamic-system-prompt-sections')) out.push('--exclude-dynamic-system-prompt-sections')
  return out
}

function argsEsforco(recursos, nivel) {
  return recursos && ESFORCOS.has(nivel) && recursos.tem('--effort') ? ['--effort', nivel] : []
}

module.exports = { criarRecursosClaude, argsEnxutos, argsEsforco }
