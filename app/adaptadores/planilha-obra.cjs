// A planilha dentro da obra (prototipo/caminho-novo/X1–X3, aprovadas pelo Luiz em 24/11/2026). Fica em <obra>\planilha\:
//  - o arquivo do cliente (copiado pelo arquivos.cjs, destino 'planilha');
//  - raio-x.json e raio-x.md (planilha.cjs: estrutura, até 3 linhas de exemplo por aba, conferência das contas);
//  - entendimento.json ("O que entendi", escrito pelo Claude a partir do raio-x.md e do que o cliente falou);
//  - falas.json (o que o cliente respondeu ou pediu, por voz: vira parte do relato da obra);
//  - importar.json ({ levar: true|false }: se os dados entram no sistema).
// O relato da obra (o que o mapa de telas e a documentação leem) nasce do entendimento + falas + raio-X.
'use strict'
const fs = require('node:fs')
const { caminhoSeguro } = require('../seguro.cjs')
const { pastaDaObra, gravarAtomico, lerJson, lerTexto } = require('./obra-fs.cjs')
const { REGRA_CONTEUDO_CLIENTE, blocoDoCliente, umaLinha, extrairJson, garantirSubpasta } = require('./projeto-comum.cjs')
const { REGRA_POLITICA, politicaDoJson } = require('./politica.cjs')
const { raioX, resumoParaClaude } = require('./planilha.cjs')

const NOME_OK = /^[a-z0-9][a-z0-9-]{0,80}\.(xlsx|xlsm|xls|csv)$/
const TIPO_PT = { texto: 'texto', numero: 'número', moeda: 'valor em R$', percentual: 'percentual', data: 'data', 'sim-nao': 'sim/não', vazio: 'vazia' }
const MAX_FALAS = 30

/** O que a tela X2 mostra de cada aba: frases curtas, nunca os dados. */
function achadosDa(a) {
  const out = []
  for (const c of a.colunas) {
    const partes = [`${c.titulo}: ${TIPO_PT[c.tipo] || c.tipo}`]
    if (c.lista) partes.push(`lista (${c.lista.slice(0, 4).join(', ')}${c.lista.length > 4 ? '…' : ''})`)
    if (c.formula) partes.push('fórmula')
    if (c.ligacao) partes.push(`ligada à aba ${c.ligacao.aba}`)
    if (c.cor) partes.push(`cor quando ${c.cor}`)
    if (partes.length > 1 || c.tipo !== 'texto') out.push(partes.join(' · '))
  }
  if (a.dinamica) out.push('tabela dinâmica: vira painel')
  if (a.graficos) out.push(`${a.graficos} gráfico(s): vira painel`)
  return out.slice(0, 8).map((x) => umaLinha(x, 160))
}

function visaoDo(r) {
  return {
    arquivo: r.arquivo,
    formato: r.formato,
    abas: r.abas.map((a) => ({ nome: umaLinha(a.nome, 60), linhas: a.linhas, colunas: a.colunas.length, achados: achadosDa(a) })),
    macros: r.macros,
    contas: { conferidas: r.contas.conferidas, batem: r.contas.batem, divergem: r.contas.divergem.length, semConferir: r.contas.semConferir },
  }
}

