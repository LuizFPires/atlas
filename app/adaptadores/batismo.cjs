// Adaptador real do PonteBatismo (src/app/ponte-batismo.ts) — processo principal do Electron (só Windows).
//
// O QUE FAZ
//  sugerir(pasta, obraNome, pedido): o Claude (SÓ LEITOR, ver projeto-comum.cjs) lê telas.md, regras.md e design-system.md da obra e
//    devolve 3 nomes em JSON. A ideia do cliente, o nome da obra e os nomes já mostrados entram por stdin como DADO delimitado.
//    A resposta é VALIDADA: nome por limparNome (uma linha, 2 a 40 letras; sem URL, barra ou @); slogan/motivo limpos por comoDado;
//    o logo é SÓ um id da LISTA FECHADA do Atlas (LOGOS: cadeira, navalha, hora, folha, estrela, chave). Nunca SVG, caminho ou URL do
//    Claude: id fora da lista cai em 'estrela'. Ids dos nomes são gerados aqui ([a-z0-9-], únicos).
//  batizar(pasta, marca): revalida tudo que veio da tela e grava <obra>\marca\marca.md com flag 'wx' (marca.md, marca-2.md...):
//    NUNCA sobrescreve. Logo do cliente: só aceita um arquivo que já esteja em <obra>\marca (subido pela PonteArquivos; SVG nunca).
//
// COMO TESTAR (Windows, Claude logado): em "Dar o nome", "Quero sugestões" mostra 3 cartões; batizar cria <obra>\marca\marca.md;
// batizar de novo cria marca-2.md. Sem Claude: `node --test app/adaptadores/*.teste.cjs`.
'use strict'
const fs = require('node:fs')
const { caminhoSeguro } = require('../seguro.cjs')
const { pastaDaObra } = require('./obra-fs.cjs')
const { REGRA_CONTEUDO_CLIENTE, blocoDoCliente, umaLinha, limparNome, extrairJson, gravarSemSobrescrever } = require('./projeto-comum.cjs')

/** Ids da lista fechada de ícones do Atlas (os desenhos ficam no front, src/app/ponte-batismo.ts → LOGOS). Manter em sincronia. */
const LOGOS = Object.freeze(['cadeira', 'navalha', 'hora', 'folha', 'estrela', 'chave'])
const logoValido = (id) => typeof id === 'string' && LOGOS.includes(id)
const PARECE_ENDERECO = /:\/\/|www\.|[\\/@]/i
const ARQ_LOGO = /^[a-z0-9][a-z0-9._-]{0,80}\.(png|jpg|jpeg|webp|pdf)$/

function nomeDoClaude(bruto) {
  const nome = limparNome(bruto)
  return nome && !PARECE_ENDERECO.test(nome) ? nome : ''
}

/** Resposta do Claude -> exatamente 3 NomeProposto válidos (nomes distintos), senão lança 'nomes-invalidos'. */
function nomesDoTexto(texto) {
  const arr = extrairJson(texto, 'array')
  const usados = new Set()
  const ids = new Set()
  const out = []
  for (const n of arr) {
    if (!n || typeof n !== 'object') continue
    const nome = nomeDoClaude(n.nome)
    if (!nome || usados.has(nome.toLowerCase())) continue
    usados.add(nome.toLowerCase())
    const base = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'nome'
    let id = base
    for (let i = 2; ids.has(id); i++) id = `${base}-${i}`
    ids.add(id)
    out.push({ id, nome, slogan: umaLinha(n.slogan, 80), porque: umaLinha(n.porque, 200), logo: logoValido(n.logo) ? n.logo : 'estrela' })
  }
  if (out.length < 3) throw new Error('nomes-invalidos')
  return out.slice(0, 3)
}

