// Resend, o carteiro (Luiz, 28/11/2026, protótipo aprovado telas 2 e 3): a 4ª conta, opcional, na tela das contas. Liga a chave,
// escolhe o domínio e mostra os registros de DNS que o próprio Resend pede, conferindo sozinho de minuto em minuto. Verificado, o
// Atlas liga os e-mails dos sistemas publicados (no processo principal).
import { useEffect, useState } from 'react'
import { Botao, Icone } from '../ui'
import type { PonteResend, SituacaoResend } from './ponte-resend'
import type { Retangulo } from './ponte-navegador'
import './resend.css'

interface Props {
  ponte: PonteResend
  /** Onde abrir o site do Resend ao lado (o mesmo painel das outras contas). */
  onde?: () => Retangulo
  /** De quanto em quanto tempo o Atlas confere o domínio (padrão: 1 minuto). */
  sondagemMs?: number
}

const AVISO_CHAVE: Record<string, string> = {
  formato: 'Essa não parece a chave. A chave do Resend começa com re_. Copie de novo pelo botão de copiar do site.',
  recusada: 'O Resend não aceitou esta chave. Crie outra no site (Create API Key) e cole de novo.',
  'sem-permissao': 'Essa chave só manda e-mail. Crie outra com a permissão "Full access" (acesso completo) e cole de novo.',
  'sem-internet': 'Não consegui falar com o Resend agora para conferir a chave. Confira a internet e toque em Pronto de novo.',
}
const PROVEDORES: { id: string; nome: string; como: string }[] = [
  { id: 'registro', nome: 'Registro.br', como: 'Entre em registro.br, abra o seu domínio → Editar zona → Nova entrada, uma para cada linha abaixo.' },
  { id: 'godaddy', nome: 'GoDaddy', como: 'Entre na GoDaddy, abra Meus produtos → DNS do domínio → Adicionar registro, uma para cada linha abaixo.' },
  { id: 'hostinger', nome: 'Hostinger', como: 'Entre na Hostinger, abra Domínios → DNS / Nameservers → Adicionar registro, uma para cada linha abaixo.' },
  { id: 'cloudflare', nome: 'Cloudflare', como: 'Entre na Cloudflare, abra o domínio → DNS → Add record, uma para cada linha abaixo (deixe a nuvem cinza).' },
  { id: 'outro', nome: 'Outro', como: 'No site onde você comprou o domínio, procure "DNS" ou "Zona DNS" e adicione cada linha abaixo.' },
]
const copiar = (t: string) => { try { void navigator.clipboard?.writeText(t) } catch { /* sem área de transferência */ } }