const lista = (x, max, n = 200) => (Array.isArray(x) ? x : []).map((v) => umaLinha(v, n)).filter(Boolean).slice(0, max)
function entendimentoDoJson(j) {
  if (!j || typeof j !== 'object' || typeof j.resumo !== 'string' || !Array.isArray(j.entidades) || !j.entidades.length) throw new Error('entendimento-invalido')
  return {
    resumo: umaLinha(j.resumo, 400),
    entidades: j.entidades.filter((e) => e && typeof e.nome === 'string').slice(0, 12).map((e) => ({ nome: umaLinha(e.nome, 60), quantos: Number.isInteger(e.quantos) && e.quantos >= 0 ? e.quantos : null, campos: umaLinha(e.campos, 200) })),
    relacoes: lista(j.relacoes, 10),
    regras: lista(j.regras, 15),
    relatorios: lista(j.relatorios, 10),
    perguntas: (Array.isArray(j.perguntas) ? j.perguntas : []).filter((p) => p && typeof p.pergunta === 'string').slice(0, 3).map((p) => ({ pergunta: umaLinha(p.pergunta, 160), porque: umaLinha(p.porque, 200) })),
    mudancas: lista(j.mudancas, 10),
    aparelho: { celular: umaLinha(j.aparelho && j.aparelho.celular, 160), computador: umaLinha(j.aparelho && j.aparelho.computador, 160) },
  }
}

const FORMATO = 'Responda SOMENTE com um objeto JSON, sem texto antes nem depois: {"resumo":"1 ou 2 frases: o que a planilha controla","entidades":[{"nome":"Pedidos de compra","quantos":412,"campos":"nº, data, obra, fornecedor, status, total"}],"relacoes":["Cada pedido tem vários itens e um fornecedor"],"regras":["Total do item = quantidade × preço"],"relatorios":["Gasto do mês por obra e categoria"],"perguntas":[{"pergunta":"...?","porque":"..."}],"mudancas":["Novo: ...","Entendi: ..."],"aparelho":{"celular":"o que faz sentido no celular","computador":"o que faz sentido no computador"},"politica":{"bloqueia":false,"sinais":[]}}'

function pedidoEntender(atual, fala) {
  return [
    REGRA_CONTEUDO_CLIENTE,
    'Um dono de pequeno negócio quer transformar a planilha dele num sistema. Leia planilha/raio-x.md na pasta da obra (é o raio-X técnico: abas, colunas, tipos, listas, fórmulas, cores, ligações, exemplos e a conferência das contas).',
    'Explique, em português simples (para quem não programa), o que você entendeu: o que ele controla (entidades, com quantas linhas tem cada uma), como as coisas se ligam, as REGRAS que estavam escondidas nas fórmulas, listas e cores (ex.: "Pedido acima de R$ 5.000 fica vermelho: precisa de aprovação"), os relatórios (abas de resumo, tabelas dinâmicas, gráficos) e o que fica melhor no celular e no computador.',
    'Abas de apoio (listas, parâmetros) não são entidades: viram opções. Macro: o código não foi lido; se existir, pergunte o que ela faz.',
    'No máximo 3 perguntas, só sobre o que realmente não dá para saber pela planilha e muda o sistema.',
    ...(atual ? ['', 'Entendimento atual (JSON):', JSON.stringify(atual)] : []),
    ...(fala ? [
      '',
      'O CLIENTE FALOU (respondendo às perguntas OU pedindo acréscimos e mudanças: os dois valem). Atualize o entendimento com isso: responda o que ele esclareceu (tire a pergunta respondida), acrescente o que ele pediu e corrija o que ele corrigiu. Em "mudancas", liste em frases curtas o que mudou, começando por "Entendi:" (esclarecimento), "Novo:" (acréscimo) ou "Mudou:" (correção). O que ele pediu vale mesmo que não esteja na planilha.',
      ...blocoDoCliente(fala, '(vazio)'),
    ] : ['', 'Primeira leitura: "mudancas" fica vazio.']),
    // M65: o porteiro olha a planilha inteira e o que o cliente falou (pega quem tenta em partes).
    REGRA_POLITICA,
    'Se bloquear, diga em "politica" até 4 "sinais" curtos (o que na planilha ou na fala mostra isso).',
    'Você não grava nada e não roda comandos.',
    FORMATO,
  ].join('\n')
}

