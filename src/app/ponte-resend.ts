// Resend, o carteiro (28/11/2026): a 4ª conta, opcional, para o sistema mandar e-mail para qualquer pessoa.
import type { Retangulo } from './ponte-navegador'

export interface RegistroDns { tipo: string; nome: string; valor: string; prioridade?: number; estado: 'ok' | 'esperando' | 'falhou' }
export interface SituacaoResend {
  ligado: boolean
  dominio: string | null
  estado: 'sem-dominio' | 'esperando' | 'verificado' | 'falhou'
  registros: RegistroDns[]
  remetente: string | null
}
export type ResultadoChaveResend = { ok: true } | { ok: false; motivo: 'formato' | 'recusada' | 'sem-permissao' | 'sem-internet' }

export interface PonteResend {
  situacao(): Promise<SituacaoResend>
  guardarChave(chave: string): Promise<ResultadoChaveResend>
  escolherDominio(dominio: string): Promise<SituacaoResend>
  conferir(): Promise<SituacaoResend>
  abrirChaves?(onde: Retangulo): Promise<void>
}

const REGISTROS: RegistroDns[] = [
  { tipo: 'TXT', nome: 'resend._domainkey', valor: 'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC', estado: 'esperando' },
  { tipo: 'MX', nome: 'send', valor: 'feedback-smtp.sa-east-1.amazonses.com', prioridade: 10, estado: 'ok' },
  { tipo: 'TXT', nome: 'send', valor: 'v=spf1 include:amazonses.com ~all', estado: 'ok' },
]

export function criarResendFixture({ ligado = false, dominio = null as string | null, verificaNa = 2 } = {}): PonteResend {
  let s: SituacaoResend = { ligado, dominio, estado: dominio ? 'esperando' : 'sem-dominio', registros: dominio ? REGISTROS : [], remetente: dominio ? `nao-responda@${dominio}` : null }
  let conferencias = 0
  return {
    async situacao() { return { ...s } },
    async guardarChave(chave) {
      if (!/^re_[A-Za-z0-9_]{16,120}$/.test(chave.trim())) return { ok: false, motivo: 'formato' }
      s = { ...s, ligado: true }
      return { ok: true }
    },
    async escolherDominio(d) {
      const dom = d.trim().toLowerCase()
      if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(dom) || dom.endsWith('.vercel.app')) throw new Error('dominio-invalido')
      s = { ...s, dominio: dom, estado: 'esperando', registros: REGISTROS, remetente: `nao-responda@${dom}` }
      return { ...s }
    },
    async conferir() {
      conferencias++
      if (s.dominio && conferencias >= verificaNa) s = { ...s, estado: 'verificado', registros: s.registros.map((r) => ({ ...r, estado: 'ok' })) }
      return { ...s }
    },
  }
}
