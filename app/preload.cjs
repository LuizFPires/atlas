// Preload do app Atlas: a ÚNICA ponte entre a tela (renderer) e o processo principal.
//
// O QUE FAZ: expõe window.atlasDesktop (contextIsolation ligado, sandbox ligado, SEM nodeIntegration). Só os namespaces
// que o front usa (src/app/ponte.ts): cofre, arquivos, obras, claude, modos, construcao, painel, retomar, estilo, prototipo, batismo, nomes, posobra. Todo argumento vira String/boolean aqui e é
// revalidado de novo no processo principal (main.cjs); o renderer nunca recebe caminho de origem, módulo Node nem Electron.
//
// COMO TESTAR (Windows): `npx electron app/main.cjs`, abrir as ferramentas do desenvolvedor e digitar `window.atlasDesktop`:
// deve listar só argv, cofre, hashComputador, descricaoComputador, impedirSono, arquivos, obras, claude, modos, construcao, painel, retomar, estilo, prototipo, batismo, nomes, posobra. `typeof require` = 'undefined'.
'use strict'
const { contextBridge, ipcRenderer } = require('electron')

const chamar = (canal, ...args) => ipcRenderer.invoke(canal, ...args)

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
    desenhar: (pasta, obraNome, estilo) => chamar('atlas:prototipo:desenhar', String(pasta), String(obraNome), JSON.parse(JSON.stringify(estilo ?? {}))),
    ajustar: (pasta, pedido) => chamar('atlas:prototipo:ajustar', String(pasta), String(pedido)),
    voltar: (pasta, numero) => chamar('atlas:prototipo:voltar', String(pasta), Number(numero)),
  },
  batismo: {
    sugerir: (pasta, obraNome, pedido) => chamar('atlas:batismo:sugerir', String(pasta), String(obraNome), JSON.parse(JSON.stringify(pedido ?? {}))),
    batizar: (pasta, marca) => chamar('atlas:batismo:batizar', String(pasta), JSON.parse(JSON.stringify(marca ?? {}))),
  },
  construcao: {
    planejar: (pasta, obraNome) => chamar('atlas:construcao:planejar', String(pasta), String(obraNome)),
    // etapas: só n/nome/desc/tela como texto; o processo principal revalida tudo.
    iniciar: (pasta, obraNome, modo, etapas) => chamar('atlas:construcao:iniciar', String(pasta), String(obraNome), String(modo),
      (Array.isArray(etapas) ? etapas : []).slice(0, 20).map((e) => ({ n: String(e && e.n), nome: String(e && e.nome), desc: String(e && e.desc), ...(e && e.tela ? { tela: String(e.tela) } : {}) }))),
  },
})
