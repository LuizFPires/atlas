'use strict'
const { contextBridge, ipcRenderer } = require('electron')

// Só o que o front precisa; nada de Node exposto.
contextBridge.exposeInMainWorld('atlasDesktop', {
  argv: ipcRenderer.sendSync('atlas:argv'),
  cofre: {
    guardar: (c, v) => ipcRenderer.invoke('atlas:cofre:guardar', c, v),
    ler: (c) => ipcRenderer.invoke('atlas:cofre:ler', c),
    apagar: (c) => ipcRenderer.invoke('atlas:cofre:apagar', c),
  },
  hashComputador: () => ipcRenderer.invoke('atlas:hash'),
  descricaoComputador: () => ipcRenderer.invoke('atlas:descricao'),
  impedirSono: (ligado) => ipcRenderer.invoke('atlas:sono', !!ligado),
})
