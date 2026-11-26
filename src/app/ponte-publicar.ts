// Porta entre o app e os serviços de publicação (Vercel, Registro.br, App Store, Google Play).
// INVARIANTE: pagamento e "Enviar para revisão" são SEMPRE do cliente. O Atlas NÃO paga, NÃO envia para revisão, NÃO cria conta
// e NÃO digita credencial do cliente. Ele só guia, abre o site oficial e faz a parte técnica (DNS, publicar, cartaz com QR).
// O adaptador real (Electron) fica para /entregar (app/PENDENTE-ENTREGAR.md). Regras dele:
//  - só resolve/abre os HOSTS OFICIAIS de SITES_OFICIAIS (nunca uma URL que veio de dado), com timeout e sem seguir redirecionamento para fora;
//  - o domínio digitado pelo cliente é validado por `dominioValido` antes de qualquer consulta (sem SSRF);
//  - nenhum segredo (token da Vercel, senha) vai para arquivo.

/** Sites que o Atlas sabe abrir. A URL é fixa aqui dentro; o guia só escolhe o NOME do destino. */
export type DestinoSite = 'registro' | 'vercel' | 'apple-inscricao' | 'app-store-connect' | 'testflight' | 'google-console' | 'apple-duns' | 'asc-chaves' | 'expo-token' | 'google-grupos'

export const SITES_OFICIAIS: Record<DestinoSite, string> = {
  registro: 'https://registro.br/',
  vercel: 'https://vercel.com/',
  'apple-inscricao': 'https://developer.apple.com/programs/enroll/',
  'app-store-connect': 'https://appstoreconnect.apple.com/apps',
  testflight: 'https://testflight.apple.com/',
  'google-console': 'https://play.google.com/console/signup',
  'apple-duns': 'https://developer.apple.com/enroll/duns-lookup/',
  'asc-chaves': 'https://appstoreconnect.apple.com/access/integrations/api',
  'expo-token': 'https://expo.dev/settings/access-tokens',
  'google-grupos': 'https://groups.google.com/my-groups',
}

/** Hosts oficiais (a lista fechada que o adaptador real aceita). */
export const HOSTS_OFICIAIS: readonly string[] = ['registro.br', 'vercel.com', 'developer.apple.com', 'appstoreconnect.apple.com', 'testflight.apple.com', 'play.google.com', 'expo.dev', 'groups.google.com']

/** A URL é https e o host é exatamente um dos oficiais (ou subdomínio direto dele). Recusa tudo o mais. */
export function enderecoOficial(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return false
    return HOSTS_OFICIAIS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))
  } catch { return false }
}

/** "Cadeira 1" -> "cadeira1": só letras e números, sem acento, até 40 caracteres; vazio vira "meusistema". */
export function slugDaObra(nome: string): string {
  const s = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
  return s || 'meusistema'
}

/** Domínio .com.br simples e seguro: letras minúsculas, números e hífen; sem IP, porta, caminho ou barra. */
export function dominioValido(d: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.com\.br$/.test(d)
}

export interface RegistroDns { tipo: 'A' | 'CNAME'; nome: string; valor: string }

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/
/** IP público de verdade: recusa 0.0.0.0, broadcast, privados (10/8, 172.16/12, 192.168/16), loopback, link-local e reservados. */
function ipv4Publico(v: string): boolean {
  if (!IPV4.test(v)) return false
  const [a, b] = v.split('.').map(Number)
  if (a === 0 || a === 127 || a >= 224) return false
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) return false
  return true
}
const HOST = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/
/** Só aceita o que parece um registro de DNS de verdade (o que vier de fora é dado, não confiável). */
export function registroDnsValido(r: RegistroDns): boolean {
  if (r.tipo === 'A') return r.nome === '@' && ipv4Publico(r.valor)
  if (r.tipo === 'CNAME') return /^[a-z0-9-]{1,63}$/.test(r.nome) && HOST.test(r.valor)
  return false
}

export type SituacaoNome = 'livre' | 'ocupado' | 'incerto'

export interface Progresso { guia: string; passo: number }

