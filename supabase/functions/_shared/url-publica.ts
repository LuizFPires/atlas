// Endereço que vai no e-mail para o cliente: sempre https e no domínio próprio. O endereço provisório da Vercel
// (*.vercel.app) parece golpe para o cliente e cai em filtro de spam, então é trocado pelo padrão (26/11/2026).

/** O endereço configurado, se servir; senão o padrão. Sem barra no fim. */
export function urlPublica(configurado: string | undefined | null, padrao: string): string {
  let u: URL
  try { u = new URL(String(configurado ?? '')) } catch { return padrao }
  if (u.protocol !== 'https:' || /\.vercel\.app$/i.test(u.hostname) || u.username || u.password) return padrao
  return `${u.origin}${u.pathname}`.replace(/\/+$/, '')
}
