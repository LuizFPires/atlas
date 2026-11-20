// M32 (c) — GUARDIÃO: lib que o app ENTREGUE inclui. Na carga pergunta ao servidor se esta instância é do comprador
// (POST {api}/instancia/validar; servidor: supabase/functions/_shared/instancia.ts). É trava de licença, não telemetria:
// só vai o que o servidor já conhece (e-mail da compra, hash do computador, token do dispositivo no cabeçalho).
// A licença é descoberta pelo servidor; nunca mandamos id de licença. Só rede fora e 5xx entram em carência offline
// (libera temporariamente); 429, qualquer 4xx e ok:false bloqueiam.
// Pendência: ligar dentro do app-modelo (fatia d) — ver app/PENDENTE-ENTREGAR.md.
import { configCompra } from '../web/compra'
import { lerAtivacao, modoFixture } from './ativacao-api'
import type { PonteDesktop } from './ponte'

export type VeredictoGuardiao = { estado: 'liberado' } | { estado: 'bloqueado'; mensagem: string }

export interface PortaGuardiao {
  conferir(): Promise<VeredictoGuardiao>
}

export const MSG_OUTRA_INSTANCIA = 'Este app é de uma empresa só. Parece que ele está sendo usado em outro lugar com a mesma licença. Para usar aqui, peça ajuda à Ajuda do Atlas.'
export const MSG_LICENCA = 'Não conseguimos confirmar a licença deste app. Confira se a sua assinatura está em dia e se este é o computador que você ativou.'

/** Rede fora/5xx: libera por ora. Fatia (d): carência com prazo (3 a 7 dias desde a última confirmação ok), depois bloqueia. */
const CARENCIA_OFFLINE: VeredictoGuardiao = { estado: 'liberado' }

export function criarGuardiaoReal(
  ponte: Pick<PonteDesktop, 'cofre' | 'hashComputador'>,
  cfg: { api: string } | null = configCompra(),
  f: typeof fetch = fetch,
): PortaGuardiao {
  return {
    async conferir() {
      if (!cfg) return { estado: 'bloqueado', mensagem: MSG_LICENCA }
      const g = await lerAtivacao(ponte.cofre)
      if (!g || !g.email) return { estado: 'bloqueado', mensagem: MSG_LICENCA }
      try {
        const r = await f(`${cfg.api}/instancia/validar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Atlas-Dispositivo': g.token },
          body: JSON.stringify({ email: g.email, computador_hash: await ponte.hashComputador() }),
        })
        if (r.status === 403 || r.status === 401) return { estado: 'bloqueado', mensagem: MSG_LICENCA }
        // Só 5xx (servidor com problema) cai na carência offline. 429 e qualquer 4xx BLOQUEIAM: senão bastaria
        // bloquear/estrangular o endpoint para liberar o app.
        if (r.status >= 500) return CARENCIA_OFFLINE
        if (!r.ok) return { estado: 'bloqueado', mensagem: MSG_LICENCA }
        const d = (await r.json().catch(() => ({}))) as { ok?: boolean; motivo?: string }
        if (d.ok === true) return { estado: 'liberado' }
        return { estado: 'bloqueado', mensagem: d.motivo === 'outra_instancia' ? MSG_OUTRA_INSTANCIA : MSG_LICENCA }
      } catch { return CARENCIA_OFFLINE } // sem conexão: carência offline
    },
  }
}

export function criarGuardiaoFixture(veredito: 'liberado' | 'outra_instancia' | 'licenca_invalida' = 'liberado'): PortaGuardiao {
  return {
    async conferir() {
      if (veredito === 'liberado') return { estado: 'liberado' }
      return { estado: 'bloqueado', mensagem: veredito === 'outra_instancia' ? MSG_OUTRA_INSTANCIA : MSG_LICENCA }
    },
  }
}

/** Produção usa o real; fixture só em desenvolvimento ou VITE_FIXTURE=1. */
export function guardiaoPadrao(ponte: Pick<PonteDesktop, 'cofre' | 'hashComputador'>): PortaGuardiao {
  return modoFixture() ? criarGuardiaoFixture() : criarGuardiaoReal(ponte)
}