export interface PontePublicar {
  /** true só em `publicarIndisponivel`: sem adaptador, o Atlas não finge publicação nem guarda progresso. */
  readonly indisponivel?: boolean
  /** Abre o site oficial no navegador do cliente. Em `registro`, o domínio (já validado) pode vir para a pesquisa. */
  abrirSite(destino: DestinoSite, dominio?: string): Promise<void>
  /** Consulta pública: o nome está livre no Registro.br? "incerto" se não deu para saber (nunca finge). */
  nomeLivre(dominio: string): Promise<SituacaoNome>
  /** LÊ na hora os registros de DNS que a Vercel pede para o domínio (não são valores fixos). */
  lerDns(dominio: string): Promise<RegistroDns[]>
  /** O DNS público já aponta para a Vercel com esses registros? (o Atlas confere de tempos em tempos) */
  dnsNoAr(dominio: string, registros: RegistroDns[]): Promise<boolean>
  /** Coloca o sistema no ar na conta da Vercel DO CLIENTE e liga o banco. Devolve o endereço .vercel.app. */
  publicarNoAr(slug: string): Promise<{ endereco: string }>
  /** Gera o cartaz com QR code na pasta da obra. Devolve o nome do arquivo. */
  gerarCartaz(endereco: string, pastaObra?: string): Promise<{ arquivo: string }>
  /** "Pode fechar o Atlas: ele continua deste passo". Guarda só guia e número do passo (nada secreto). */
  lerProgresso(pastaObra: string): Promise<Progresso | null>
  gravarProgresso(pastaObra: string, p: Progresso): Promise<void>
}

/** Valores de exemplo (modo fixture). No real, quem diz é a Vercel na hora. */
export const DNS_EXEMPLO: RegistroDns[] = [
  { tipo: 'A', nome: '@', valor: '76.76.21.21' },
  { tipo: 'CNAME', nome: 'www', valor: 'cname.vercel-dns.com' },
]

export interface PublicarFixture extends PontePublicar {
  readonly abertos: Array<{ destino: DestinoSite; dominio?: string }>
  readonly publicados: string[]
  readonly cartazes: string[]
  simular: { reconhecerDns(): void; ocupar(dominio: string): void; falharPublicacao(falha: boolean): void }
}

export function criarPublicarFixture(opcoes: { dns?: RegistroDns[]; ocupados?: string[]; dnsNoAr?: boolean } = {}): PublicarFixture {
  const ocupados = new Set(opcoes.ocupados ?? [])
  const progresso = new Map<string, Progresso>()
  let noAr = opcoes.dnsNoAr ?? false
  let falha = false
  const abertos: PublicarFixture['abertos'] = []
  const publicados: string[] = []
  const cartazes: string[] = []
  return {
    abertos, publicados, cartazes,
    async abrirSite(destino, dominio) {
      if (dominio !== undefined && !dominioValido(dominio)) throw new Error('dominio-invalido')
      abertos.push({ destino, dominio })
    },
    async nomeLivre(d) { return !dominioValido(d) ? 'incerto' : ocupados.has(d) ? 'ocupado' : 'livre' },
    async lerDns(d) {
      if (!dominioValido(d)) throw new Error('dominio-invalido')
      return (opcoes.dns ?? DNS_EXEMPLO).filter(registroDnsValido)
    },
    async dnsNoAr() { return noAr },
    async publicarNoAr(slug) {
      if (falha) throw new Error('falhou')
      publicados.push(slug)
      return { endereco: `${slug}.vercel.app` }
    },
    async gerarCartaz(endereco) { cartazes.push(endereco); return { arquivo: 'cartaz-instalar-app.pdf' } },
    async lerProgresso(p) { return progresso.get(p) ?? null },
    async gravarProgresso(p, v) { progresso.set(p, v) },
    simular: { reconhecerDns() { noAr = true }, ocupar(d) { ocupados.add(d) }, falharPublicacao(f) { falha = f } },
  }
}

/** Sem adaptador real e fora do modo fixture: o Atlas não finge que publicou, que conferiu nome nem DNS. */
export const publicarIndisponivel: PontePublicar = {
  indisponivel: true,
  async abrirSite() { throw new Error('indisponivel') },
  async nomeLivre() { return 'incerto' },
  async lerDns() { throw new Error('indisponivel') },
  async dnsNoAr() { return false },
  async publicarNoAr() { throw new Error('indisponivel') },
  async gerarCartaz() { throw new Error('indisponivel') },
  async lerProgresso() { return null },
  async gravarProgresso() {},
}