/** deps: { raiz, disparo } */
function criarPlanilhaObra({ raiz, disparo, politica = null }) {
  const arq = (pasta, nome) => caminhoSeguro(raiz, pasta, 'planilha', nome)
  const self = {
    async ler(pasta, nome) {
      pastaDaObra(raiz, pasta)
      if (typeof nome !== 'string' || !NOME_OK.test(nome)) throw new Error('nome-invalido')
      const r = await raioX(arq(pasta, nome), nome)
      gravarAtomico(arq(pasta, 'raio-x.json'), JSON.stringify(r))
      gravarAtomico(arq(pasta, 'raio-x.md'), resumoParaClaude(r) + '\n')
      return visaoDo(r)
    },

    async entender(pasta, fala) {
      pastaDaObra(raiz, pasta)
      if (!fs.existsSync(arq(pasta, 'raio-x.md'))) throw new Error('sem-raio-x')
      const texto = typeof fala === 'string' ? fala.trim().slice(0, 8000) : ''
      const atual = lerJson(arq(pasta, 'entendimento.json'))
      const bruto = extrairJson(await disparo.perguntar(pasta, pedidoEntender(atual, texto), { timeoutMs: 300_000, maxSaida: 400_000 }), 'objeto')
      const pol = politicaDoJson(bruto)
      if (pol.bloqueia) {
        const situacao = politica ? await politica.registrar(pasta, 'planilha', texto || '(planilha importada)') : null
        return { resumo: '', entidades: [], relacoes: [], regras: [], relatorios: [], perguntas: [], mudancas: [], aparelho: { celular: '', computador: '' }, politica: { ...pol, situacao: situacao || 'livre' } }
      }
      const e = entendimentoDoJson(bruto)
      if (!texto) e.mudancas = []
      gravarAtomico(arq(pasta, 'entendimento.json'), JSON.stringify(e))
      if (texto) {
        const f = lerJson(arq(pasta, 'falas.json'))
        const falas = (f && Array.isArray(f.falas) ? f.falas : []).slice(-(MAX_FALAS - 1))
        falas.push(texto)
        gravarAtomico(arq(pasta, 'falas.json'), JSON.stringify({ falas }))
      }
      return e
    },

    async levarDados(pasta, sim) {
      pastaDaObra(raiz, pasta)
      garantirSubpasta(raiz, pasta, 'planilha')
      gravarAtomico(arq(pasta, 'importar.json'), JSON.stringify({ versao: 1, levar: sim === true }) + '\n')
    },

    /** O relato da obra que nasceu da planilha: entendimento + o que o cliente falou + o raio-X (o mapa e o escritor leem). */
    relato(pasta) {
      const e = lerJson(arq(pasta, 'entendimento.json'))
      const f = lerJson(arq(pasta, 'falas.json'))
      const md = lerTexto(arq(pasta, 'raio-x.md'), 60_000) || ''
      const L = ['O sistema nasce da planilha do cliente (planilha/raio-x.md).', '']
      if (e) {
        L.push(e.resumo, '', 'O que ele controla:', ...e.entidades.map((x) => `- ${x.nome}${x.quantos !== null ? ` (${x.quantos})` : ''}: ${x.campos}`))
        if (e.relacoes.length) L.push('', 'Ligações:', ...e.relacoes.map((x) => `- ${x}`))
        if (e.regras.length) L.push('', 'Regras:', ...e.regras.map((x) => `- ${x}`))
        if (e.relatorios.length) L.push('', 'Relatórios:', ...e.relatorios.map((x) => `- ${x}`))
        if (e.aparelho.celular || e.aparelho.computador) L.push('', `No celular: ${e.aparelho.celular || '-'}`, `No computador: ${e.aparelho.computador || '-'}`)
      }
      if (f && Array.isArray(f.falas) && f.falas.length) L.push('', 'O que o cliente falou (respostas, acréscimos e mudanças):', ...f.falas.map((x) => `- ${String(x).slice(0, 2000)}`))
      L.push('', md)
      return L.join('\n').slice(0, 20_000)
    },
  }
  return self
}

module.exports = { criarPlanilhaObra, entendimentoDoJson }
