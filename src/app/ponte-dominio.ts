// Ponte do domínio próprio (M57; prototipo/caminho-novo/PB6Dominio e PB7DominioOk). O adaptador real é app/adaptadores/dominio.cjs.

export type IdPassoDominio = 'ligado' | 'troca' | 'internet' | 'cadeado'
export type FaseDominio = 'nenhum' | 'esperando' | 'cadeado' | 'noar' | 'demorando'
export interface RegistroDominio { tipo: 'A' | 'CNAME'; nome: string; valor: string }

export interface ConferidoDominio { dominio: string; situacao: 'livre' | 'registrado' | 'incerto'; temEmail: boolean; registrador: string | null }

export interface EstadoDominio {
  fase: FaseDominio
  dominio: string | null
  /** servidores = troca os servidores DNS no Registro.br; registros = domínio com e-mail, só acrescenta as linhas. */
  modo: 'servidores' | 'registros' | null
  servidores: string[]
  registros: RegistroDominio[]
  passos: { id: IdPassoDominio; estado: 'falta' | 'agora' | 'feito' | 'demorando' }[]
  endereco: string | null
}

export interface PonteDominio {
  indisponivel?: boolean
  conferir(pasta: string, dominio: string): Promise<ConferidoDominio>
  ligar(pasta: string, dominio: string): Promise<EstadoDominio>
  estado(pasta: string): Promise<EstadoDominio>
  conferirAgora(pasta: string): Promise<EstadoDominio>
}

export const PASSOS_DOMINIO: { id: IdPassoDominio; titulo: string; sub: string }[] = [
  { id: 'ligado', titulo: 'Domínio ligado à sua Vercel', sub: 'Feito pelo Atlas.' },
  { id: 'troca', titulo: 'A troca no Registro.br', sub: 'Você cola e salva. O Atlas vê a mudança chegar.' },
  { id: 'internet', titulo: 'Esperando a internet atualizar', sub: 'Costuma levar de 10 minutos a 2 horas.' },
  { id: 'cadeado', titulo: 'Cadeado (https), QR e WhatsApp com o endereço novo', sub: 'O Atlas liga e atualiza sozinho.' },
]

const SLDS = 'com|net|org|app|art|blog|dev|eco|emp|eng|adv|arq|tec|log|med|ind|inf|srv|tur|vet|wiki|seg|rec|esp|ong|psi|mus|odo|fot|imb|nom|agr|esc|edu|gov'
const DOMINIO = new RegExp(`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.(${SLDS})\\.br$`)

/** Espelha dominio.cjs. Aceita o que o cliente cola (https://, www., maiúsculas, barra no fim) e devolve o domínio limpo, ou null. */
export function limparDominio(bruto: string): string | null {
  const d = bruto.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
  return d.length <= 80 && DOMINIO.test(d) ? d : null
}

export function explicarErroDominio(motivo: string): string {
  if (motivo === 'obra-fora-do-ar') return 'Primeiro o sistema precisa estar no ar no endereço grátis. Depois o domínio entra no lugar.'
  if (motivo === 'vercel-dominio') return 'A Vercel não aceitou ligar este domínio. Às vezes ele já está ligado em outra conta da Vercel.'
  if (motivo === 'vercel-dns') return 'A Vercel ligou o domínio, mas não devolveu o que colar no Registro.br. Dá para tentar de novo em instantes.'
  if (motivo === 'dominio-invalido') return 'Esse domínio não parece do Registro.br. Escreva assim: suaempresa.com.br'
  return 'Algo não saiu como esperado. Dá para tentar de novo.'
}

const vazio = (): EstadoDominio => ({ fase: 'nenhum', dominio: null, modo: null, servidores: [], registros: [], passos: PASSOS_DOMINIO.map((p) => ({ id: p.id, estado: 'falta' })), endereco: null })

/** Simulação: "livre" no nome tem cara de livre; "email" no nome tem e-mail; a troca chega depois de alguns intervalos. */
export function criarDominioFixture({ passoMs = 1500 }: { passoMs?: number } = {}): PonteDominio {
  const estados = new Map<string, EstadoDominio>()
  const andar = async (pasta: string) => {
    for (const [i, fase] of [[1, 'esperando'], [2, 'esperando'], [3, 'cadeado'], [4, 'noar']] as const) {
      await new Promise((r) => setTimeout(r, passoMs))
      const e = estados.get(pasta)
      if (!e) return
      e.fase = fase
      e.passos = PASSOS_DOMINIO.map((p, j) => ({ id: p.id, estado: j < i ? 'feito' : j === i ? 'agora' : 'falta' }))
      if (fase === 'noar') { e.passos = e.passos.map((p) => ({ ...p, estado: 'feito' })); e.endereco = `https://${e.dominio}` }
    }
  }
  return {
    async conferir(_pasta, dominio) {
      return { dominio, situacao: dominio.includes('livre') ? 'livre' : 'registrado', temEmail: dominio.includes('email'), registrador: dominio.includes('livre') ? null : 'Registro.br' }
    },
    async ligar(pasta, dominio) {
      const email = dominio.includes('email')
      const e: EstadoDominio = {
        ...vazio(), fase: 'esperando', dominio, modo: email ? 'registros' : 'servidores',
        servidores: email ? [] : ['ns1.vercel-dns.com', 'ns2.vercel-dns.com'],
        registros: email ? [{ tipo: 'A', nome: '@', valor: '76.76.21.21' }, { tipo: 'CNAME', nome: 'www', valor: 'cname.vercel-dns.com' }] : [],
        passos: PASSOS_DOMINIO.map((p, j) => ({ id: p.id, estado: j === 0 ? 'feito' : j === 1 ? 'agora' : 'falta' })),
      }
      estados.set(pasta, e)
      void andar(pasta)
      return structuredClone(e)
    },
    async estado(pasta) { return structuredClone(estados.get(pasta) ?? vazio()) },
    async conferirAgora(pasta) { return structuredClone(estados.get(pasta) ?? vazio()) },
  }
}

/** Sem adaptador: não finge que ligou. */
export const dominioIndisponivel: PonteDominio = {
  indisponivel: true,
  async conferir(_p, dominio) { return { dominio, situacao: 'incerto', temEmail: false, registrador: null } },
  async ligar() { throw new Error('indisponivel') },
  async estado() { return vazio() },
  async conferirAgora() { return vazio() },
}
