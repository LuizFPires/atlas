// Lista BASE de domínios de e-mail descartável (recusados na degustação). Em minúsculas, sem "@".
// Extensível sem deploy: acrescente linhas na tabela `dominios_bloqueados` (0016). O bloco C pode alimentar uma ou outra.
// Subdomínios também são barrados (x.mailinator.com casa com mailinator.com).
export const DOMINIOS_DESCARTAVEIS: ReadonlySet<string> = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.biz', 'guerrillamail.de', 'grr.la', 'sharklasers.com',
  'pokemail.net', 'spam4.me', '10minutemail.com', '10minutemail.net', '10minutemail.org', '20minutemail.com', 'tempmail.com', 'temp-mail.org', 'temp-mail.io',
  'tempmail.net', 'tempmail.dev', 'tempmailo.com', 'tempail.com', 'tempinbox.com', 'throwawaymail.com', 'yopmail.com', 'yopmail.net', 'yopmail.fr',
  'trashmail.com', 'trashmail.net', 'trashmail.de', 'trash-mail.com', 'getnada.com', 'nada.email', 'dispostable.com', 'maildrop.cc', 'mailnesia.com',
  'mailcatch.com', 'mintemail.com', 'mohmal.com', 'fakeinbox.com', 'fakemail.net', 'emailondeck.com', 'mytemp.email', 'burnermail.io', 'discard.email',
  'spamgourmet.com', 'getairmail.com', 'moakt.com', 'tmpmail.org', 'tmpmail.net', 'tmail.ws', 'inboxkitten.com', 'mailtemp.net', 'minuteinbox.com',
  'anonbox.net', '33mail.com', 'emailfake.com', 'fakemailgenerator.com', 'luxusmail.org', 'tempr.email', 'dropmail.me', 'harakirimail.com', 'mail.tm',
  'cuvox.de', 'einrot.com', 'rhyta.com', 'dayrep.com', 'teleworm.us', 'armyspy.com', 'superrito.com', 'gustr.com', 'fleckens.hu',
])
