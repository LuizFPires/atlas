// Bloco C — auto-auditoria semanal da degustação. A varredura só SINALIZA (ocorrência aberta no painel); quem decide é o gestor.
// Os mesmos números estão na migration 0020 (função auditar_degustacao). Mude nos DOIS lugares.

/** Janela da varredura semanal. */
export const JANELA_AUDITORIA_DIAS = 7

/**
 * Limiares conservadores (o limite normal já barra o grosso; aqui é só o que escapou).
 * - dominio: pessoas DIFERENTES (e-mails distintos) pedindo com o mesmo domínio ainda não bloqueado. Provedores grandes ficam de fora.
 * - ip: pedidos de e-mails distintos vindos do mesmo IP. O freio já é 5/hora, então 8 na semana pede mais de uma rodada.
 * - tronco_variantes: grafias diferentes (pontos / +tag) do MESMO e-mail normalizado. 3 = a pessoa testou 3 jeitos de escrever o mesmo e-mail.
 * - tronco_pedidos: pedidos repetidos do mesmo e-mail normalizado.
 * - dispositivo_barradas: vezes que o MESMO computador foi barrado tentando um novo teste.
 */
export const LIMIARES_AUDITORIA = { dominio: 5, ip: 8, tronco_variantes: 3, tronco_pedidos: 6, dispositivo_barradas: 3 } as const

/** Provedores de uso comum: nunca são sugeridos nem aceitos como "descartável" (bloquear um deles barraria gente de verdade). */
export const PROVEDORES_COMUNS: ReadonlySet<string> = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'yahoo.com', 'yahoo.com.br', 'icloud.com', 'me.com',
  'uol.com.br', 'bol.com.br', 'terra.com.br', 'globo.com', 'globomail.com', 'ig.com.br', 'oi.com.br', 'r7.com', 'protonmail.com', 'proton.me',
])

/** Formato de domínio (sem @, sem ponto final, em minúsculas): rótulos de 1 a 63 letras/números/hífen e um final como .com ou .com.br. */
export const DOMINIO_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,23}$/

/** Sufixos públicos (curado, não é a PSL inteira): bloquear um deles derrubaria TODOS os e-mails abaixo dele (ex.: com.br). */
export const SUFIXOS_PUBLICOS: ReadonlySet<string> = new Set([
  'com.br', 'net.br', 'org.br', 'gov.br', 'edu.br', 'mil.br', 'art.br', 'blog.br', 'eco.br', 'eng.br', 'adv.br', 'med.br', 'psc.br', 'ind.br', 'inf.br', 'jus.br', 'leg.br', 'mp.br', 'tv.br', 'wiki.br',
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'co.za', 'co.jp', 'ne.jp', 'or.jp', 'co.in', 'com.ar', 'com.mx', 'com.pt', 'com.co', 'com.cn', 'com.tr', 'co.kr', 'com.ve', 'com.uy', 'com.py', 'com.pe', 'com.bo', 'com.ec', 'com.cl',
  'com', 'net', 'org', 'edu', 'gov', 'mil', 'int', 'info', 'biz', 'io', 'co', 'app', 'dev', 'xyz', 'online', 'site', 'top', 'club', 'shop', 'store', 'tech', 'cloud', 'email', 'br', 'uk', 'us', 'ai', 'me', 'tv', 'cc', 'pt', 'ar', 'mx',
  'github.io', 'vercel.app', 'netlify.app', 'herokuapp.com', 'blogspot.com', 'web.app', 'pages.dev', 'workers.dev', 'appspot.com',
])
/** Segundo nível genérico sob um país (com.xx, co.xx, net.xx, org.xx, gov.xx, edu.xx, ac.xx): também é sufixo público. */
const SEGUNDO_NIVEL_RE = /^(com|net|org|gov|edu|mil|co|ac|or|ne|go|nom|ltd|plc)\.[a-z]{2}$/

/** Domínio REGISTRÁVEL: tem pelo menos um rótulo acima do sufixo público (mailinator.com sim; com.br, com, co.uk não). */
export const dominioRegistravel = (d: string): boolean => DOMINIO_RE.test(d) && !SUFIXOS_PUBLICOS.has(d) && !SEGUNDO_NIVEL_RE.test(d)

/** Bloquear `d` barraria um provedor comum (d é igual ao provedor ou "pai" dele, ex.: google.com seria pai de mail.google.com)? */
export const protegeProvedor = (d: string): boolean => [...PROVEDORES_COMUNS].some((p) => p === d || p.endsWith(`.${d}`))
