import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { StatusVoz } from '../ui'
import { Shell, type IdTela } from '../shell/Shell'
import { ImagemAssinatura } from '../marca/Marca'
import { Ativacao } from './Ativacao'
import { Claude } from './Claude'
import type { PedidoAjudaPasso } from './ajuda-passo'
import { Ajuda } from './Ajuda'
import { NovaVersao } from './NovaVersao'
import { ajudaIndisponivel, contextoDoPasso, criarAjudaFixture, type ContextoAjuda, type PonteAjuda } from './ponte-ajuda'
import { casosIndisponivel, criarCasosFixture, type PonteCasosAdmin } from './ponte-ajuda-casos'
import { Celular } from './Celular'
import { Contas } from './Contas'
import { Obras as ListaObras, type ObraParaContinuar } from './Obras'
import { Ideia } from './Ideia'
import { EtapasObra, type EtapaDoCaminho } from './EtapasObra'
import { criarIdeiaFixture, ideiaIndisponivel, type PonteIdeia } from './ponte-ideia'
import { Estilo, type ObraDoEstilo } from './Estilo'
import { TrazerPrototipo } from './Trazer'
import { Prototipo } from './Prototipo'
import { Batismo } from './Batismo'
import { Aprovar } from './Aprovar'
import { Painel } from './Painel'
import { Publicar } from './Publicar'
import { Publicando } from './Publicando'
import { Entrega, type ResumoEntrega } from './Entrega'
import { PosObra } from './PosObra'
import { criarLicencaApi, criarLicencaFixture, criarPosObraFixture, licencaIndisponivel, posObraIndisponivel, type PonteLicenca, type PontePosObra } from './ponte-posobra'
import { criarPublicarFixture, publicarIndisponivel, slugDaObra, type PontePublicar } from './ponte-publicar'
import type { Selecao } from './publicar-dados'
import { SemObra } from './SemObra'
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
import { ContextoPlano, usePlanoNoMenu } from './plano-no-menu'
import { ContextoConectarClaude } from './conectar-claude'
import { ContextoModelo, criarModeloFixture, useModeloNoMenu, type PonteModelo } from './ponte-modelo'
import { criarAtivacaoApi, criarAtivacaoFixture, lerAtivacao, modoFixture, type AtivacaoApi } from './ativacao-api'
import { fetchPelaPonte } from './ponte-servidor'
import { useTokenDoLink } from './link-instalacao'
import { lerResumo, type ResumoLicenca } from './licenca-resumo'
import { ContextoLicenca, useLicencaNoApp } from './licenca-no-app'
import { AcessoEncerrado } from './AcessoEncerrado'
import { criarExecutorRemoto, criarMemoriaRemotoLocal, ligarCelularRemoto } from './celular-remoto'
import { criarCanalRemotoApi } from './celular-canal'
import { ComprarAtlas, type PedidoCompraNoApp } from './ComprarAtlas'
import { configCompra, iniciarCompra, type ResultadoCompra } from '../web/compra'
import { criarPonteFixture, ponteDoAmbiente, type PonteDesktop } from './ponte'
import { telaInicial, TELA_ATIVACAO, TELA_CELULAR, TELA_CLAUDE, TELA_CONTAS, TELA_RETOMAR } from './tela'
import { useImpedirSono } from './sono'

/** Só em modo fixture (desenvolvimento): `?teste=3` mostra o contador com 3 dias, `?teste=0` mostra o teste vencido. Sem o parâmetro, nada. */
function resumoDeDemonstracao(): ResumoLicenca | null {
  const v = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('teste')
  if (v === null || !/^\d{1,2}$/.test(v)) return null
  const agora = new Date()
  const dias = Number(v)
  return { tipo: 'cortesia', origem: 'degustacao', validade_em: new Date(agora.getTime() + dias * 24 * 60 * 60_000).toISOString(), vencida: dias === 0, agora: agora.toISOString() }
}

/** Estamos dentro do app desktop (Electron) ou no modo fixture de desenvolvimento (?app=1)? */
export const noAppDesktop = () => ponteDoAmbiente() !== null

