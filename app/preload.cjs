// Preload do app Atlas: a ÚNICA ponte entre a tela (renderer) e o processo principal.
//
// O QUE FAZ: expõe window.atlasDesktop (contextIsolation ligado, sandbox ligado, SEM nodeIntegration). Só os namespaces
// que o front usa (src/app/ponte.ts): cofre, servidor, pagamento, arquivos, obras, claude, modos, construcao, painel, retomar, estilo, prototipo, batismo, nomes, posobra, cota, ocorrencias, celular, importar, ajuda, casos, publicar, kit. Todo argumento vira String/boolean aqui e é
// revalidado de novo no processo principal (main.cjs); o renderer nunca recebe caminho de origem, módulo Node nem Electron.
//
// COMO TESTAR (Windows): `npx electron app/main.cjs`, abrir as ferramentas do desenvolvedor e digitar `window.atlasDesktop`:
// deve listar só argv, cofre, hashComputador, descricaoComputador, impedirSono, arquivos, obras, claude, modos, construcao, painel, retomar, estilo, prototipo, batismo, nomes, posobra, ... (ver a lista acima, inclui ajuda, casos, publicar, kit). `typeof require` = 'undefined'.
'use strict'
const { contextBridge, ipcRenderer } = require('electron')

// O Electron embrulha o erro do processo principal ("Error invoking remote method 'x': Error: codigo-do-erro"); a tela compara o
// código puro (ex.: 'zip-bomba', 'ja-recebido'), então devolvemos só ele. Mensagem que não é um código simples passa como veio.
const chamar = async (canal, ...args) => {
  try { return await ipcRenderer.invoke(canal, ...args) } catch (e) {
    const m = /Error: ([a-z0-9][a-z0-9-]{0,60})\s*$/.exec(String((e && e.message) || ''))
    throw new Error(m ? m[1] : String((e && e.message) || 'falhou'))
  }
}

