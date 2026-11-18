import { useCallback, useEffect, useMemo, useState } from 'react'
import { Botao, CampoFalado, Icone } from '../ui'
import type { PedidoAjudaPasso } from './ajuda-passo'
import { CartaoPasso, PreviaSite } from './GuiaConta'
import { dominioValido, registroDnsValido, slugDaObra, type PontePublicar, type RegistroDns, type SituacaoNome } from './ponte-publicar'
import { guiasEscolhidos, type Selecao } from './publicar-dados'
import { montarGuia, type ContextoGuia } from './publicar-passos'
import './app.css'
import './claude.css'
import './contas.css'
import './publicar.css'

interface Props {
  obra: { nome: string; pasta: string }
  /** O que o cliente marcou no F13a. */
  selecao: Selecao
  publicar: PontePublicar
  /** Último passo do último guia: segue para a entrega das chaves (F13). */
  onConcluir: (noAr: string | null) => void
  /** "Não consegui fazer este passo": abre a Ajuda do Atlas (F17) com o print do passo. */
  onPedirAjuda?: (pedido: PedidoAjudaPasso) => void
  onVoltar?: () => void
  /** De quanto em quanto tempo o Atlas confere se a internet já reconheceu o domínio. Padrão: 5 minutos. */
  sondagemMs?: number
}

type Auto = { estado: 'rodando' | 'ok' | 'erro'; texto: string; chave: string; ocupado?: boolean }

/**
 * F13b: o guia de mão dada da publicação (prototipo/F13bPublicando), um guia por opção marcada no F13a, até o último estágio.
 * Cada passo mostra quem faz (VOCÊ ou O ATLAS). Pagamento e "Enviar para revisão" são SEMPRE do cliente: o Atlas só guia,
 * abre o site oficial e faz a parte técnica (publicar, ler o DNS, esperar a internet, gerar o cartaz).
 */