function Obras({ ativo, onNavegar, onFalar, children }: { ativo: IdTela; onNavegar: (t: IdTela) => void; onFalar?: () => void; children?: ReactNode }) {
  // Contador do teste grátis / cortesia e a compra de dentro do app (docs/prd-contador-degustacao.md).
  const licenca = useContext(ContextoLicenca)
  const plano = useContext(ContextoPlano)
  const modelo = useContext(ContextoModelo)
  const conectarClaude = useContext(ContextoConectarClaude)
  return (
    <Shell ativo={ativo} onNavegar={onNavegar} onFalar={onFalar ?? (() => {})} licenca={licenca?.cartao} plano={plano} modelo={modelo} onComprar={licenca?.comprar} onConectarClaude={conectarClaude ?? undefined} topo={<NovaVersao ponte={ponteDoAmbiente()?.atualizacao} />}>
      {children ?? (
        <>
          <p className="rotulo">Minhas obras</p>
          <h1>Bem-vindo ao Atlas</h1>
          <ImagemAssinatura />
        </>
      )}
    </Shell>
  )
}

/** App desktop: decide a tela inicial (--tela= manda; senão F05 se já ativado, F02 se não) e mantém o computador acordado na obra. */
let ponteFixture: PonteDesktop | null = null
const ponteInicial = () => ponteDoAmbiente() ?? (ponteFixture ??= criarPonteFixture())

