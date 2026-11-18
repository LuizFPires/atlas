import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Shell, type IdTela } from '../shell/Shell'
import { ImagemAssinatura } from '../marca/Marca'
import { Ativacao } from './Ativacao'
import { Claude } from './Claude'
import type { PedidoAjudaPasso } from './ajuda-passo'
import { Celular } from './Celular'
import { Contas } from './Contas'
import { Obras as ListaObras } from './Obras'
import { NovaObra, type ObraNova } from './NovaObra'
import { Estilo, type ObraDoEstilo } from './Estilo'
import { TrazerPrototipo } from './Trazer'
import { arquivosIndisponivel, criarArquivosFixture, type PonteArquivos } from './ponte-arquivos'
import { criarObrasFixture, obrasIndisponivel, type PonteObras } from './ponte-obras'
import { celularIndisponivel, criarCelularFixture, type PonteCelular } from './ponte-celular'
import { contasIndisponivel, criarContasFixture, type PonteContas } from './ponte-contas'
import { claudeIndisponivel, criarClaudeFixture, type PonteClaude } from './ponte-claude'
import { criarAtivacaoApi, criarAtivacaoFixture, lerAtivacao, modoFixture, type AtivacaoApi } from './ativacao-api'
import { criarPonteFixture, ponteDoAmbiente, type PonteDesktop } from './ponte'
import { flag, telaInicial, TELA_ATIVACAO, TELA_CELULAR, TELA_CLAUDE, TELA_CONTAS } from './tela'
import { useImpedirSono } from './sono'

/** Estamos dentro do app desktop (Electron) ou no modo fixture de desenvolvimento (?app=1)? */
export const noAppDesktop = () => ponteDoAmbiente() !== null

function Obras({ ativo, onNavegar, pedido, children }: { ativo: IdTela; onNavegar: (t: IdTela) => void; pedido?: PedidoAjudaPasso | null; children?: ReactNode }) {
  return (
    <Shell ativo={ativo} onNavegar={onNavegar} onFalar={() => {}}>
      {ativo === 'ajuda' && pedido ? (
        <>
          <p className="rotulo">Ajuda do Atlas</p>
          <h1>Vamos resolver juntos</h1>
          <p>Você parou no passo {pedido.passo} de {pedido.totalPassos} da conta do {pedido.conta}. Estou olhando o print do site: {pedido.print.titulo} ({pedido.print.url}).</p>
        </>
      ) : (
        children ?? (
          <>
            <p className="rotulo">Minhas obras</p>
            <h1>Bem-vindo ao Atlas</h1>
            <ImagemAssinatura />
          </>
        )
      )}
    </Shell>
  )
}

/** App desktop: decide a tela inicial (--tela= manda; senão F05 se já ativado, F02 se não) e mantém o computador acordado na obra. */
let ponteFixture: PonteDesktop | null = null
const ponteInicial = () => ponteDoAmbiente() ?? (ponteFixture ??= criarPonteFixture())

