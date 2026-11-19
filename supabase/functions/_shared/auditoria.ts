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
