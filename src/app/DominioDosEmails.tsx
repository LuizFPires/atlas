// O domínio dos e-mails (protótipo caminho-novo/U1UsarSistema.dc.html, aba 3; aprovado pelo Luiz em 28/11/2026).
// Três caminhos: comprar um agora na Vercel (o Atlas configura tudo depois), já na Vercel (automático) ou em outro lugar (um
// passo: colar 3 linhas, com o site aberto ao lado). Tudo abre no navegador lateral do Atlas. A compra é do cliente com a
// Vercel: o Atlas não vende, não recebe e não responde por ela.
import { useEffect, useRef, useState } from 'react'
import { Botao, Icone } from '../ui'
import { explicarTrava } from './explicar-trava'
import type { DominioNaVercel, PonteResend, SituacaoResend } from './ponte-resend'
import type { Retangulo } from './ponte-navegador'

type Caminho = 'nao' | 'vercel' | 'outro'
interface Props {
  ponte: PonteResend
  onde?: () => Retangulo
  onSituacao: (s: SituacaoResend) => void
  /** De quanto em quanto tempo procura a compra na Vercel (padrão: 20 s). */
  sondagemCompraMs?: number
}

const CAMINHOS: { id: Caminho; rot: string; tit: string; txt: string; tag: string; ok: boolean }[] = [
  { id: 'nao', rot: 'NÃO TENHO DOMÍNIO', tit: 'Quero um agora', txt: 'Você escolhe o nome, compra na sua Vercel e o Atlas configura tudo.', tag: '0 PASSOS DEPOIS', ok: true },
  { id: 'vercel', rot: 'JÁ TENHO, NA VERCEL', tit: 'Comprei na Vercel', txt: 'O Atlas acha o domínio na sua conta e configura tudo.', tag: 'AUTOMÁTICO', ok: true },
  { id: 'outro', rot: 'JÁ TENHO, EM OUTRO LUGAR', tit: 'Registro.br, GoDaddy…', txt: 'Um passo, uma vez só: colar 3 linhas, com o site aberto ao lado.', tag: '1 PASSO', ok: false },
]
const limpar = (t: string) => t.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
const erroDe = (e: unknown) => { const x = explicarTrava(e instanceof Error ? e.message : String(e)); return `${x.houve} ${x.fazer}` }