export function AppDesktop({ ponte = ponteInicial(), api, claude, contas, celular, obras, arquivos }: { ponte?: PonteDesktop; api?: AtivacaoApi; claude?: PonteClaude; contas?: PonteContas; celular?: PonteCelular; obras?: PonteObras; arquivos?: PonteArquivos }) {
  const [tela, setTela] = useState<string | null>(null)
  const [ativo, setAtivo] = useState<IdTela>('obras')
  const [instalando, setInstalando] = useState(false)
  const [pedidoAjuda, setPedidoAjuda] = useState<PedidoAjudaPasso | null>(null)
  const [computador, setComputador] = useState('')
  const [dono, setDono] = useState('')
  // Dentro de Minhas obras: lista (F05), nova obra (F06) ou trazer protótipo (F06c, do M15).
  const [fluxo, setFluxo] = useState<'lista' | 'nova' | 'trazer' | 'estilo'>('lista')
  const [ideia, setIdeia] = useState('')
  const [obraAtual, setObraAtual] = useState<ObraDoEstilo | null>(null)
  useImpedirSono(ponte, instalando)

  // Sem adaptador real e fora do modo fixture, o app não finge conexão (adaptador real: pendência de /entregar).
  const ponteClaude = useMemo<PonteClaude>(() => claude ?? (modoFixture() ? criarClaudeFixture({ conectado: false }, { loginAutomatico: true }) : claudeIndisponivel), [claude])

  // Idem para as contas do cliente (GitHub, Supabase, Vercel): sem adaptador real, não finge que ficaram prontas.
  const ponteContas = useMemo<PonteContas>(() => contas ?? (modoFixture() ? criarContasFixture() : contasIndisponivel), [contas])

  // Idem para o celular (Remote Control): sem adaptador real, não finge que o celular está ligado.
  const ponteCelular = useMemo<PonteCelular>(() => celular ?? (modoFixture() ? criarCelularFixture() : celularIndisponivel), [celular])

  // Idem para a pasta das obras (Atlas\Obras): sem adaptador real, não finge que criou a pasta.
  const ponteObras = useMemo<PonteObras>(() => obras ?? (modoFixture() ? criarObrasFixture(dono || 'Zé') : obrasIndisponivel), [obras, dono])

  // Idem para os arquivos que o cliente sobe para a obra (print, logo, manual): sem adaptador real, não finge que subiu.
  const ponteArquivos = useMemo<PonteArquivos>(() => arquivos ?? (modoFixture() ? criarArquivosFixture(ponteObras.raiz()) : arquivosIndisponivel), [arquivos, ponteObras])

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
      const [ativ, desc] = await Promise.all([lerAtivacao(ponte.cofre), ponte.descricaoComputador()])
      if (!vivo) return
      setComputador(desc)
      setDono(ativ?.nome ?? '')
      setTela(telaInicial(ponte.argv, ativ !== null))
    })()
    return () => { vivo = false }
  }, [ponte])

  if (tela === null) return null
  if (tela === TELA_ATIVACAO) {
    return <Ativacao api={ativacao} computador={computador} onInstalando={setInstalando} onContinuar={() => setTela(TELA_CLAUDE)} />
  }
  if (tela === TELA_CLAUDE) return <Claude claude={ponteClaude} onContinuar={() => setTela(TELA_CONTAS)} onPedirAjuda={() => { setAtivo('ajuda'); setTela('F05') }} />
  if (tela === TELA_CONTAS) return <Contas contas={ponteContas} onContinuar={() => setTela(TELA_CELULAR)} onPedirAjuda={(p) => { setPedidoAjuda(p); setAtivo('ajuda'); setTela('F05') }} />
  if (tela === TELA_CELULAR) return <Celular celular={ponteCelular} onVoltar={() => setTela(TELA_CONTAS)} onConcluir={() => setTela('F05')} />
  // Demais telas (F05+ vêm nos próximos milestones): por ora cai em Obras.
  let conteudo: ReactNode
  if (ativo === 'obras' && fluxo === 'trazer') conteudo = <TrazerPrototipo onVoltar={() => setFluxo('lista')} />
  else if (ativo === 'obras' && fluxo === 'estilo' && obraAtual) conteudo = <Estilo obra={obraAtual} arquivos={ponteArquivos} onVoltar={() => setFluxo('lista')} />
  else if (ativo === 'obras' && fluxo === 'nova') conteudo = <NovaObra obras={ponteObras} ideia={ideia} onVoltar={() => setFluxo('lista')} onConcluir={() => setFluxo('lista')} onEstilo={(o: ObraNova) => { setObraAtual({ nome: o.respostas.nome, pasta: o.pasta.pasta }); setFluxo('estilo') }} />
  else if (ativo === 'obras') conteudo = <ListaObras obras={ponteObras} nome={dono || undefined} onComecar={(i) => { setIdeia(i ?? ''); setFluxo('nova') }} onTrazer={() => setFluxo('trazer')} />
  return <Obras ativo={ativo} onNavegar={setAtivo} pedido={pedidoAjuda}>{conteudo}</Obras>
}
