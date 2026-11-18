import { useEffect, useMemo, useState } from 'react'
import { Shell, type IdTela } from '../shell/Shell'
import { ImagemAssinatura } from '../marca/Marca'
import { Ativacao } from './Ativacao'
import { Claude } from './Claude'
import { claudeIndisponivel, criarClaudeFixture, type PonteClaude } from './ponte-claude'
import { criarAtivacaoApi, criarAtivacaoFixture, jaAtivado, modoFixture, type AtivacaoApi } from './ativacao-api'
import { criarPonteFixture, ponteDoAmbiente, type PonteDesktop } from './ponte'
import { flag, telaInicial, TELA_ATIVACAO, TELA_CLAUDE } from './tela'
import { useImpedirSono } from './sono'

/** Estamos dentro do app desktop (Electron) ou no modo fixture de desenvolvimento (?app=1)? */
export const noAppDesktop = () => ponteDoAmbiente() !== null

function Obras({ ativo, onNavegar }: { ativo: IdTela; onNavegar: (t: IdTela) => void }) {
  return (
    <Shell ativo={ativo} onNavegar={onNavegar} onFalar={() => {}}>
      <p className="rotulo">Minhas obras</p>
      <h1>Bem-vindo ao Atlas</h1>
      <ImagemAssinatura />
    </Shell>
  )
}

/** App desktop: decide a tela inicial (--tela= manda; senão F05 se já ativado, F02 se não) e mantém o computador acordado na obra. */
let ponteFixture: PonteDesktop | null = null
const ponteInicial = () => ponteDoAmbiente() ?? (ponteFixture ??= criarPonteFixture())

export function AppDesktop({ ponte = ponteInicial(), api, claude }: { ponte?: PonteDesktop; api?: AtivacaoApi; claude?: PonteClaude }) {
  const [tela, setTela] = useState<string | null>(null)
  const [ativo, setAtivo] = useState<IdTela>('obras')
  const [instalando, setInstalando] = useState(false)
  const [computador, setComputador] = useState('')
  useImpedirSono(ponte, instalando)

  // Sem adaptador real e fora do modo fixture, o app não finge conexão (adaptador real: pendência de /entregar).
  const ponteClaude = useMemo<PonteClaude>(() => claude ?? (modoFixture() ? criarClaudeFixture({ conectado: false }, { loginAutomatico: true }) : claudeIndisponivel), [claude])

  const ativacao = useMemo<AtivacaoApi>(
    () => {
      if (api) return api
      if (modoFixture()) return criarAtivacaoFixture(ponte)
      const url = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/[/]+$/, '')
      return criarAtivacaoApi(ponte, url ? { api: url, linkToken: flag(ponte.argv, 'token') } : null)
    },
    [api, ponte],
  )

  useEffect(() => {
    let vivo = true
    void (async () => {
      const [ok, desc] = await Promise.all([jaAtivado(ponte.cofre), ponte.descricaoComputador()])
      if (!vivo) return
      setComputador(desc)
      setTela(telaInicial(ponte.argv, ok))
    })()
    return () => { vivo = false }
  }, [ponte])

  if (tela === null) return null
  if (tela === TELA_ATIVACAO) {
    return <Ativacao api={ativacao} computador={computador} onInstalando={setInstalando} onContinuar={() => setTela(TELA_CLAUDE)} />
  }
  if (tela === TELA_CLAUDE) return <Claude claude={ponteClaude} onContinuar={() => setTela('F04')} onPedirAjuda={() => { setAtivo('ajuda'); setTela('F05') }} />
  // Demais telas (F04+ vêm nos próximos milestones): por ora cai em Obras.
  return <Obras ativo={ativo} onNavegar={setAtivo} />
}