export function DominioDosEmails({ ponte, onde, onSituacao, sondagemCompraMs = 20_000 }: Props) {
  const temVercel = Boolean(ponte.dominiosNaVercel && ponte.ligarPelaVercel)
  const [caminho, setCaminho] = useState<Caminho>(temVercel ? 'nao' : 'outro')
  const [nome, setNome] = useState('')
  const [livre, setLivre] = useState<{ nome: string; situacao: string } | null>(null)
  const [comprando, setComprando] = useState<string | null>(null)
  const [lista, setLista] = useState<DominioNaVercel[] | null>(null)
  const [dominio, setDominio] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')
  const ligando = useRef(false)

  const usar = async (d: string) => {
    if (!ponte.ligarPelaVercel || ligando.current) return
    ligando.current = true; setOcupado(true); setAviso('')
    try { onSituacao(await ponte.ligarPelaVercel(d)) } catch (e) { setAviso(erroDe(e)) } finally { ligando.current = false; setOcupado(false) }
  }
  const lerLista = () => {
    if (!ponte.dominiosNaVercel) return
    setLista(null); setAviso('')
    ponte.dominiosNaVercel().then(setLista, (e) => { setLista([]); setAviso(erroDe(e)) })
  }

  // Comprando: procura o domínio na conta da Vercel de tempos em tempos; chegou, liga sozinho.
  useEffect(() => {
    if (!comprando || !ponte.dominiosNaVercel) return
    const id = setInterval(() => {
      ponte.dominiosNaVercel!().then((l) => { if (l.some((x) => x.dominio === comprando && x.servidoresVercel)) { setComprando(null); void usar(comprando) } }, () => {})
    }, sondagemCompraMs)
    return () => clearInterval(id)
  }, [comprando, sondagemCompraMs]) // eslint-disable-line react-hooks/exhaustive-deps

  const procurar = async () => {
    const base = limpar(nome).replace(/\..*$/, '').replace(/[^a-z0-9-]/g, '')
    if (!base) return
    const n = `${base}.com`
    setLivre({ nome: n, situacao: 'procurando' })
    try { setLivre({ nome: n, situacao: ponte.nomeLivre ? await ponte.nomeLivre(n) : 'incerto' }) } catch { setLivre({ nome: n, situacao: 'incerto' }) }
  }
  const comprar = (n: string) => {
    setComprando(n)
    if (ponte.abrirSite && onde) void ponte.abrirSite('vercel-comprar', onde(), n).catch(() => {})
  }
  const outro = async () => {
    setOcupado(true); setAviso('')
    try {
      onSituacao(await ponte.escolherDominio(dominio))
      if (ponte.abrirSite && onde && /\.br$/.test(limpar(dominio))) void ponte.abrirSite('registro', onde()).catch(() => {})
    } catch (e) {
      const c = e instanceof Error ? e.message : ''
      setAviso(c === 'dominio-invalido' ? 'Escreva só o domínio, por exemplo suaempresa.com.br. O endereço .vercel.app não serve: precisa ser um domínio seu.' : erroDe(e))
    } finally { setOcupado(false) }
  }

  return (
    <div className="at-ligar__caixa at-dm">
      <span className="at-rs__passo">LIGAR O RESEND · 2 DE 2 · O DOMÍNIO DOS SEUS E-MAILS</span>
      <span>O Resend só manda e-mail para qualquer pessoa de um domínio seu. É uma vez só e vale para todos os seus sistemas. O Atlas cuida do resto sozinho.</span>
      {temVercel && (
        <div className="at-dm__ops" role="radiogroup" aria-label="Seu domínio está onde?">
          {CAMINHOS.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={caminho === c.id} className={`at-dm__op${caminho === c.id ? ' at-dm__op--on' : ''}`} onClick={() => { setCaminho(c.id); setAviso(''); if (c.id === 'vercel' && lista === null) lerLista() }}>
              <span className="at-rs__passo">{c.rot}</span><b>{c.tit}</b><span>{c.txt}</span><span className={`at-dm__tag${c.ok ? '' : ' at-dm__tag--amb'}`}>{c.tag}</span>
            </button>
          ))}
        </div>
      )}

      {caminho === 'nao' && (
        <div className="at-dm__painel" aria-label="Comprar um domínio">
          <span className="at-rs__passo">ESCOLHA O NOME</span>
          <div className="at-ligar__campo">
            <label htmlFor="nome-dominio" className="at-ligar__oculto">Nome do domínio</label>
            <input id="nome-dominio" type="text" autoComplete="off" spellCheck={false} placeholder="barbeariadoze" value={nome} onChange={(e) => { setNome(e.target.value); setLivre(null) }} onKeyDown={(e) => { if (e.key === 'Enter') void procurar() }} />
            <Botao variante="secundario" onClick={() => void procurar()} disabled={!limpar(nome)}>Procurar</Botao>
          </div>
          {livre && (
            <div className="at-dm__nomes">
              <div className={`at-dm__nm${livre.situacao === 'livre' ? ' at-dm__nm--on' : ''}`}>
                <b>{livre.nome}</b>
                <span>{livre.situacao === 'procurando' ? 'procurando…' : livre.situacao === 'livre' ? 'livre · o preço aparece na Vercel antes de você confirmar' : livre.situacao === 'ocupado' ? 'já tem dono · tente outro nome' : 'a Vercel confirma se está livre'}</span>
                {livre.situacao === 'livre' && <span className="at-dm__tag">RECOMENDADO</span>}
              </div>
              <div className="at-dm__nm at-dm__nm--off"><b>{livre.nome.replace(/\.com$/, '.com.br')}</b><span>a Vercel não vende .com.br · se preferir, compre no Registro.br e use “Já tenho, em outro lugar”</span></div>
            </div>
          )}
          <div className="at-dm__quem">
            <span className="at-dm__qi" aria-hidden="true"><Icone nome="escudo" tamanho={18} /></span>
            <div><b>Você está comprando da Vercel, não do Atlas.</b><span>O domínio é seu, fica na sua conta da Vercel e é cobrado no seu cartão, pela Vercel. O Atlas não vende domínio, não recebe nada por essa compra e não responde por ela: nota, renovação e reembolso são com a Vercel. A Vercel pede a sua confirmação antes de cobrar.</span></div>
          </div>
          {!comprando && (
            <div className="at-dm__pe">
              <span className="at-ativ__txt">Depois da compra você não faz mais nada: o Atlas configura tudo.</span>
              <Botao onClick={() => livre && comprar(livre.nome)} disabled={!livre || livre.situacao === 'ocupado' || livre.situacao === 'procurando'}>{livre ? `Comprar ${livre.nome} na Vercel →` : 'Comprar na Vercel →'}</Botao>
            </div>
          )}
          {comprando && (
            <div className="at-rs__espera" role="status"><span className="at-rs__pulso" aria-hidden="true" /><span><b>Esperando a sua compra na Vercel.</b> A página de compra está aberta ao lado. Quem confirma é você. Assim que {comprando} aparecer na sua conta, o Atlas configura os e-mails sozinho.</span></div>
          )}
        </div>
      )}

      {caminho === 'vercel' && (
        <div className="at-dm__painel" aria-label="Domínios na sua Vercel">
          <span className="at-rs__passo">DOMÍNIOS NA SUA VERCEL</span>
          {lista === null && <span className="at-ativ__txt">Lendo a sua conta da Vercel…</span>}
          {lista && lista.length === 0 && !aviso && <span className="at-ativ__txt">Não achei nenhum domínio na sua conta da Vercel. Compre um em “Quero um agora”.</span>}
          {lista?.map((d) => (
            <div key={d.dominio} className={`at-dm__nm${d.servidoresVercel ? ' at-dm__nm--on' : ''}`}>
              <b>{d.dominio}</b>
              <span>{d.servidoresVercel ? 'na sua Vercel · pronto para usar' : 'na sua Vercel, mas os servidores (DNS) são de outro lugar · use “Já tenho, em outro lugar”'}</span>
              {d.servidoresVercel && <Botao onClick={() => void usar(d.dominio)} disabled={ocupado}>{ocupado ? 'Configurando…' : `Usar ${d.dominio} →`}</Botao>}
            </div>
          ))}
          {lista && aviso && <button type="button" className="at-ativ__link" onClick={lerLista}>Tentar de novo</button>}
        </div>
      )}

      {caminho === 'outro' && (
        <div className="at-dm__painel" aria-label="Domínio em outro lugar">
          <span className="at-rs__passo">SEU DOMÍNIO</span>
          <span>É o que vem depois do @ no e-mail da sua empresa. O e-mail da empresa continua igual: as 3 linhas que você vai colar são só do sistema.</span>
          <div className="at-ligar__campo">
            <label htmlFor="dominio-resend" className="at-ligar__oculto">Seu domínio</label>
            <input id="dominio-resend" type="text" autoComplete="off" spellCheck={false} placeholder="suaempresa.com.br" value={dominio} onChange={(e) => setDominio(e.target.value)} />
            <Botao onClick={() => void outro()} disabled={!dominio.trim() || ocupado}>{ocupado ? 'Cadastrando…' : 'Continuar'}</Botao>
          </div>
        </div>
      )}
      {aviso && <p className="at-ativ__erro" role="alert">{aviso}</p>}
    </div>
  )
}