export function AppDesktop({ ponte = ponteInicial(), api, claude, contas, celular, obras, arquivos, estilo, importar, prototipo, batismo, nomes, construcao, modos, painel, cota, ocorrencias, retomar, publicar, posobra, licenca, ajuda, casos, resumoLicenca, iniciarCompraNoApp }: { ponte?: PonteDesktop; api?: AtivacaoApi; /** Lê o tipo e a validade da licença (contador do teste). Padrão: servidor, pela ponte. */ resumoLicenca?: () => Promise<ResumoLicenca | null>; /** Abre o checkout da compra de dentro do app. Padrão: servidor, pela ponte. */ iniciarCompraNoApp?: (p: PedidoCompraNoApp) => Promise<ResultadoCompra>; claude?: PonteClaude; contas?: PonteContas; celular?: PonteCelular; obras?: PonteObras; arquivos?: PonteArquivos; estilo?: PonteEstilo; importar?: PonteImportar; prototipo?: PontePrototipo; batismo?: PonteBatismo; nomes?: PonteNomes; construcao?: PonteConstrucao; modos?: PonteModoObra; painel?: PontePainel; cota?: PonteCota; ocorrencias?: PonteOcorrencias; retomar?: PonteRetomar; publicar?: PontePublicar; posobra?: PontePosObra; licenca?: PonteLicenca; ajuda?: PonteAjuda; casos?: PonteCasosAdmin }) {
  const [tela, setTela] = useState<string | null>(null)
  const [ativo, setAtivo] = useState<IdTela>('obras')
  const [instalando, setInstalando] = useState(false)
  // A Ajuda do Atlas (F17) é um painel lateral por cima de qualquer tela; `n` renova a conversa a cada abertura.
  const [painelAjuda, setPainelAjuda] = useState<{ contexto: ContextoAjuda; n: number } | null>(null)
  const [computador, setComputador] = useState('')
  const [dono, setDono] = useState('')
  const [paradaF12, setParadaF12] = useState<ObraParada | null>(null)
  // Dentro de Minhas obras: lista (F05), nova obra (F06) ou trazer protótipo (F06c, do M15).
  const [fluxo, setFluxo] = useState<'lista' | 'ideia' | 'trazer' | 'estilo' | 'telas' | 'batismo' | 'contas' | 'aprovar' | 'publicar' | 'publicando' | 'entrega'>('lista')
  const [obraAtual, setObraAtual] = useState<ObraDoEstilo | null>(null)
  // A obra que acabou de nascer em "Nova obra": o Voltar do estilo volta para ela ("Obra começada!"), não para o início.
  // Caminho novo: o relato da obra criada agora (para o Voltar do estilo mostrar de novo a ideia). null = obra que veio de Minhas obras.
  const [relatoDaObra, setRelatoDaObra] = useState<string | null>(null)
  const [selecaoPub, setSelecaoPub] = useState<Selecao>({})
  const [enderecoNoAr, setEnderecoNoAr] = useState<string | null>(null)
  const [resumoEntrega, setResumoEntrega] = useState<ResumoEntrega | null>(null)
  const [estiloEscolhido, setEstiloEscolhido] = useState<EstiloProposto | null>(null)
  useImpedirSono(ponte, instalando)

  // Sem adaptador real e fora do modo fixture, o app não finge conexão (adaptador real: pendência de /entregar).
  const ponteClaude = useMemo<PonteClaude>(() => claude ?? (modoFixture() ? criarClaudeFixture({ conectado: false }, { loginAutomatico: true }) : (ponte.claude ?? claudeIndisponivel)), [claude, ponte])
  const planoNoMenu = usePlanoNoMenu(ponteClaude)
  const ponteModelo = useMemo<PonteModelo | undefined>(() => (modoFixture() ? criarModeloFixture() : ponte.modelo), [ponte])
  const modeloNoMenu = useModeloNoMenu(ponteModelo)

  // Idem para as contas do cliente (GitHub, Supabase, Vercel): sem adaptador real, não finge que ficaram prontas.
  // A Ajuda do Atlas: o Claude por baixo, atrás de uma porta. Sem adaptador real, não finge que entendeu.
  const ponteAjuda = useMemo<PonteAjuda>(() => ajuda ?? (modoFixture() ? criarAjudaFixture() : (ponte.ajuda ?? ajudaIndisponivel)), [ajuda, ponte])
  // Casos que o Atlas não resolveu vão ao painel do administrador (ocorrencias_admin, M7); sem adaptador real, não finge que anotou.
  const ponteCasos = useMemo<PonteCasosAdmin>(() => casos ?? (modoFixture() ? criarCasosFixture() : (ponte.casos ?? casosIndisponivel)), [casos, ponte])
  const abrirAjuda = (contexto: ContextoAjuda) => setPainelAjuda((a) => ({ contexto: { obra: obraAtual?.nome, pasta: obraAtual?.pasta, ...contexto }, n: (a?.n ?? 0) + 1 }))
  const pedirAjudaPasso = (p: PedidoAjudaPasso) => abrirAjuda(contextoDoPasso(p))

  const ponteContas = useMemo<PonteContas>(() => contas ?? (modoFixture() ? criarContasFixture() : (ponte.contas ?? contasIndisponivel)), [contas, ponte])

  // Idem para o celular (Remote Control): sem adaptador real, não finge que o celular está ligado.
  const ponteCelular = useMemo<PonteCelular>(() => celular ?? (modoFixture() ? criarCelularFixture() : (ponte.celular ?? celularIndisponivel)), [celular, ponte])

  // Idem para a pasta das obras (Atlas\Obras): sem adaptador real, não finge que criou a pasta.
  const ponteObras = useMemo<PonteObras>(() => obras ?? (modoFixture() ? criarObrasFixture(dono || 'Zé') : (ponte.obras ?? obrasIndisponivel)), [obras, dono, ponte])

  // Idem para os arquivos que o cliente sobe para a obra (print, logo, manual): sem adaptador real, não finge que subiu.
  const ponteArquivos = useMemo<PonteArquivos>(() => arquivos ?? (modoFixture() ? criarArquivosFixture(ponteObras.raiz()) : (ponte.arquivos ?? arquivosIndisponivel)), [arquivos, ponteObras, ponte])

  // Idem para o Claude que propõe os 3 estilos e escreve o design-system.md: sem adaptador real, não finge.
  const ponteEstilo = useMemo<PonteEstilo>(() => estilo ?? (modoFixture() ? criarEstiloFixture(ponteObras.raiz()) : (ponte.estilo ?? estiloIndisponivel)), [estilo, ponteObras, ponte])

  // Idem para o .zip que vem de outra IA (não confiável): sem adaptador real, não finge que recebeu nem abre nada.
  const ponteImportar = useMemo<PonteImportar>(() => importar ?? (modoFixture() ? criarImportarFixture(ponteObras.raiz()) : (ponte.importar ?? importarIndisponivel)), [importar, ponteObras, ponte])

  // Idem para o Claude que desenha e ajusta as telas (HTML não confiável: só em iframe sandbox): sem adaptador real, não finge.
  const ponteIdeia = useMemo<PonteIdeia>(() => (modoFixture() ? criarIdeiaFixture() : (ponte.ideia ?? ideiaIndisponivel)), [ponte])
  const pontePrototipo = useMemo<PontePrototipo>(() => prototipo ?? (modoFixture() ? criarPrototipoFixture(ponteObras.raiz()) : (ponte.prototipo ?? prototipoIndisponivel)), [prototipo, ponteObras, ponte])

  // Idem para o Claude que sugere os nomes e grava a marca na pasta da obra: sem adaptador real, não finge.
  const ponteBatismo = useMemo<PonteBatismo>(() => batismo ?? (modoFixture() ? criarBatismoFixture(ponteObras.raiz()) : (ponte.batismo ?? batismoIndisponivel)), [batismo, ponteObras, ponte])
  // Idem para conferir nomes parecidos e endereço livre (consulta pública): sem adaptador real, não finge que conferiu.
  // Idem para o plano da obra e o modo (automático ou passo a passo): o mesmo armazém de preferências é o que o painel da obra (M19) lê.
  const pontesModo = useMemo(() => {
    const m = modos ?? (modoFixture() ? criarModoObraFixture() : (ponte.modos ?? modoObraIndisponivel))
    return { modos: m, construcao: construcao ?? (modoFixture() ? criarConstrucaoFixture(m, ponteObras.raiz()) : (ponte.construcao ?? construcaoIndisponivel)) }
  }, [modos, construcao, ponteObras, ponte])

  // Idem para o painel da obra (PLAN.md, prazo, canteiro 3D): sem adaptador real, não finge andamento.
  // Cota do plano (F10) e ocorrências (F11) andam junto do painel: no fixture, esgotar a cota ou abrir uma ocorrência liga e desliga
  // a parada correspondente do mesmo painel. Sem adaptador real, nada é fingido.
  const pontesObra = useMemo(() => {
    if (painel || ponte.painel || !modoFixture()) {
      const fixture = modoFixture()
      return { painel: painel ?? ponte.painel ?? painelIndisponivel, cota: cota ?? (fixture ? criarCotaFixture() : (ponte.cota ?? cotaIndisponivel)), ocorrencias: ocorrencias ?? (fixture ? criarOcorrenciasFixture() : (ponte.ocorrencias ?? ocorrenciasIndisponivel)) }
    }
    const fx = criarPainelFixture()
    return {
      painel: fx as PontePainel,
      cota: cota ?? criarCotaFixture((esgotada) => fx.simular.pararPor(esgotada ? 'cota' : null)),
      ocorrencias: ocorrencias ?? criarOcorrenciasFixture((precisa) => fx.simular.pararPor(precisa ? 'voce' : null)),
    }
  }, [painel, cota, ocorrencias, ponte])
  const pontePainel = pontesObra.painel
  const ponteCota = pontesObra.cota
  const ponteOcorrencias = pontesObra.ocorrencias

  // Retomar (F12): detecta a obra em andamento e religa a linha por PontePainel/PonteCota. No fixture, sem obra informada, não há nada em andamento.
  const ponteRetomar = useMemo<PonteRetomar>(() => {
    if (retomar) return retomar
    if (!modoFixture()) return ponte.retomar ?? retomarIndisponivel
    const base = criarRetomarFixture(null)
    return { obraEmAndamento: base.obraEmAndamento, continuar: (o) => religarLinha({ painel: pontePainel, cota: ponteCota }, o.pasta) }
  }, [retomar, pontePainel, ponteCota, ponte])

  // Publicação (Vercel, Registro.br, lojas): pagamentos e "Enviar para revisão" são do cliente; sem adaptador real, não finge que publicou.
  const pontePublicar = useMemo<PontePublicar>(() => publicar ?? (modoFixture() ? criarPublicarFixture() : (ponte.publicar ?? publicarIndisponivel)), [publicar, ponte])

  // Pós-obra (F14): sem adaptador real, não finge que entendeu nem que mexeu na obra.
  const pontePosObra = useMemo<PontePosObra>(() => posobra ?? (modoFixture() ? criarPosObraFixture() : (ponte.posobra ?? posObraIndisponivel)), [posobra, ponte])

  // Licença em dia (S4 /verificar) é exigida ANTES de qualquer correção. Sem adaptador/endereço, nega (fail-closed); nunca finge licença fora do fixture.
  const ponteLicenca = useMemo<PonteLicenca>(() => {
    if (licenca) return licenca
    if (modoFixture()) return criarLicencaFixture()
    const url = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/[/]+$/, '')
    return url ? criarLicencaApi(ponte, url, ponte.servidor ? fetchPelaPonte(ponte.servidor, url) : undefined) : licencaIndisponivel
  }, [licenca, ponte])

  const ponteNomes = useMemo<PonteNomes>(() => nomes ?? (modoFixture() ? criarNomesFixture() : (ponte.nomes ?? nomesIndisponivel)), [nomes, ponte])

  const tokenLink = useTokenDoLink(ponte)
  const ativacao = useMemo<AtivacaoApi>(
    () => {
      if (api) return api
      if (modoFixture()) return criarAtivacaoFixture(ponte)
      const url = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/[/]+$/, '')
      return criarAtivacaoApi(ponte, url ? { api: url, linkToken: tokenLink } : null, url && ponte.servidor ? fetchPelaPonte(ponte.servidor, url) : undefined)
    },
    [api, ponte, tokenLink],
  )

  // Contador do teste e compra de dentro do app. Sem servidor (ou em modo fixture sem `?teste=N`) não há contador.
  const lerLicenca = useCallback(async (): Promise<ResumoLicenca | null> => {
    if (resumoLicenca) return resumoLicenca()
    if (modoFixture()) return resumoDeDemonstracao()
    const url = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/[/]+$/, '') ?? null
    return lerResumo(ponte, url, url && ponte.servidor ? fetchPelaPonte(ponte.servidor, url) : undefined)
  }, [resumoLicenca, ponte])
  const licencaNoApp = useLicencaNoApp(lerLicenca)
  const [emailCompra, setEmailCompra] = useState<string | null>(null)
  const abrirCompra = useCallback(() => { void lerAtivacao(ponte.cofre).then((a) => { if (a?.email) setEmailCompra(a.email) }) }, [ponte])
  const iniciarCompraPeloApp = useCallback((p: PedidoCompraNoApp): Promise<ResultadoCompra> => {
    if (iniciarCompraNoApp) return iniciarCompraNoApp(p)
    const cfg = configCompra()
    return iniciarCompra(p.email, cfg, cfg && ponte.servidor ? fetchPelaPonte(ponte.servidor, cfg.api) : undefined, p.versaoTermos, p.parcelas, undefined, p.origem)
  }, [iniciarCompraNoApp, ponte])
  const abrirPagamento = useCallback(async (url: string) => {
    if (ponte.pagamento) return ponte.pagamento.abrir(url)
    if (!modoFixture()) throw new Error('pagamento-indisponivel') // sem o processo principal não há como abrir o navegador: não finge
  }, [ponte])
  // "Conectar o Claude agora" de qualquer tela: vai para a tela de conectar e, ao terminar, volta para onde estava.
  const voltarDoClaude = useRef<string | null>(null)
  const pastaAberta = obraAtual?.pasta ?? null
  const progressoDaObra = useMemo(() => (pastaAberta && pontePrototipo.progresso ? () => pontePrototipo.progresso!(pastaAberta) : undefined), [pastaAberta, pontePrototipo])
  const conectarClaude = useCallback(() => { voltarDoClaude.current = tela; setTela(TELA_CLAUDE) }, [tela])
  const contextoLicenca = useMemo(() => ({ cartao: licencaNoApp.cartao, comprar: abrirCompra }), [licencaNoApp.cartao, abrirCompra])

  // M33: o celular como controle remoto deste notebook. Só no Atlas instalado, ativado e com acesso em dia; nunca no modo fixture.
  const remotoLigado = tela !== null && tela !== TELA_ATIVACAO && !licencaNoApp.encerrado && !modoFixture() && !!ponte.servidor
  useEffect(() => {
    const url = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/[/]+$/, '')
    if (!remotoLigado || !url || !ponte.servidor) return
    const canal = criarCanalRemotoApi(ponte, url, fetchPelaPonte(ponte.servidor, url))
    const ex = criarExecutorRemoto({ obras: ponteObras, prototipo: pontePrototipo, estilo: ponteEstilo, batismo: ponteBatismo, construcao: pontesModo.construcao, modos: pontesModo.modos, painel: pontePainel, arquivos: ponteArquivos }, canal, criarMemoriaRemotoLocal())
    return ligarCelularRemoto(ex)
  }, [remotoLigado, ponte, ponteObras, pontePrototipo, ponteEstilo, ponteBatismo, pontesModo, pontePainel, ponteArquivos])

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
      // O instalador reabre com --tela=F02 também depois de uma atualização: já ativado, ignora e abre normal (Obras ou Retomar).
      const argv = ativ !== null ? ponte.argv.filter((x) => x !== `--tela=${TELA_ATIVACAO}`) : ponte.argv
      const inicial = telaInicial(argv, ativ !== null, parada !== null)
      // Pedir Retomar (--tela=F12) sem obra em andamento não tem o que mostrar: cai em Minhas obras.
      setParadaF12(parada)
      setTela(inicial === TELA_RETOMAR && parada === null ? 'F05' : inicial)
    })()
    return () => { vivo = false }
  }, [ponte, ponteRetomar])

  if (tela === null) return null
  // Minhas obras → "Continuar": cada obra volta para a etapa em que parou (fase-obra.ts). O estilo escolhido fica no design-system.md da pasta.
  const continuarObra = (o: ObraParaContinuar) => {
    setObraAtual({ nome: o.nome, pasta: o.pasta })
    setRelatoDaObra(null)
    setEstiloEscolhido(null)
    if (o.etapa === 'obra') { setFluxo('lista'); setAtivo('obra'); return }
    setFluxo(o.etapa)
  }
  const painelDeAjuda = painelAjuda ? <Ajuda key={painelAjuda.n} ajuda={ponteAjuda} casos={ponteCasos} contexto={painelAjuda.contexto} nome={dono.split(' ')[0] || undefined} onFechar={() => setPainelAjuda(null)} /> : null
  // Pagou: o cartão já virou "Licença ativa" e a tela de compra some sozinha.
  const compra = emailCompra && !licencaNoApp.pagou ? <ComprarAtlas aberto email={emailCompra} onFechar={() => setEmailCompra(null)} iniciar={iniciarCompraPeloApp} abrirPagamento={abrirPagamento} onPagamentoAberto={licencaNoApp.esperarPagamento} /> : null
  const com = (n: ReactNode) => <ContextoConectarClaude.Provider value={conectarClaude}><ContextoPlano.Provider value={planoNoMenu}><ContextoModelo.Provider value={modeloNoMenu}><ContextoLicenca.Provider value={contextoLicenca}>{n}{painelDeAjuda}{compra}<StatusVoz /></ContextoLicenca.Provider></ContextoModelo.Provider></ContextoPlano.Provider></ContextoConectarClaude.Provider>
  // Cortesia/teste vencido: nada funciona, nenhum menu, nenhuma Ajuda. Só o aviso e a compra (que fecha sozinha ao pagar).
  if (licencaNoApp.encerrado && tela !== TELA_ATIVACAO) {
    return <>{<AcessoEncerrado encerrado={licencaNoApp.encerrado} onComprar={abrirCompra} />}{compra}</>
  }
  if (tela === TELA_ATIVACAO) {
    return com(<Ativacao api={ativacao} computador={computador} onInstalando={setInstalando} onContinuar={() => { void licencaNoApp.conferir(); setTela(TELA_CLAUDE) }} />)
  }
  if (tela === TELA_CLAUDE) return com(<Claude claude={ponteClaude} onContinuar={() => { const v = voltarDoClaude.current; voltarDoClaude.current = null; setTela(v ?? TELA_CELULAR) }} onPedirAjuda={() => abrirAjuda({ origem: 'menu', onde: 'a conexão com o Claude' })} />)
  // Caminho novo (23/11/2026): as contas saíram da instalação e vêm antes de começar a construção (fluxo 'contas'). --tela=F04 ainda abre.
  if (tela === TELA_CONTAS) return com(<Contas contas={ponteContas} navegador={modoFixture() ? undefined : ponte.navegador} onContinuar={() => setTela(TELA_CELULAR)} onPedirAjuda={pedirAjudaPasso} />)
  if (tela === TELA_CELULAR) return com(<Celular celular={ponteCelular} onVoltar={() => setTela(TELA_CLAUDE)} onConcluir={() => setTela('F05')} />)
  if (tela === TELA_RETOMAR && paradaF12) {
    return com(
      <Retomar
        obra={paradaF12}
        nome={dono || undefined}
        retomar={ponteRetomar}
        onContinuou={(o) => { setObraAtual({ nome: o.nome, pasta: o.pasta }); setFluxo('lista'); setAtivo('obra'); setTela('F05') }}
        onAgoraNao={() => setTela('F05')}
      />,
    )
  }
  // Demais telas (F05+ vêm nos próximos milestones): por ora cai em Obras.
  let conteudo: ReactNode
  if (ativo === 'obras' && fluxo === 'trazer') conteudo = <TrazerPrototipo obras={ponteObras} importar={ponteImportar} onVoltar={() => setFluxo('lista')} onConcluir={() => setFluxo('lista')} />
  else if (ativo === 'obras' && fluxo === 'estilo' && obraAtual) conteudo = <Estilo obra={obraAtual} arquivos={ponteArquivos} estilo={ponteEstilo} onVoltar={() => setFluxo(relatoDaObra !== null ? 'ideia' : 'lista')} onConcluir={(r) => { setEstiloEscolhido(r.estilo); void pontePrototipo.pintar?.(obraAtual.pasta, obraAtual.nome, r.estilo).catch(() => {}); setFluxo('batismo') }} />
  else if (ativo === 'obras' && fluxo === 'telas' && obraAtual) conteudo = <Prototipo obra={obraAtual} estilo={estiloEscolhido} prototipo={pontePrototipo} arquivos={ponteArquivos} onVoltar={() => setFluxo('batismo')} onConcluir={() => setFluxo('contas')} />
  else if (ativo === 'obras' && fluxo === 'batismo' && obraAtual) conteudo = <Batismo obra={obraAtual} batismo={ponteBatismo} nomes={ponteNomes} arquivos={ponteArquivos} onVoltar={() => setFluxo('estilo')} onConcluir={() => setFluxo('telas')} />
  else if (ativo === 'posobra') conteudo = obraAtual ? <PosObra obra={obraAtual} posobra={pontePosObra} arquivos={ponteArquivos} licenca={ponteLicenca} onAcompanhar={() => setAtivo('obra')} /> : <p>Escolha uma obra em Minhas obras para pedir uma mudança nela.</p>
  else if (ativo === 'obra' && obraAtual && fluxo === 'publicar') conteudo = <Publicar slug={slugDaObra(obraAtual.nome)} onPublicar={(sel) => { setSelecaoPub(sel); setFluxo('publicando') }} onVoltar={() => setFluxo('lista')} />
  else if (ativo === 'obra' && obraAtual && fluxo === 'publicando') conteudo = <Publicando obra={obraAtual} selecao={selecaoPub} publicar={pontePublicar} onVoltar={() => setFluxo('publicar')} onConcluir={(noAr) => { setEnderecoNoAr(noAr); setResumoEntrega(null); void pontePainel.ler(obraAtual.pasta).then((e) => setResumoEntrega({ etapas: e.etapas.length, tarefas: e.feitas }), () => {}); setFluxo('entrega') }} onPedirAjuda={pedirAjudaPasso} onErro={(p, e) => abrirAjuda({ ...contextoDoPasso(p), origem: 'erro', onde: 'a publicação', erro: e })} />
  else if (ativo === 'obra' && obraAtual && fluxo === 'entrega') conteudo = <Entrega obra={obraAtual} endereco={enderecoNoAr} resumo={resumoEntrega} onMudar={() => setAtivo('posobra')} />
  else if (ativo === 'obra' && obraAtual) conteudo = <Painel obra={obraAtual} painel={pontePainel} modos={pontesModo.modos} cota={ponteCota} ocorrencias={ponteOcorrencias} onPedirAjuda={() => abrirAjuda({ origem: 'menu' })} onVerMax={() => { void ponteClaude.abrirSite('planos') }} onPublicar={() => setFluxo('publicar')} />
  else if (ativo === 'obras' && fluxo === 'aprovar' && obraAtual) conteudo = <Aprovar obra={obraAtual} construcao={pontesModo.construcao} claude={ponteClaude} modos={pontesModo.modos} onVoltar={() => setFluxo('contas')} onComecou={() => { setFluxo('lista'); setAtivo('obra') }} />
  else if (ativo === 'obras' && fluxo === 'ideia') conteudo = <Ideia ideia={ponteIdeia} relatoInicial={relatoDaObra ?? undefined} onVoltar={() => setFluxo('lista')} onConcluir={async ({ relato, titulo }) => {
    // Já criada nesta sessão (voltou do estilo): segue, sem criar outra pasta. Nova: cria a pasta e começa o mapa em segundo plano.
    if (relatoDaObra !== null && obraAtual) { setRelatoDaObra(relato); setFluxo('estilo'); return }
    const nome = titulo.trim() || 'Nova obra'
    const criada = await ponteObras.criarSubpasta(nome)
    setObraAtual({ nome, pasta: criada.pasta })
    setRelatoDaObra(relato)
    setEstiloEscolhido(null)
    void pontePrototipo.mapear?.(criada.pasta, nome, relato).catch(() => {})
    setFluxo('estilo')
  }} />
  else if (ativo === 'obras' && fluxo === 'contas') conteudo = <Contas contas={ponteContas} navegador={modoFixture() ? undefined : ponte.navegador} onContinuar={() => setFluxo('aprovar')} onPedirAjuda={pedirAjudaPasso} />
  else if (ativo === 'retomar') conteudo = paradaF12
    ? <Retomar obra={paradaF12} nome={dono || undefined} retomar={ponteRetomar} onContinuou={(o) => { setObraAtual({ nome: o.nome, pasta: o.pasta }); setFluxo('lista'); setAtivo('obra') }} onAgoraNao={() => setAtivo('obras')} />
    : <SemObra rotulo="COMO RETOMAR" titulo="Nenhuma obra parada agora." texto="Se o computador desligar ou a cota do Claude acabar, a obra para no ponto em que estava. Quando você ligar o computador, o Atlas abre sozinho aqui, com um botão só: Continuar obra." onIrObras={() => setAtivo('obras')} />
  else if (ativo === 'prototipo' && obraAtual) conteudo = <Prototipo obra={obraAtual} estilo={estiloEscolhido} prototipo={pontePrototipo} arquivos={ponteArquivos} onVoltar={() => setAtivo('obras')} onConcluir={() => { setAtivo('obras'); setFluxo('batismo') }} />
  else if (ativo === 'prototipo' || ativo === 'obra') conteudo = <SemObra rotulo={ativo === 'prototipo' ? 'PROTÓTIPO' : 'OBRA'} titulo="Escolha uma obra primeiro." texto="Escolha uma obra em Minhas obras (ou comece a primeira). Depois é aqui que você vê as telas dela e acompanha a construção." onIrObras={() => setAtivo('obras')} />
  else if (ativo === 'obras') conteudo = <ListaObras obras={ponteObras} painel={pontePainel} nome={dono || undefined} onComecar={() => { setRelatoDaObra(null); setFluxo('ideia') }} onTrazer={() => setFluxo('trazer')} onContinuar={continuarObra} />
  // Caminho novo: faixa das 6 etapas no topo; fora das telas, o aviso do protótipo em segundo plano leva até elas.
  const CAMINHO: readonly string[] = ['ideia', 'estilo', 'batismo', 'telas', 'contas', 'aprovar']
  if (ativo === 'obras' && CAMINHO.includes(fluxo)) {
    conteudo = <><EtapasObra atual={fluxo as EtapaDoCaminho} progresso={fluxo !== 'telas' ? progressoDaObra : undefined} onVerTelas={() => setFluxo('telas')} />{conteudo}</>
  }
  // "Ajuda do Atlas" no menu abre o painel por cima da tela atual (não troca de tela).
  return com(<Obras ativo={ativo} onFalar={() => abrirAjuda({ origem: 'menu', ouvir: true })} onNavegar={(t) => (t === 'ajuda' ? abrirAjuda({ origem: 'menu' }) : setAtivo(t))}>{conteudo}</Obras>)
}