export function Publicando({ obra, selecao, publicar, onConcluir, onPedirAjuda, onVoltar, sondagemMs = 5 * 60_000 }: Props) {
  const ids = useMemo(() => guiasEscolhidos(selecao), [selecao])
  const slug = slugDaObra(obra.nome)
  const [nomeBase, setNomeBase] = useState(slug) // o que o cliente está digitando
  const [nomeAlvo, setNomeAlvo] = useState(slug) // o nome já confirmado (só muda em "Conferir de novo")
  const [endereco, setEndereco] = useState(`${slug}.vercel.app`)
  const [noAr, setNoAr] = useState<string | null>(null) // só preenche quando o adaptador de verdade publicou (a entrega F13 não finge)
  const [dns, setDns] = useState<RegistroDns[] | null>(null)
  const dominio = `${slugDaObra(nomeAlvo)}.com.br`
  const [gi, setGi] = useState(0)
  const [passo, setPasso] = useState(0)
  const [feitos, setFeitos] = useState<Partial<Record<string, boolean>>>({})
  const [pronto, setPronto] = useState(false)
  const [autoBruto, setAuto] = useState<Auto | null>(null) // `chave` diz de que passo é (nunca mostra o estado do passo anterior)
  const [tentativa, setTentativa] = useState(0)
  const [aviso, setAviso] = useState('')

  const real = !publicar.indisponivel
  const ctx = useMemo<ContextoGuia>(() => ({ obra: obra.nome, slug, endereco, dominio, dns, real }), [obra.nome, slug, endereco, dominio, dns, real])
  const guias = useMemo(() => ids.map((id) => montarGuia(id, ctx)), [ids, ctx])
  const g = guias[Math.min(gi, guias.length - 1)]
  const p = g?.passos[Math.min(passo, (g?.passos.length ?? 1) - 1)]
  const ultimo = !!g && passo === g.passos.length - 1
  const ultimoGuia = gi === guias.length - 1

  // "Pode fechar o Atlas: quando voltar, ele continua deste passo."
  useEffect(() => {
    let vivo = true
    void publicar.lerProgresso(obra.pasta).catch(() => null).then((prog) => {
      if (!vivo) return
      const i = prog ? ids.indexOf(prog.guia as (typeof ids)[number]) : -1
      if (prog && i >= 0 && Number.isInteger(prog.passo) && prog.passo >= 0) { setGi(i); setPasso(prog.passo) }
      setPronto(true)
    })
    return () => { vivo = false }
  }, [publicar, obra.pasta, ids])
  useEffect(() => {
    if (pronto && g) void publicar.gravarProgresso(obra.pasta, { guia: g.id, passo }).catch(() => {})
  }, [pronto, g, passo, publicar, obra.pasta])

  const autoId = p?.auto
  // O que o Atlas faz sozinho neste passo (sempre por uma porta).
  useEffect(() => {
    if (!pronto || !autoId) return
    let vivo = true
    const chave = `${gi}:${passo}`
    const poe = (a: Omit<Auto, 'chave'>) => setAuto({ ...a, chave })
    const fim = (a: Omit<Auto, 'chave'>) => { if (vivo) poe(a) }
    const erro = (texto: string) => fim({ estado: 'erro', texto })
    if (autoId === 'adaptador') {
      poe(real
        ? { estado: 'ok', texto: 'O Atlas cuida desta parte.' }
        : { estado: 'erro', texto: 'Essa parte ainda não está ligada neste computador. Ainda não publiquei de verdade, então não vou dizer que deu certo.' })
    } else if (autoId === 'publicar') {
      poe({ estado: 'rodando', texto: 'O Atlas está colocando o sistema no ar…' })
      publicar.publicarNoAr(slug).then((r) => { if (vivo) { setEndereco(r.endereco); setNoAr(r.endereco) } fim({ estado: 'ok', texto: `No ar: ${r.endereco}` }) }, () => erro('Não consegui colocar no ar agora. Nada se perdeu: tente de novo.'))
    } else if (autoId === 'cartaz') {
      poe({ estado: 'rodando', texto: 'O Atlas está criando o cartaz…' })
      publicar.gerarCartaz(endereco).then((r) => fim({ estado: 'ok', texto: `Cartaz pronto na pasta da obra: ${r.arquivo}` }), () => erro('Não consegui criar o cartaz agora. Tente de novo.'))
    } else if (autoId === 'nome') {
      poe({ estado: 'rodando', texto: `O Atlas está conferindo se ${dominio} está livre…` })
      publicar.nomeLivre(dominio).catch((): SituacaoNome => 'incerto').then((s) => {
        if (!vivo) return
        if (s === 'livre') fim({ estado: 'ok', texto: `${dominio} está livre.` })
        else if (s === 'ocupado') fim({ estado: 'erro', texto: `${dominio} já tem dono. Escolha outro nome logo abaixo.`, ocupado: true })
        else fim({ estado: 'ok', texto: `Não consegui conferir agora. O Registro.br mostra se ${dominio} está livre; pode seguir.` })
      })
    } else if (autoId === 'dns') {
      poe({ estado: 'rodando', texto: 'O Atlas está lendo o que a Vercel pede para o seu endereço…' })
      publicar.lerDns(dominio).then((r) => {
        const bons = r.filter(registroDnsValido)
        if (!bons.length || bons.length < r.length) return erro('A Vercel devolveu uma linha que não parece certa, então não vou mostrar para você copiar. Tente de novo.')
        if (vivo) setDns(bons)
        fim({ estado: 'ok', texto: 'Linhas prontas para copiar.' })
      }, () => erro('Não consegui ler o que a Vercel pede agora. Tente de novo.'))
    } else if (autoId === 'espera') {
      poe({ estado: 'rodando', texto: 'Conferindo a cada 5 minutos se a internet já reconheceu o seu endereço…' })
      const conferir = async () => {
        try {
          const regs = dns ?? (await publicar.lerDns(dominio)).filter(registroDnsValido)
          if (!vivo) return false
          if (!regs.length) return false
          if (!dns) setDns(regs)
          if (await publicar.dnsNoAr(dominio, regs)) {
            if (vivo) { poe({ estado: 'ok', texto: 'A internet já reconheceu o seu endereço.' }); setPasso((n) => n + 1) }
            return true
          }
        } catch { /* tenta de novo na próxima volta */ }
        return false
      }
      void conferir()
      const t = setInterval(() => { void conferir().then((ok) => { if (ok) clearInterval(t) }) }, sondagemMs)
      return () => { vivo = false; clearInterval(t) }
    }
    return () => { vivo = false }
    // dns/endereco entram de propósito só na leitura do passo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, gi, passo, autoId, tentativa, dominio, slug, publicar, sondagemMs])

  const ir = useCallback((i: number, n = 0) => { setGi(i); setPasso(n); setAviso('') }, [])
  if (!pronto || !g || !p) return null
  const auto = autoBruto && autoBruto.chave === `${gi}:${passo}` ? autoBruto : null

  const bloqueado = !!autoId && auto?.estado !== 'ok'
  const avancar = async () => {
    setAviso('')
    if (p.abre) {
      try { await publicar.abrirSite(p.abre, p.abre === 'registro' && dominioValido(dominio) ? dominio : undefined) } catch { setAviso('Não consegui abrir o site agora. Abra ele no seu navegador e siga os passos daqui mesmo.') }
    }
    if (!ultimo) { setPasso(passo + 1); return }
    setFeitos((f) => ({ ...f, [g.id]: true }))
    if (ultimoGuia) onConcluir(noAr); else ir(gi + 1)
  }
  const voltar = () => { setAviso(''); if (passo > 0) setPasso(passo - 1); else if (gi > 0) ir(gi - 1, guias[gi - 1].passos.length - 1) }
  const rotuloBotao = p.abre ? 'Abrir o site →' : ultimo ? (ultimoGuia ? 'Ver a entrega das chaves →' : `Próximo: ${guias[gi + 1].nome} →`) : p.quem === 'atlas' ? 'Continuar →' : 'Fiz isso →'

  return (
    <div className="at-pando">
      <div className="at-contas__abas">
        <span className="at-pub__rotulo" style={{ alignSelf: 'center', marginRight: 6 }}>PUBLICANDO · {obra.nome.toUpperCase()} · TOQUE PARA VER CADA GUIA</span>
        {guias.map((x, i) => (
          <button key={x.id} type="button" className={`at-contas__aba ${i === gi ? 'at-contas__aba--atual' : ''} ${feitos[x.id] ? 'at-contas__aba--feita' : ''}`} aria-current={i === gi ? 'step' : undefined} onClick={() => ir(i)}>
            <span className="at-contas__aba-bola">{feitos[x.id] ? <Icone nome="check" tamanho={12} /> : i + 1}</span>
            {x.nome}
          </button>
        ))}
      </div>
      <div className="at-pando__grade">
        <div className="at-claude__col">
          <div className="at-claude__cab">
            <h1 className="at-pando__titulo">{g.titulo}</h1>
            <span className="at-ativ__txt">{g.intro}</span>
          </div>
          <CartaoPasso passo={p} n={passo + 1} total={g.passos.length} />
          {auto && <p className={`at-pando__estado ${auto.estado === 'erro' ? 'at-pando__estado--erro' : ''}`} role="status">{auto.estado === 'ok' && <Icone nome="check" tamanho={16} />}{auto.estado === 'rodando' && <Icone nome="relogio" tamanho={16} />}{auto.texto}</p>}
          {autoId === 'nome' && auto?.ocupado && (
            <div className="at-pando__outro">
              <CampoFalado rotulo="Outro nome para o endereço" valor={nomeBase} onChange={(v) => setNomeBase(v)} ajuda={`Vai ficar assim: ${slugDaObra(nomeBase)}.com.br`} />
            </div>
          )}
          <div className="at-ativ__rodape at-claude__acoes">
            <Botao variante="secundario" onClick={voltar} disabled={gi === 0 && passo === 0}>← Voltar</Botao>
            {auto?.estado === 'erro' && <Botao variante="secundario" onClick={() => { setNomeAlvo(nomeBase); setDns(null); setTentativa((n) => n + 1) }}>{auto.ocupado ? 'Conferir de novo' : 'Tentar de novo'}</Botao>}
            <Botao onClick={() => void avancar()} disabled={bloqueado}>{rotuloBotao}</Botao>
          </div>
          {aviso && <p className="at-ativ__erro" role="alert">{aviso}</p>}
          <button type="button" className="at-ativ__link at-claude__nao-consegui" onClick={() => onPedirAjuda?.({ origem: 'F13b', conta: g.nome, passo: passo + 1, totalPassos: g.passos.length, print: { url: p.site.url, titulo: p.site.titulo, botaoCerto: p.site.itens.find((i) => i.destaque)?.txt } })}>Não consegui fazer este passo</button>
          {real && <span className="at-pando__nota">Pode fechar o Atlas a qualquer momento. Quando voltar, ele continua deste passo.</span>}
          {onVoltar && <button type="button" className="at-pub__link" onClick={onVoltar}>Mudar o que vou publicar</button>}
        </div>
        <PreviaSite site={p.site} />
      </div>
    </div>
  )
}