export function ResendConta({ ponte, onde, sondagemMs = 60_000 }: Props) {
  const [s, setS] = useState<SituacaoResend | null>(null)
  const [aberto, setAberto] = useState(false)
  const [chave, setChave] = useState('')
  const [dominio, setDominio] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')
  const [prov, setProv] = useState('registro')

  useEffect(() => { let vivo = true; ponte.situacao().then((x) => { if (vivo) setS(x) }, () => {}); return () => { vivo = false } }, [ponte])
  // Domínio esperando: confere sozinho (o processo principal também confere, mesmo com esta tela fechada).
  useEffect(() => {
    if (!s || !s.ligado || s.estado !== 'esperando' || !sondagemMs) return
    const id = setInterval(() => { ponte.conferir().then(setS, () => {}) }, sondagemMs)
    return () => clearInterval(id)
  }, [s, ponte, sondagemMs])

  if (!s) return null
  const ligar = () => { setAberto(true); setAviso(''); if (ponte.abrirChaves && onde) void ponte.abrirChaves(onde()).catch(() => {}) }
  const enviarChave = async () => {
    setOcupado(true); setAviso('')
    try {
      const r = await ponte.guardarChave(chave)
      if (r.ok) { setChave(''); setS(await ponte.situacao()) } else setAviso(AVISO_CHAVE[r.motivo] ?? AVISO_CHAVE['sem-internet'])
    } catch { setAviso(AVISO_CHAVE['sem-internet']) } finally { setOcupado(false) }
  }
  const enviarDominio = async () => {
    setOcupado(true); setAviso('')
    try { setS(await ponte.escolherDominio(dominio)) } catch (e) {
      const c = e instanceof Error ? e.message : ''
      setAviso(c === 'dominio-invalido' ? 'Escreva só o domínio, por exemplo suaempresa.com.br. O endereço .vercel.app não serve: precisa ser um domínio seu.' : 'Não consegui falar com o Resend agora. Confira a internet e tente de novo.')
    } finally { setOcupado(false) }
  }
  const conferirAgora = async () => { setOcupado(true); try { setS(await ponte.conferir()) } catch { /* tenta no próximo minuto */ } finally { setOcupado(false) } }

  const verificado = s.ligado && s.estado === 'verificado'
  const sub = verificado ? `E-mails saindo de ${s.remetente}` : s.ligado ? (s.dominio ? `Esperando o domínio ${s.dominio} confirmar` : 'Ligado · falta o seu domínio') : 'Opcional · recomendada'
  return (
    <div className={`at-ligar__linha at-rs${aberto || (s.ligado && !verificado) ? ' at-ligar__linha--ativa' : ''}`} aria-label="Resend, o carteiro" role="group">
      <div className="at-ligar__topo">
        <span className={`at-ligar__bola at-ligar__bola--${verificado ? 'ligado' : s.ligado ? 'esperando' : 'pendente'}`} aria-hidden="true">{verificado ? <Icone nome="check" tamanho={16} /> : s.ligado ? '…' : '○'}</span>
        <div className="at-ligar__nome">
          <b>Resend <span>· o carteiro</span></b>
          <span className={verificado ? 'at-ligar__ok' : s.ligado ? 'at-ligar__sub' : 'at-rs__opc'}>{sub}</span>
        </div>
        {!s.ligado && !aberto && <Botao variante="secundario" onClick={ligar} aria-label="Ligar o Resend">Ligar →</Botao>}
      </div>

      {!s.ligado && !aberto && <span className="at-rs__por">Manda os e-mails do seu sistema para qualquer pessoa: senha, convites e avisos. Grátis até 100 e-mails por dia. Sem ele, o sistema só manda e-mail para quem é da sua equipe no Supabase.</span>}

      {!s.ligado && aberto && (
        <div className="at-ligar__caixa">
          <span className="at-rs__passo">LIGAR O RESEND · 1 DE 2</span>
          <span>No site ao lado, entre (ou crie uma conta grátis), abra <b>API Keys</b>, clique em <b>Create API Key</b>, escreva <b>Atlas</b> no nome, escolha <b>Full access</b> e copie a chave. Depois cole aqui.</span>
          <span className="at-ligar__trad"><b>Full access</b> quer dizer <b>"acesso completo"</b>: o Atlas precisa dele para cadastrar o seu domínio.</span>
          <div className="at-ligar__campo">
            <label htmlFor="chave-resend" className="at-ligar__oculto">Chave do Resend</label>
            <input id="chave-resend" type="password" autoComplete="off" spellCheck={false} placeholder="re_…" value={chave} onChange={(e) => setChave(e.target.value)} />
            <Botao onClick={() => void enviarChave()} disabled={!chave.trim() || ocupado}>{ocupado ? 'Conferindo…' : 'Pronto'}</Botao>
          </div>
          {aviso && <p className="at-ativ__erro" role="alert">{aviso}</p>}
          <span className="at-ativ__txt">A chave fica guardada no cofre deste computador, nunca num arquivo. O Atlas nunca vê a sua senha do Resend.</span>
        </div>
      )}

      {s.ligado && !s.dominio && (
        <div className="at-ligar__caixa">
          <span className="at-rs__passo">LIGAR O RESEND · 2 DE 2</span>
          <span>Qual é o domínio dos seus e-mails? É o que vem depois do @ no e-mail da sua empresa. O Resend só manda para qualquer pessoa depois de confirmar que o domínio é seu. É uma vez só e vale para todos os seus sistemas.</span>
          <div className="at-ligar__campo">
            <label htmlFor="dominio-resend" className="at-ligar__oculto">Seu domínio</label>
            <input id="dominio-resend" type="text" autoComplete="off" spellCheck={false} placeholder="suaempresa.com.br" value={dominio} onChange={(e) => setDominio(e.target.value)} />
            <Botao onClick={() => void enviarDominio()} disabled={!dominio.trim() || ocupado}>{ocupado ? 'Cadastrando…' : 'Continuar'}</Botao>
          </div>
          {aviso && <p className="at-ativ__erro" role="alert">{aviso}</p>}
        </div>
      )}

      {s.ligado && s.dominio && !verificado && (
        <div className="at-ligar__caixa">
          <span className="at-rs__passo">VERIFICAR {s.dominio.toUpperCase()}</span>
          <b>Copie estes registros para o seu domínio</b>
          <div className="at-rs__prov" role="group" aria-label="Onde está o seu domínio">
            {PROVEDORES.map((p) => <button key={p.id} type="button" aria-pressed={prov === p.id} onClick={() => setProv(p.id)}>{p.nome}</button>)}
          </div>
          <span>{PROVEDORES.find((p) => p.id === prov)?.como}</span>
          <table className="at-rs__dns">
            <thead><tr><th>TIPO</th><th>NOME</th><th>VALOR</th><th /><th>SITUAÇÃO</th></tr></thead>
            <tbody>
              {s.registros.map((r, i) => (
                <tr key={`${r.tipo}-${r.nome}-${i}`}>
                  <td>{r.tipo}</td>
                  <td><code>{r.nome}</code></td>
                  <td><code>{r.valor}</code>{r.prioridade !== undefined && <small> prioridade {r.prioridade}</small>}</td>
                  <td><button type="button" className="at-rs__copiar" onClick={() => copiar(r.valor)} aria-label={`Copiar o valor ${r.tipo} ${r.nome}`}>Copiar</button></td>
                  <td><span className={`at-rs__st at-rs__st--${r.estado}`}>{r.estado === 'ok' ? 'OK' : r.estado === 'falhou' ? 'CONFERIR' : 'ESPERANDO'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="at-rs__espera" role="status"><span className="at-rs__pulso" aria-hidden="true" /><span><b>{s.estado === 'falhou' ? 'O Resend ainda não achou os registros.' : 'Esperando o domínio confirmar.'}</b> O Atlas confere sozinho a cada minuto. Costuma levar de 5 minutos a algumas horas. Pode fechar o Atlas: ele continua de onde parou.</span></div>
          <div className="at-rs__acoes"><button type="button" className="at-ativ__link" onClick={() => void conferirAgora()} disabled={ocupado}>Conferir agora</button></div>
        </div>
      )}

      {verificado && <span className="at-rs__por">Pronto: os e-mails dos seus sistemas saem de <b>{s.remetente}</b>. “Esqueci minha senha”, convites e avisos chegam para qualquer pessoa, até 100 por dia no plano grátis.</span>}
    </div>
  )
}
