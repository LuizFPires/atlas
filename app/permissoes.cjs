'use strict'
// O que a janela do Atlas pode pedir ao Chromium (só para a página do próprio app; o resto é negado):
//  - media: o microfone ("tudo pode ser falado");
//  - clipboard-sanitized-write: os botões "Copiar" (só escrever; LER a área de transferência continua negado).
const PERMITIDAS = new Set(['media', 'clipboard-sanitized-write'])
const permissaoDoApp = (permissao) => PERMITIDAS.has(String(permissao))
module.exports = { permissaoDoApp }
