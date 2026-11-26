import { textoDaTrava } from './explicar-trava'
// Ponte das lojas (M59; prototipo/caminho-novo/PB8Lojas, PB9LojasOk, PB13Testadores). O adaptador real é app/adaptadores/lojas.cjs.
// Chaves (Expo e App Store Connect) vão direto para o cofre do computador; a tela nunca vê o arquivo da chave.

export type CaminhoLojas = 'pessoa' | 'empresa'
export type ContaLoja = 'apple' | 'google' | 'expo' | 'duns'

export interface EstadoLojas {
  caminho: CaminhoLojas | null
  contas: Record<ContaLoja, boolean>
  chaveAsc: boolean
  convite: { link: string; grupo: string | null } | null
  noAr: boolean
  pacote: string | null
  /** Parte 2: a versão de app montada na nuvem e enviada aos testes das lojas. */
  envio: { fase: FaseEnvio; ios: 'nada' | 'falta-chave' | 'montando' | 'testflight' | 'erro'; android: 'nada' | 'montando' | 'pronto' | 'enviado' | 'erro'; aab: boolean; erro: string | null }
}
export type FaseEnvio = 'nada' | 'preparando' | 'montando' | 'enviando' | 'google-primeiro' | 'teste' | 'erro'
export interface Testadores { pessoas: number; faltam: number; dia: number; completo: boolean; nomes: string[] }

export interface PonteLojas {
  indisponivel?: boolean
  estado(pasta: string): Promise<EstadoLojas>
  escolher(pasta: string, caminho: CaminhoLojas): Promise<EstadoLojas>
  marcarConta(pasta: string, conta: ContaLoja, sim: boolean): Promise<EstadoLojas>
  guardarTokenExpo(token: string): Promise<boolean>
  /** Abre o "escolher arquivo" do computador para o AuthKey_….p8; o Key ID sai do nome do arquivo. */
  escolherChaveAsc(pasta: string, issuerId: string, teamId: string): Promise<boolean>
  montar(pasta: string): Promise<EstadoLojas>
  googleEnviado(pasta: string): Promise<EstadoLojas>
  baixarAab(pasta: string): Promise<void>
  criarConvite(pasta: string, appNome: string, grupoUrl: string): Promise<{ link: string }>
  testadores(pasta: string): Promise<Testadores>
}

export function explicarErroLojas(motivo: string): string {
  if (motivo === 'token-invalido') return 'Essa chave da Expo não parece certa. Copie de novo a chave inteira que a Expo mostrou.'
  if (motivo === 'chave-invalida' || motivo === 'arquivo-invalido') return 'Esse arquivo ou o Issuer ID não parecem certos. Escolha o AuthKey_….p8 que a Apple baixou e cole o Issuer ID de novo.'
  if (motivo === 'grupo-invalido') return 'Esse endereço não parece de um Grupo do Google. Ele começa com groups.google.com/g/'
  if (motivo === 'obra-fora-do-ar') return 'Primeiro o sistema precisa estar no ar.'
  if (motivo === 'cancelado') return ''
  if (motivo === 'falta-expo') return 'Falta a conta da Expo: é nela que o Atlas monta a versão de app.'
  if (motivo === 'eas-build') return 'A montagem na nuvem (Expo) não terminou. Toque em "Tentar de novo"; se continuar, fale com o Atlas.'
  if (motivo === 'eas-submit-ios') return 'A versão de iPhone ficou pronta, mas a Apple não aceitou o envio. Confira a chave da App Store Connect.'
  if (motivo === 'sem-app') return 'A versão de app não ficou pronta na obra. Toque em "Tentar de novo".'
  return textoDaTrava(motivo, 'Não deu certo agora.')
}

const vazio = (): EstadoLojas => ({ caminho: null, contas: { apple: false, google: false, expo: false, duns: false }, chaveAsc: false, convite: null, noAr: true, pacote: 'br.com.pontoampla.app', envio: { fase: 'nada', ios: 'nada', android: 'nada', aab: false, erro: null } })

export function criarLojasFixture({ passoMs = 600 }: { passoMs?: number } = {}): PonteLojas {
  const estados = new Map<string, EstadoLojas>()
  const de = (p: string) => { if (!estados.has(p)) estados.set(p, vazio()); return estados.get(p) as EstadoLojas }
  let pessoas = 9
  return {
    async estado(p) { return structuredClone(de(p)) },
    async escolher(p, caminho) { de(p).caminho = caminho; return structuredClone(de(p)) },
    async marcarConta(p, conta, sim) { de(p).contas[conta] = sim; return structuredClone(de(p)) },
    async guardarTokenExpo(t) { if (!/^[A-Za-z0-9_-]{30,120}$/.test(t.trim())) throw new Error('token-invalido'); for (const e of estados.values()) e.contas.expo = true; return true },
    async montar(p) {
      const e = de(p)
      if (!e.contas.expo) throw new Error('falta-expo')
      e.envio = { fase: 'preparando', ios: e.chaveAsc ? 'montando' : 'falta-chave', android: 'montando', aab: false, erro: null }
      void (async () => {
        for (const f of ['montando', 'enviando'] as const) { await new Promise((r) => setTimeout(r, passoMs)); e.envio.fase = f }
        await new Promise((r) => setTimeout(r, passoMs))
        e.envio = { ...e.envio, fase: 'google-primeiro', ios: e.chaveAsc ? 'testflight' : 'falta-chave', android: 'pronto', aab: true }
      })()
      return structuredClone(e)
    },
    async googleEnviado(p) { const e = de(p); e.envio = { ...e.envio, android: 'enviado', fase: 'teste' }; return structuredClone(e) },
    async baixarAab() {},
    async escolherChaveAsc(p, issuer) { if (!/^[0-9a-f-]{36}$/i.test(issuer.trim())) throw new Error('chave-invalida'); de(p).chaveAsc = true; return true },
    async criarConvite(p, _n, grupo) { if (!/^https:\/\/groups\.google\.com\/g\//.test(grupo)) throw new Error('grupo-invalido'); de(p).convite = { link: 'https://atlas.exemplo/teste/abcdefghjk23', grupo }; return { link: 'https://atlas.exemplo/teste/abcdefghjk23' } },
    async testadores() { pessoas = Math.min(12, pessoas + 1); return { pessoas, faltam: 12 - pessoas, dia: pessoas >= 12 ? 1 : 0, completo: false, nomes: [] } },
  }
}

export const lojasIndisponivel: PonteLojas = {
  indisponivel: true,
  async estado() { return { ...vazio(), noAr: false, pacote: null } },
  async escolher() { throw new Error('indisponivel') },
  async marcarConta() { throw new Error('indisponivel') },
  async guardarTokenExpo() { throw new Error('indisponivel') },
  async escolherChaveAsc() { throw new Error('indisponivel') },
  async montar() { throw new Error('indisponivel') },
  async googleEnviado() { throw new Error('indisponivel') },
  async baixarAab() { throw new Error('indisponivel') },
  async criarConvite() { throw new Error('indisponivel') },
  async testadores() { return { pessoas: 0, faltam: 12, dia: 0, completo: false, nomes: [] } },
}
