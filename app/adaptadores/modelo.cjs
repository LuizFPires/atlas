// Modelo do Claude usado pelo Atlas (decisão do Luiz em 23/11/2026: um só para todo o Atlas, escolhido pelo cliente;
// recomendado: Opus 5.5). Vale para o protótipo, estilo, nomes, ajuda, plano e construção da obra.
// Guardado em <userData>\modelo.json (não é segredo). Só aceita modelos da lista: nada vindo da tela vira argumento livre.
//
// COMO TESTAR: `node --test app/adaptadores/modelo.teste.cjs`. No Windows: trocar o modelo no cartão "Plano Claude" do menu,
// pedir uma mudança no protótipo e conferir no registro da chamada que foi com --model <id>.
'use strict'
const fs = require('node:fs')
const path = require('node:path')

/** Lista fechada. Para atualizar quando sair modelo novo: trocar aqui (e o RECOMENDADO). */
const MODELOS = [
  { id: 'claude-opus-5-5', nome: 'Opus 5.5', explica: 'O melhor resultado. Gasta mais da cota do seu plano: na construção da obra, só no plano Max (no Pro, a obra usa o Sonnet para a cota render).' },
  { id: 'claude-sonnet-5-5', nome: 'Sonnet 5.5', explica: 'Mais rápido e econômico. Bom resultado, gasta menos cota.' },
  { id: 'claude-haiku-5-5', nome: 'Haiku 5.5', explica: 'O mais rápido. Só para obras bem simples.' },
]
const RECOMENDADO = 'claude-opus-5-5'
const valido = (id) => MODELOS.some((m) => m.id === id)

function criarModelo({ pasta }) {
  const arquivo = path.join(pasta, 'modelo.json')
  const ler = () => {
    try { const d = JSON.parse(fs.readFileSync(arquivo, 'utf8')); if (d && valido(d.modelo)) return d.modelo } catch { /* sem escolha */ }
    return RECOMENDADO
  }
  return {
    ler,
    gravar(id) {
      if (!valido(id)) throw new Error('modelo-invalido')
      fs.mkdirSync(pasta, { recursive: true })
      const tmp = `${arquivo}.${process.pid}.tmp`
      fs.writeFileSync(tmp, JSON.stringify({ versao: 1, modelo: id }) + '\n')
      fs.renameSync(tmp, arquivo)
      return id
    },
    /** Argumentos para o Claude Code: sempre um id da lista. */
    args: () => ['--model', ler()],
    /** A linha de produção (economia de tokens, decisão do Luiz em 24/11/2026): Opus só no plano Max; no Pro, Sonnet. */
    argsDaLinha: (plano) => { const id = ler(); return ['--model', id === 'claude-opus-5-5' && plano !== 'max' ? 'claude-sonnet-5-5' : id] },
    lista: () => MODELOS.map((m) => ({ ...m, recomendado: m.id === RECOMENDADO })),
  }
}

module.exports = { criarModelo, MODELOS, RECOMENDADO }
