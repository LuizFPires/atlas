// Código do link de instalação (uso único, ~48 h) chegando ao app. Lógica pura, sem Electron.
//
// O instalador é o mesmo arquivo para todo mundo, então o código não vem nele. Depois de instalar, o cliente clica em
// "Liberar o Atlas neste computador" na página do e-mail: o navegador abre atlas://ativar?t=<código> e o Windows entrega
// esse endereço ao app como argumento (na abertura, ou no evento second-instance se o app já está aberto).
// `--token=<código>` na linha de comando continua valendo (desenvolvimento).
//
// COMO TESTAR: `node --test app/link-instalacao.teste.cjs`.
'use strict'

const TOKEN_RE = /^[\w-]{20,128}$/ // igual a tokenDaUrl (src/web/degustacao-api.ts)

/** Devolve o código do link achado nos argumentos, ou ''. Só aceita atlas://ativar?t=<código> e --token=<código>. */
function tokenDoLink(argv) {
  if (!Array.isArray(argv)) return ''
  for (const a of argv) {
    if (typeof a !== 'string') continue
    let t = ''
    if (a.startsWith('--token=')) t = a.slice('--token='.length)
    else if (/^atlas:\/\/ativar\/?\?/i.test(a)) {
      try { t = new URL(a).searchParams.get('t') || '' } catch { t = '' }
    }
    if (TOKEN_RE.test(t)) return t
  }
  return ''
}

/** Argumentos que a tela enxerga: sem o endereço atlas:// nem código antigo, com `--token=<código>` no fim. */
function comToken(argv, token) {
  const limpo = (Array.isArray(argv) ? argv : []).filter((a) => typeof a === 'string' && !a.startsWith('--token=') && !/^atlas:\/\//i.test(a))
  return token ? [...limpo, `--token=${token}`] : limpo
}

module.exports = { tokenDoLink, comToken }
