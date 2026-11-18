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
import { Prototipo } from './Prototipo'
import { Batismo } from './Batismo'
import { Aprovar } from './Aprovar'
import { Painel } from './Painel'
import { Publicar } from './Publicar'
import { slugDaObra } from './ponte-publicar'
import type { Selecao } from './publicar-dados'
import { Retomar } from './Retomar'
import { criarRetomarFixture, retomarIndisponivel, religarLinha, type ObraParada, type PonteRetomar } from './ponte-retomar'
import { criarPainelFixture, painelIndisponivel, type PontePainel } from './ponte-painel'
import { criarOcorrenciasFixture, ocorrenciasIndisponivel, type PonteOcorrencias } from './ponte-ocorrencia'
import { cotaIndisponivel, criarCotaFixture, type PonteCota } from './ponte-cota'
import { construcaoIndisponivel, criarConstrucaoFixture, criarModoObraFixture, modoObraIndisponivel, type PonteConstrucao, type PonteModoObra } from './ponte-construcao'
import { batismoIndisponivel, criarBatismoFixture, criarNomesFixture, nomesIndisponivel, type PonteBatismo, type PonteNomes } from './ponte-batismo'
import type { EstiloProposto } from './ponte-estilo'
import { criarPrototipoFixture, prototipoIndisponivel, type PontePrototipo } from './ponte-prototipo'
import { criarEstiloFixture, estiloIndisponivel, type PonteEstilo } from './ponte-estilo'
import { criarImportarFixture, importarIndisponivel, type PonteImportar } from './ponte-importar'
import { arquivosIndisponivel, criarArquivosFixture, type PonteArquivos } from './ponte-arquivos'
import { criarObrasFixture, obrasIndisponivel, type PonteObras } from './ponte-obras'
import { celularIndisponivel, criarCelularFixture, type PonteCelular } from './ponte-celular'
import { contasIndisponivel, criarContasFixture, type PonteContas } from './ponte-contas'
import { claudeIndisponivel, criarClaudeFixture, type PonteClaude } from './ponte-claude'
import { criarAtivacaoApi, criarAtivacaoFixture, lerAtivacao, modoFixture, type AtivacaoApi } from './ativacao-api'
import { criarPonteFixture, ponteDoAmbiente, type PonteDesktop } from './ponte'
import { flag, telaInicial, TELA_ATIVACAO, TELA_CELULAR, TELA_CLAUDE, TELA_CONTAS, TELA_RETOMAR } from './tela'
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
          <p>Você parou no passo {pedido.passo} de {pedido.totalPassos} {pedido.origem === 'F13b' ? 'do guia' : 'da conta'} do {pedido.conta}. Estou olhando o print do site: {pedido.print.titulo} ({pedido.print.url}).</p>
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