// Só o que o front precisa; nada de Node exposto.
contextBridge.exposeInMainWorld('atlasDesktop', {
  argv: ipcRenderer.sendSync('atlas:argv'),
  cofre: {
    guardar: (c, v) => chamar('atlas:cofre:guardar', String(c), String(v)),
    ler: (c) => chamar('atlas:cofre:ler', String(c)),
    apagar: (c) => chamar('atlas:cofre:apagar', String(c)),
  },
  hashComputador: () => chamar('atlas:hash'),
  descricaoComputador: () => chamar('atlas:descricao'),
  impedirSono: (ligado) => chamar('atlas:sono', !!ligado),
  // Compra de dentro do app: o processo principal só abre a página de pagamento da Stripe.
  pagamento: { abrir: (url) => chamar('atlas:pagamento:abrir', String(url)) },
  // Código do link de instalação chegando com o app já aberto (atlas://ativar?t=...): o processo principal valida e avisa a tela.
  aoReceberLink: (aviso) => { ipcRenderer.on('atlas:link', (_e, t) => { if (typeof aviso === 'function') aviso(String(t)) }) },
  // Chamadas ao servidor de licenças pelo processo principal (a tela em file:// é barrada pelo CORS). Rota e cabeçalhos são revalidados lá.
  servidor: {
    postar: (rota, corpo, cabecalhos) => chamar('atlas:servidor:postar', String(rota), corpo, cabecalhos),
  },
  arquivos: {
    escolher: (tipo) => chamar('atlas:arquivos:escolher', String(tipo)),
    guardar: (pasta, destino, token) => chamar('atlas:arquivos:guardar', String(pasta), String(destino), String(token)),
  },
  obras: {
    // raiz() é síncrona na porta; o valor é fixo (home\Atlas\Obras), então lemos uma vez.
    raiz: (() => { const r = ipcRenderer.sendSync('atlas:obras:raiz'); return () => r })(),
    listar: () => chamar('atlas:obras:listar'),
    criarSubpasta: (nome) => chamar('atlas:obras:criar', String(nome)),
    abrirPasta: () => chamar('atlas:obras:abrir'),
  },
  claude: {
    abrirLogin: () => chamar('atlas:claude:login'),
    abrirSite: (alvo) => chamar('atlas:claude:site', String(alvo)),
    estado: () => chamar('atlas:claude:estado'),
    renovarConexao: () => chamar('atlas:claude:renovar'),
  },
  modos: {
    ler: (pasta) => chamar('atlas:modos:ler', String(pasta)),
    gravar: (pasta, modo) => chamar('atlas:modos:gravar', String(pasta), String(modo)),
  },
  retomar: {
    obraEmAndamento: () => chamar('atlas:retomar:andamento'),
    continuar: (obra) => chamar('atlas:retomar:continuar', String((obra && obra.pasta) ?? '')),
  },
  painel: {
    ler: (pasta) => chamar('atlas:painel:ler', String(pasta)),
    pausar: (pasta) => chamar('atlas:painel:pausar', String(pasta)),
    continuar: (pasta) => chamar('atlas:painel:continuar', String(pasta)),
    aprovarEtapa: (pasta) => chamar('atlas:painel:aprovar', String(pasta)),
    aplicarModo: (pasta, modo) => chamar('atlas:painel:modo', String(pasta), String(modo)),
    // síncrona na porta: o processo principal só devolve http://127.0.0.1:<porta>/... (ou null).
    enderecoCanteiro: (pasta) => ipcRenderer.sendSync('atlas:painel:endereco', String(pasta)),
    abrirTeste: (pasta) => chamar('atlas:painel:teste', String(pasta)),
  },
  estilo: {
    // referencias/sentimentos viram texto; o processo principal revalida tudo. pasta é opcional (a obra, para o Claude olhar os prints).
    propor: (entrada, pasta) => chamar('atlas:estilo:propor', JSON.parse(JSON.stringify(entrada ?? {})), pasta ? String(pasta) : undefined),
    materializar: (pasta, origem) => chamar('atlas:estilo:materializar', String(pasta), JSON.parse(JSON.stringify(origem ?? {}))),
  },
  prototipo: {
    estado: (pasta) => chamar('atlas:prototipo:estado', String(pasta)),
    desenhar: (pasta, obraNome, estilo, relato) => chamar('atlas:prototipo:desenhar', String(pasta), String(obraNome), JSON.parse(JSON.stringify(estilo ?? {})), String(relato ?? '')),
    ajustar: (pasta, pedido) => chamar('atlas:prototipo:ajustar', String(pasta), String(pedido)),
    voltar: (pasta, numero) => chamar('atlas:prototipo:voltar', String(pasta), Number(numero)),
  },
  batismo: {
    sugerir: (pasta, obraNome, pedido) => chamar('atlas:batismo:sugerir', String(pasta), String(obraNome), JSON.parse(JSON.stringify(pedido ?? {}))),
    batizar: (pasta, marca) => chamar('atlas:batismo:batizar', String(pasta), JSON.parse(JSON.stringify(marca ?? {}))),
  },
  nomes: {
    // só o NOME vai ao processo principal; o host e o caminho da consulta são fixos lá (anti-SSRF, ver adaptadores/nomes.cjs).
    conferir: (nome) => chamar('atlas:nomes:conferir', String(nome)),
  },
  posobra: {
    // pedido/plano viram dados puros (texto); o processo principal revalida tudo e CONFERE A LICENÇA de novo antes de executar.
    entender: (pasta, pedido) => chamar('atlas:posobra:entender', String(pasta), JSON.parse(JSON.stringify(pedido ?? {}))),
    executar: (pasta, pedido, plano) => chamar('atlas:posobra:executar', String(pasta), JSON.parse(JSON.stringify(pedido ?? {})), JSON.parse(JSON.stringify(plano ?? {}))),
    historico: (pasta) => chamar('atlas:posobra:historico', String(pasta)),
  },
  cota: {
    ler: (pasta) => chamar('atlas:cota:ler', String(pasta)),
    retomar: (pasta) => chamar('atlas:cota:retomar', String(pasta)),
  },
  celular: {
    // síncrona na porta: o endereço é fixo no processo principal (lido uma vez).
    enderecoApp: (() => { const e = ipcRenderer.sendSync('atlas:celular:endereco'); return () => e })(),
    // só frequência e 3 avisos (dados puros); o processo principal revalida estritamente.
    aplicar: (prefs) => chamar('atlas:celular:aplicar', JSON.parse(JSON.stringify(prefs ?? {}))),
  },
  importar: {
    // o renderer só recebe nome limpo, tamanho e um token opaco de uso único; o caminho do .zip fica no processo principal.
    escolherZip: () => chamar('atlas:importar:escolher'),
    validar: (token) => chamar('atlas:importar:validar', String(token)),
    receber: (pasta, token) => chamar('atlas:importar:receber', String(pasta), String(token)),
  },
  ocorrencias: {
    ler: (pasta) => chamar('atlas:ocorrencias:ler', String(pasta)),
    avisar: (pasta, id) => chamar('atlas:ocorrencias:avisar', String(pasta), Number(id)),
    // a chave (se houver) só vai ao processo principal, que a entrega ao cofre; nunca a arquivo.
    resolver: (pasta, id, segredo) => chamar('atlas:ocorrencias:resolver', String(pasta), Number(id), segredo === undefined || segredo === null ? undefined : String(segredo)),
    adiar: (pasta, id) => chamar('atlas:ocorrencias:adiar', String(pasta), Number(id)),
  },
  ajuda: {
    // contexto/histórico viram dados puros (texto); o processo principal revalida tudo e monta o pedido com a regra do conteúdo do cliente.
    conversar: (contexto, historico, mensagem) => chamar('atlas:ajuda:conversar', JSON.parse(JSON.stringify(contexto ?? {})), JSON.parse(JSON.stringify(historico ?? [])), String(mensagem ?? '')),
    // só o ID da lista fechada; a URL é fixa no processo principal.
    abrirPagina: (id) => chamar('atlas:ajuda:pagina', String(id)),
    tirarPrint: (pasta) => chamar('atlas:ajuda:print', pasta ? String(pasta) : undefined),
    anexarImagem: (pasta) => chamar('atlas:ajuda:anexar', pasta ? String(pasta) : undefined),
  },
  casos: {
    enviar: (caso) => chamar('atlas:casos:enviar', JSON.parse(JSON.stringify(caso ?? {}))),
  },
  publicar: {
    // só o NOME do destino (nunca URL); domínio e registros são dados puros revalidados no processo principal.
    abrirSite: (destino, dominio) => chamar('atlas:publicar:site', String(destino), dominio === undefined || dominio === null ? undefined : String(dominio)),
    nomeLivre: (dominio) => chamar('atlas:publicar:nome', String(dominio)),
    lerDns: (dominio) => chamar('atlas:publicar:dns', String(dominio)),
    dnsNoAr: (dominio, registros) => chamar('atlas:publicar:dnsnoar', String(dominio), JSON.parse(JSON.stringify(registros ?? []))),
    publicarNoAr: (slug) => chamar('atlas:publicar:noar', String(slug)),
    gerarCartaz: (endereco, pasta) => chamar('atlas:publicar:cartaz', String(endereco), pasta === undefined ? undefined : String(pasta)),
    lerProgresso: (pasta) => chamar('atlas:publicar:ler', String(pasta)),
    gravarProgresso: (pasta, p) => chamar('atlas:publicar:gravar', String(pasta), JSON.parse(JSON.stringify(p ?? {}))),
  },
  kit: {
    // o kit fica no processo principal (pasta temporária do app); aqui só volta { ok, obraId, marca } e a tela pode pedir para descartar.
    entregar: async (obraId) => {
      const r = await chamar('atlas:kit:entregar', String(obraId))
      if (!r || r.ok !== true) return { ok: false, mensagem: String((r && r.mensagem) || 'Não foi possível liberar o kit agora.') }
      const id = String(r.obraId)
      return { ok: true, kit: { obraId: id, marca: String(r.marca), arquivos: () => [], descartar: () => { void chamar('atlas:kit:descartar', id).catch(() => {}) } } }
    },
  },
  construcao: {
    planejar: (pasta, obraNome) => chamar('atlas:construcao:planejar', String(pasta), String(obraNome)),
    // etapas: só n/nome/desc/tela como texto; o processo principal revalida tudo.
    iniciar: (pasta, obraNome, modo, etapas) => chamar('atlas:construcao:iniciar', String(pasta), String(obraNome), String(modo),
      (Array.isArray(etapas) ? etapas : []).slice(0, 20).map((e) => ({ n: String(e && e.n), nome: String(e && e.nome), desc: String(e && e.desc), ...(e && e.tela ? { tela: String(e.tela) } : {}) }))),
  },
})
