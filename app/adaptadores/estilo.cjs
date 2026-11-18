// Adaptador real do PonteEstilo (src/app/ponte-estilo.ts) — processo principal do Electron (só Windows).
//
// O QUE FAZ
//  propor(entrada, pasta?): o Claude lê as referências e o sentimento (DADO delimitado, por stdin) e devolve 3 estilos em JSON.
//    O Claude é SÓ LEITOR (ver projeto-comum.cjs): com `pasta` ele pode olhar os prints em estilo/referencias da obra (Read/Glob/Grep);
//    sem `pasta` não tem ferramenta nenhuma. A resposta é VALIDADA antes de ir à tela: exatamente 3, cores #rrggbb, cantos Npx,
//    fonte só de uma LISTA FECHADA (o Claude escolhe o nome; o CSS é nosso), textos limpos por comoDado, nada de URL/HTML.
//    Links das referências são lidos como TEXTO (WebFetch/WebSearch negados: o Claude não sai pela rede por causa de um link do cliente).
//  materializar(pasta, origem): grava o design-system.md na RAIZ da obra com flag 'wx' num nome livre (design-system-2.md...);
//    NUNCA sobrescreve. Se o cliente trouxe o design-system.md pronto (identidade.prontoDS), ele PREVALECE: só confere que o arquivo
//    existe na obra e devolve o caminho (nenhum esqueleto é gerado). A origem vem da tela e é revalidada aqui (não confia no renderer).
//  Upload de referências/logo/manual é da PonteArquivos (arquivos.cjs), não deste adaptador.
//
// COMO TESTAR (Windows, Claude logado): criar uma obra, subir 1-2 prints de referência, escolher sentimentos e "Mostrar 3 estilos":
// aparecem 3 cartões; escolher um cria <obra>\design-system.md; repetir cria design-system-2.md (o primeiro não muda).
// Sem Claude: `node --test app/adaptadores/*.teste.cjs`.
'use strict'
const fs = require('node:fs')
const { caminhoSeguro } = require('../seguro.cjs')
const { pastaDaObra } = require('./obra-fs.cjs')
const { REGRA_CONTEUDO_CLIENTE, blocoDoCliente, umaLinha, extrairJson, gravarSemSobrescrever } = require('./projeto-comum.cjs')

/** Lista fechada de letras (o Claude escolhe o NOME; o valor CSS é nosso). Os valores batem com ESTILOS_EXEMPLO do front. */
const FONTES = Object.freeze({
  Geist: "'Geist', system-ui, sans-serif",
  Fraunces: "'Fraunces', Georgia, serif",
  Georgia: 'Georgia, serif',
  Arial: 'Arial, sans-serif',
  Verdana: 'Verdana, sans-serif',
  'Trebuchet MS': "'Trebuchet MS', sans-serif",
  'Times New Roman': "'Times New Roman', serif",
  Sistema: 'system-ui, sans-serif',
})
const COR = /^#[0-9a-fA-F]{6}$/
const RAIO = /^\d{1,2}px$/

/** Valida e limpa um estilo (do Claude ou da tela). null = recusa. */
function estiloValido(e, { aceitaNomeDeFonte = false } = {}) {
  if (!e || typeof e !== 'object') return null
  const cores = ['fundo', 'topo', 'topoTxt', 'destaque', 'destTxt', 'linha']
  if (!cores.every((k) => typeof e[k] === 'string' && COR.test(e[k]))) return null
  if (typeof e.raio !== 'string' || !RAIO.test(e.raio)) return null
  let fonte = null
  if (typeof e.fonte === 'string') {
    if (Object.values(FONTES).includes(e.fonte)) fonte = e.fonte
    else if (aceitaNomeDeFonte && Object.hasOwn(FONTES, e.fonte)) fonte = FONTES[e.fonte]
    else if (aceitaNomeDeFonte) fonte = FONTES.Geist // nome fora da lista: cai na letra do Atlas
  }
  if (!fonte) return null
  const nome = umaLinha(e.nome, 40)
  if (!nome) return null
  const id = typeof e.id === 'string' && /^[a-z0-9][a-z0-9-]{0,30}$/.test(e.id) ? e.id : (nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'estilo')
  return { id, nome, de: umaLinha(e.de, 160), fundo: e.fundo, topo: e.topo, topoTxt: e.topoTxt, destaque: e.destaque, destTxt: e.destTxt, linha: e.linha, raio: e.raio, fonte }
}

/** Resposta do Claude -> exatamente 3 estilos válidos (ids únicos), senão lança 'estilos-invalidos'. */
function estilosDoTexto(texto) {
  const arr = extrairJson(texto, 'array')
  const vistos = new Set()
  const out = []
  for (const bruto of arr) {
    const e = estiloValido(bruto, { aceitaNomeDeFonte: true })
    if (!e) continue
    let id = e.id
    for (let i = 2; vistos.has(id); i++) id = `${e.id}-${i}`
    vistos.add(id)
    out.push({ ...e, id })
  }
  if (out.length < 3) throw new Error('estilos-invalidos')
  return out.slice(0, 3)
}

