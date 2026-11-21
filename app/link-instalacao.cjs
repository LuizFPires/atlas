// Código do link de instalação (uso único, ~48 h) chegando ao app. Lógica pura, sem Electron.
//
// O instalador é o mesmo arquivo para todo mundo, então o código vem no NOME do arquivo baixado: a página do e-mail baixa
// Atlas-Instalador-<código>.exe e o instalador abre o app com --instalador=<nome do arquivo>. Reserva, se o cliente renomear
// o arquivo: o botão "Liberar o Atlas neste computador" da página abre atlas://ativar?t=<código>, que o Windows entrega ao app
// como argumento (na abertura, ou no evento second-instance se o app já está aberto).
// `--token=<código>` na linha de comando continua valendo (desenvolvimento).
//
// COMO TESTAR: `node --test app/link-instalacao.teste.cjs`.
'use strict'

const TOKEN_RE = /^[\w-]{20,128}$/ // igual a tokenDaUrl (src/web/degustacao-api.ts)
// Nome do instalador baixado pela página do e-mail: Atlas-Instalador-<código>.exe (o navegador acrescenta " (1)" se baixar de novo).
const INSTALADOR_RE = /^Atlas-Instalador-([\w-]{20,128})(?: \(\d+\))?\.exe$/i

/** Devolve o código do link achado nos argumentos, ou ''. Aceita atlas://ativar?t=<código>, --token=<código> e, por último,
 *  --instalador=Atlas-Instalador-<código>.exe (o nome do instalador baixado, repassado pelo instalador na primeira abertura). */
function tokenDoLink(argv) {
  if (!Array.isArray(argv)) return ''
  let doInstalador = ''
  for (const a of argv) {
    if (typeof a !== 'string') continue
    let t = ''
    if (a.startsWith('--token=')) t = a.slice('--token='.length)
    else if (/^atlas:\/\/ativar\/?\?/i.test(a)) {
      try { t = new URL(a).searchParams.get('t') || '' } catch { t = '' }
    } else if (a.startsWith('--instalador=') && !doInstalador) {
      const m = INSTALADOR_RE.exec(a.slice('--instalador='.length))
      if (m) doInstalador = m[1]
      continue
    }
    if (TOKEN_RE.test(t)) return t
  }
  return doInstalador
}

/** Argumentos que a tela enxerga: sem o endereço atlas:// nem código antigo, com `--token=<código>` no fim. */
function comToken(argv, token) {
  const limpo = (Array.isArray(argv) ? argv : []).filter((a) => typeof a === 'string' && !a.startsWith('--token=') && !a.startsWith('--instalador=') && !/^atlas:\/\//i.test(a))
  return token ? [...limpo, `--token=${token}`] : limpo
}

module.exports = { tokenDoLink, comToken }