export function AppDesktop({ ponte = ponteInicial(), api, claude, contas, celular, obras, arquivos, estilo, importar, prototipo, batismo, nomes, construcao, modos, painel, cota, ocorrencias, retomar }: { ponte?: PonteDesktop; api?: AtivacaoApi; claude?: PonteClaude; contas?: PonteContas; celular?: PonteCelular; obras?: PonteObras; arquivos?: PonteArquivos; estilo?: PonteEstilo; importar?: PonteImportar; prototipo?: PontePrototipo; batismo?: PonteBatismo; nomes?: PonteNomes; construcao?: PonteConstrucao; modos?: PonteModoObra; painel?: PontePainel; cota?: PonteCota; ocorrencias?: PonteOcorrencias; retomar?: PonteRetomar }) {
  const [tela, setTela] = useState<string | null>(null)
  const [ativo, setAtivo] = useState<IdTela>('obras')
  const [instalando, setInstalando] = useState(false)
  const [pedidoAjuda, setPedidoAjuda] = useState<PedidoAjudaPasso | null>(null)
  const [computador, setComputador] = useState('')
  const [dono, setDono] = useState('')
  const [paradaF12, setParadaF12] = useState<ObraParada | null>(null)
  // Dentro de Minhas obras: lista (F05), nova obra (F06) ou trazer protótipo (F06c, do M15).
  const [fluxo, setFluxo] = useState<'lista' | 'nova' | 'trazer' | 'estilo' | 'telas' | 'batismo' | 'aprovar' | 'publicar' | 'publicando'>('lista')
  const [ideia, setIdeia] = useState('')
  const [obraAtual, setObraAtual] = useState<ObraDoEstilo | null>(null)
  const [selecaoPub, setSelecaoPub] = useState<Selecao>({})
  const [estiloEscolhido, setEstiloEscolhido] = useState<EstiloProposto | null>(null)
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

  // Idem para o Claude que propõe os 3 estilos e escreve o design-system.md: sem adaptador real, não finge.
  const ponteEstilo = useMemo<PonteEstilo>(() => estilo ?? (modoFixture() ? criarEstiloFixture(ponteObras.raiz()) : estiloIndisponivel), [estilo, ponteObras])

  // Idem para o .zip que vem de outra IA (não confiável): sem adaptador real, não finge que recebeu nem abre nada.
  const ponteImportar = useMemo<PonteImportar>(() => importar ?? (modoFixture() ? criarImportarFixture(ponteObras.raiz()) : importarIndisponivel), [importar, ponteObras])

  // Idem para o Claude que desenha e ajusta as telas (HTML não confiável: só em iframe sandbox): sem adaptador real, não finge.
  const pontePrototipo = useMemo<PontePrototipo>(() => prototipo ?? (modoFixture() ? criarPrototipoFixture(ponteObras.raiz()) : prototipoIndisponivel), [prototipo, ponteObras])

  // Idem para o Claude que sugere os nomes e grava a marca na pasta da obra: sem adaptador real, não finge.
  const ponteBatismo = useMemo<PonteBatismo>(() => batismo ?? (modoFixture() ? criarBatismoFixture(ponteObras.raiz()) : batismoIndisponivel), [batismo, ponteObras])
  // Idem para conferir nomes parecidos e endereço livre (consulta pública): sem adaptador real, não finge que conferiu.
  // Idem para o plano da obra e o modo (automático ou passo a passo): o mesmo armazém de preferências é o que o painel da obra (M19) lê.
  const pontesModo = useMemo(() => {
    const m = modos ?? (modoFixture() ? criarModoObraFixture() : modoObraIndisponivel)
    return { modos: m, construcao: construcao ?? (modoFixture() ? criarConstrucaoFixture(m, ponteObras.raiz()) : construcaoIndisponivel) }
  }, [modos, construcao, ponteObras])

  // Idem para o painel da obra (PLAN.md, prazo, canteiro 3D): sem adaptador real, não finge andamento.
  // Cota do plano (F10) e ocorrências (F11) andam junto do painel: no fixture, esgotar a cota ou abrir uma ocorrência liga e desliga
  // a parada correspondente do mesmo painel. Sem adaptador real, nada é fingido.
  const pontesObra = useMemo(() => {
    if (painel || !modoFixture()) {
      const fixture = modoFixture()
      return { painel: painel ?? painelIndisponivel, cota: cota ?? (fixture ? criarCotaFixture() : cotaIndisponivel), ocorrencias: ocorrencias ?? (fixture ? criarOcorrenciasFixture() : ocorrenciasIndisponivel) }
    }
    const fx = criarPainelFixture()
    return {
      painel: fx as PontePainel,
      cota: cota ?? criarCotaFixture((esgotada) => fx.simular.pararPor(esgotada ? 'cota' : null)),
      ocorrencias: ocorrencias ?? criarOcorrenciasFixture((precisa) => fx.simular.pararPor(precisa ? 'voce' : null)),
    }
  }, [painel, cota, ocorrencias])
  const pontePainel = pontesObra.painel
  const ponteCota = pontesObra.cota
  const ponteOcorrencias = pontesObra.ocorrencias

  // Retomar (F12): detecta a obra em andamento e religa a linha por PontePainel/PonteCota. No fixture, sem obra informada, não há nada em andamento.
  const ponteRetomar = useMemo<PonteRetomar>(() => {
    if (retomar) return retomar
    if (!modoFixture()) return retomarIndisponivel
    const base = criarRetomarFixture(null)
    return { obraEmAndamento: base.obraEmAndamento, continuar: (o) => religarLinha({ painel: pontePainel, cota: ponteCota }, o.pasta) }
  }, [retomar, pontePainel, ponteCota])

  const ponteNomes = useMemo<PonteNomes>(() => nomes ?? (modoFixture() ? criarNomesFixture() : nomesIndisponivel), [nomes])

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
      // Ativado: confere se há obra em andamento (ligou o computador no meio da obra => Retomar, F12). Falha ao conferir => Minhas obras.
      let parada: ObraParada | null = null
      if (ativ !== null) parada = await ponteRetomar.obraEmAndamento().catch(() => null)
      if (!vivo) return
      const inicial = telaInicial(ponte.argv, ativ !== null, parada !== null)
      // Pedir Retomar (--tela=F12) sem obra em andamento não tem o que mostrar: cai em Minhas obras.
      setParadaF12(parada)
      setTela(inicial === TELA_RETOMAR && parada === null ? 'F05' : inicial)
    })()
    return () => { vivo = false }
  }, [ponte, ponteRetomar])

  if (tela === null) return null
  if (tela === TELA_ATIVACAO) {
    return <Ativacao api={ativacao} computador={computador} onInstalando={setInstalando} onContinuar={() => setTela(TELA_CLAUDE)} />
  }
  if (tela === TELA_CLAUDE) return <Claude claude={ponteClaude} onContinuar={() => setTela(TELA_CONTAS)} onPedirAjuda={() => { setAtivo('ajuda'); setTela('F05') }} />
  if (tela === TELA_CONTAS) return <Contas contas={ponteContas} onContinuar={() => setTela(TELA_CELULAR)} onPedirAjuda={(p) => { setPedidoAjuda(p); setAtivo('ajuda'); setTela('F05') }} />
  if (tela === TELA_CELULAR) return <Celular celular={ponteCelular} onVoltar={() => setTela(TELA_CONTAS)} onConcluir={() => setTela('F05')} />
  if (tela === TELA_RETOMAR && paradaF12) {
    return (
      <Retomar
        obra={paradaF12}
        nome={dono || undefined}
        retomar={ponteRetomar}
        onContinuou={(o) => { setObraAtual({ nome: o.nome, pasta: o.pasta }); setFluxo('lista'); setAtivo('obra'); setTela('F05') }}
        onAgoraNao={() => setTela('F05')}
      />
    )
  }
  // Demais telas (F05+ vêm nos próximos milestones): por ora cai em Obras.
  let conteudo: ReactNode
  if (ativo === 'obras' && fluxo === 'trazer') conteudo = <TrazerPrototipo obras={ponteObras} importar={ponteImportar} onVoltar={() => setFluxo('lista')} onConcluir={() => setFluxo('lista')} />
  else if (ativo === 'obras' && fluxo === 'estilo' && obraAtual) conteudo = <Estilo obra={obraAtual} arquivos={ponteArquivos} estilo={ponteEstilo} onVoltar={() => setFluxo('lista')} onConcluir={(r) => { setEstiloEscolhido(r.estilo); setFluxo('telas') }} />
  else if (ativo === 'obras' && fluxo === 'telas' && obraAtual) conteudo = <Prototipo obra={obraAtual} estilo={estiloEscolhido} prototipo={pontePrototipo} arquivos={ponteArquivos} onVoltar={() => setFluxo('lista')} onConcluir={() => setFluxo('batismo')} />
  else if (ativo === 'obras' && fluxo === 'batismo' && obraAtual) conteudo = <Batismo obra={obraAtual} batismo={ponteBatismo} nomes={ponteNomes} arquivos={ponteArquivos} onVoltar={() => setFluxo('telas')} onConcluir={() => setFluxo('aprovar')} />
  else if (ativo === 'obra' && obraAtual && fluxo === 'publicar') conteudo = <Publicar slug={slugDaObra(obraAtual.nome)} onPublicar={(sel) => { setSelecaoPub(sel); setFluxo('publicando') }} onVoltar={() => setFluxo('lista')} />
  else if (ativo === 'obra' && obraAtual && fluxo === 'publicando') conteudo = (
    <>
      <p className="rotulo">Publicando</p>
      <h1>{Object.keys(selecaoPub).length} opção(ões) escolhida(s)</h1>
      <button type="button" className="at-pn__link" onClick={() => setFluxo('publicar')}>Voltar</button>
    </>
  )
  else if (ativo === 'obra' && obraAtual) conteudo = <Painel obra={obraAtual} painel={pontePainel} modos={pontesModo.modos} cota={ponteCota} ocorrencias={ponteOcorrencias} onPedirAjuda={() => setAtivo('ajuda')} onVerMax={() => { void ponteClaude.abrirSite('planos') }} onPublicar={() => setFluxo('publicar')} />
  else if (ativo === 'obras' && fluxo === 'aprovar' && obraAtual) conteudo = <Aprovar obra={obraAtual} construcao={pontesModo.construcao} claude={ponteClaude} modos={pontesModo.modos} onVoltar={() => setFluxo('batismo')} onComecou={() => { setFluxo('lista'); setAtivo('obra') }} />
  else if (ativo === 'obras' && fluxo === 'nova') conteudo = <NovaObra obras={ponteObras} ideia={ideia} onVoltar={() => setFluxo('lista')} onConcluir={() => setFluxo('lista')} onEstilo={(o: ObraNova) => { setObraAtual({ nome: o.respostas.nome, pasta: o.pasta.pasta }); setFluxo('estilo') }} />
  else if (ativo === 'obras') conteudo = <ListaObras obras={ponteObras} nome={dono || undefined} onComecar={(i) => { setIdeia(i ?? ''); setFluxo('nova') }} onTrazer={() => setFluxo('trazer')} />
  return <Obras ativo={ativo} onNavegar={setAtivo} pedido={pedidoAjuda}>{conteudo}</Obras>
}