function montarPedidoPropor(entrada) {
  const refs = Array.isArray(entrada.referencias) ? entrada.referencias.slice(0, 30) : []
  const sent = Array.isArray(entrada.sentimentos) ? entrada.sentimentos.slice(0, 20).map(String) : []
  return [
    REGRA_CONTEUDO_CLIENTE,
    '',
    'Proponha 3 estilos visuais DIFERENTES para o sistema do cliente, a partir das referências e do sentimento abaixo.',
    'Se houver prints em estilo/referencias, você pode olhá-los. Links são só texto: não tente abrir.',
    `Responda SOMENTE com um array JSON de 3 itens, sem texto antes nem depois, no formato: [{"id":"curto-sem-espaco","nome":"até 40 letras","de":"até 160 letras: de onde veio a inspiração, em português simples","fundo":"#rrggbb","topo":"#rrggbb","topoTxt":"#rrggbb","destaque":"#rrggbb","destTxt":"#rrggbb","linha":"#rrggbb","raio":"10px","fonte":"uma de: ${Object.keys(FONTES).join(' | ')}"}]`,
    '',
    'Referências:',
    ...blocoDoCliente(refs.map((r) => `${String(r && r.tipo)}: ${String(r && r.valor)}`).join('\n'), '(nenhuma)'),
    '',
    'Sentimento desejado:',
    ...blocoDoCliente([...sent, String(entrada.extra ?? '')].join('\n'), '(não informado)'),
  ].join('\n')
}

/** Espelho de montarDesignSystemMd (src/app/ponte-estilo.ts), mas já com tudo que veio da tela revalidado/limpo. */
function montarDesignSystemMd(origem) {
  if (origem.tipo === 'identidade') {
    const arquivos = origem.arquivos
    return [
      '# Design system da obra', '', `> ${REGRA_CONTEUDO_CLIENTE}`, '',
      'Origem: identidade visual que o cliente já tem. O Claude lê os arquivos abaixo e completa este documento.', '',
      '## Arquivos do cliente',
      ...(arquivos.length ? arquivos.map((a) => `- estilo/identidade/${a}`) : ['- (nenhum arquivo)']), '',
      '## Cores e links informados',
      ...blocoDoCliente(origem.cores, '(o Claude tira das imagens enviadas)'), '',
    ].join('\n')
  }
  const e = origem.estilo
  return [
    '# Design system da obra', '', `> ${REGRA_CONTEUDO_CLIENTE}`, '',
    `Estilo: ${e.nome}. ${e.de}`,
    'Sentimento desejado:',
    ...blocoDoCliente(origem.sentimentos.join('\n'), 'não informado'), '',
    '## Cores', `- fundo: ${e.fundo}`, `- topo: ${e.topo} (texto ${e.topoTxt})`, `- destaque: ${e.destaque} (texto ${e.destTxt})`, `- linhas: ${e.linha}`, '',
    '## Letras', `- fonte: ${e.fonte}`, '',
    '## Botões e caixas', `- cantos: ${e.raio}`, '',
  ].join('\n')
}

const NOME_ARQ_ENTRADA = /^[a-z0-9][a-z0-9.-]*\.md$/
const NOME_ARQ_IDENTIDADE = /^[a-z0-9][a-z0-9._-]{0,80}$/

/** `deps`: { raiz, disparo (criarDisparo de projeto-comum.cjs) }. */
function criarEstilo({ raiz, disparo }) {
  return {
    async propor(entrada, pasta) {
      if (!entrada || typeof entrada !== 'object') throw new Error('entrada-invalida')
      const texto = await disparo.perguntar(typeof pasta === 'string' && pasta ? pasta : null, montarPedidoPropor(entrada))
      return estilosDoTexto(texto)
    },

    async materializar(pasta, origem) {
      pastaDaObra(raiz, pasta)
      if (!origem || typeof origem !== 'object') throw new Error('origem-invalida')
      if (origem.tipo === 'identidade') {
        const id = origem.identidade
        if (!id || typeof id !== 'object') throw new Error('origem-invalida')
        if (typeof id.prontoDS === 'string' && id.prontoDS) {
          // O design-system.md pronto do cliente PREVALECE: já está na obra; não se gera nem se grava nada.
          if (!NOME_ARQ_ENTRADA.test(id.prontoDS) || id.prontoDS.includes('..')) throw new Error('nome-invalido')
          const caminho = caminhoSeguro(raiz, pasta, id.prontoDS)
          let st
          try { st = fs.lstatSync(caminho) } catch { throw new Error('arquivo-inexistente') }
          if (!st.isFile() || st.isSymbolicLink()) throw new Error('arquivo-inexistente')
          return { caminho }
        }
        const arquivos = (Array.isArray(id.arquivos) ? id.arquivos : []).slice(0, 50).map(String).filter((a) => NOME_ARQ_IDENTIDADE.test(a) && !a.includes('..'))
        const md = montarDesignSystemMd({ tipo: 'identidade', arquivos, cores: String(id.cores ?? '') })
        return { caminho: gravarSemSobrescrever(raiz, pasta, [], 'design-system.md', md).caminho }
      }
      if (origem.tipo === 'estilo') {
        const estilo = estiloValido(origem.estilo)
        if (!estilo) throw new Error('estilo-invalido')
        const sentimentos = Array.isArray(origem.entrada && origem.entrada.sentimentos) ? origem.entrada.sentimentos.slice(0, 20).map(String) : []
        const md = montarDesignSystemMd({ tipo: 'estilo', estilo, sentimentos })
        return { caminho: gravarSemSobrescrever(raiz, pasta, [], 'design-system.md', md).caminho }
      }
      throw new Error('origem-invalida')
    },
  }
}

module.exports = { criarEstilo, estiloValido, estilosDoTexto, montarPedidoPropor, montarDesignSystemMd, FONTES }