function montarPedidoSugerir(obraNome, pedido = {}) {
  return [
    REGRA_CONTEUDO_CLIENTE,
    'Sugira 3 nomes DIFERENTES para o sistema desta obra, cada um com: nome curto e fácil de falar (até 40 letras, sem endereço de site), slogan, motivo em palavras simples e um ícone da lista fechada de logos.',
    'Use o contexto da obra (telas.md, regras.md e design-system.md na pasta da obra, se existirem). Você não grava nada e não roda comandos.',
    `Responda SOMENTE com um array JSON de 3 itens, sem texto antes nem depois: [{"nome":"…","slogan":"até 80 letras","porque":"até 200 letras","logo":"um de: ${LOGOS.join(' | ')}"}]`,
    '',
    'Nome da obra:',
    ...blocoDoCliente(obraNome, '(sem nome)'),
    '',
    'Ideia de nome do cliente:',
    ...blocoDoCliente(pedido.ideia ?? '', '(nenhuma)'),
    '',
    'Nomes que já foram mostrados (não repita):',
    ...blocoDoCliente((Array.isArray(pedido.evitar) ? pedido.evitar.slice(0, 30).map(String) : []).join('\n'), '(nenhum)'),
  ].join('\n')
}

/** Espelho de montarMarcaMd (src/app/ponte-batismo.ts). */
function montarMarcaMd(marca) {
  return [
    '# Marca da obra', '', `> ${REGRA_CONTEUDO_CLIENTE}`, '',
    marca.origem === 'sugestao' ? 'Origem: nome sugerido pelo Atlas e escolhido pelo cliente.' : 'Origem: nome e logo que o cliente já tinha.', '',
    '## Nome', ...blocoDoCliente(marca.nome, '(sem nome)'), '',
    '## Slogan', ...blocoDoCliente(marca.slogan, '(sem slogan)'), '',
    '## Logo',
    marca.origem === 'sugestao' ? `- ícone do Atlas: ${marca.logo}` : marca.logo ? `- arquivo: marca/${marca.logo.arquivo}` : '- (o cliente ainda não mandou)', '',
  ].join('\n')
}

/** `deps`: { raiz, disparo (criarDisparo de projeto-comum.cjs) }. */
function criarBatismo({ raiz, disparo }) {
  return {
    async sugerir(pasta, obraNome, pedido) {
      pasta = String(pasta)
      pastaDaObra(raiz, pasta)
      const p = pedido && typeof pedido === 'object' ? pedido : {}
      const texto = await disparo.perguntar(pasta, montarPedidoSugerir(String(obraNome ?? ''), p))
      return nomesDoTexto(texto)
    },

    async batizar(pasta, marca) {
      pasta = String(pasta)
      pastaDaObra(raiz, pasta)
      if (!marca || typeof marca !== 'object') throw new Error('marca-invalida')
      const nome = nomeDoClaude(marca.nome)
      if (!nome) throw new Error('nome-invalido')
      const slogan = umaLinha(marca.slogan, 80)
      let limpa
      if (marca.origem === 'sugestao') {
        if (!logoValido(marca.logo)) throw new Error('logo-invalido')
        limpa = { origem: 'sugestao', nome, slogan, logo: marca.logo }
      } else if (marca.origem === 'cliente') {
        let logo = null
        if (marca.logo) {
          const arq = marca.logo.arquivo
          if (typeof arq !== 'string' || !ARQ_LOGO.test(arq)) throw new Error('logo-invalido')
          let st
          try { st = fs.lstatSync(caminhoSeguro(raiz, pasta, 'marca', arq)) } catch { throw new Error('logo-inexistente') }
          if (!st.isFile() || st.isSymbolicLink()) throw new Error('logo-inexistente')
          logo = { arquivo: arq }
        }
        limpa = { origem: 'cliente', nome, slogan, logo }
      } else throw new Error('marca-invalida')
      return { caminho: gravarSemSobrescrever(raiz, pasta, ['marca'], 'marca.md', montarMarcaMd(limpa)).caminho }
    },
  }
}

module.exports = { criarBatismo, nomesDoTexto, montarPedidoSugerir, montarMarcaMd, LOGOS }
