import { useState } from 'react'
import { Botao, Icone } from '../ui'
import { LateralPassos } from './Ativacao'
import { criarArmazemLocal, type ArmazemPrefs, type Frequencia, type IdAviso, type PonteCelular, type PrefsCelular } from './ponte-celular'
import './app.css'
import './claude.css'
import './contas.css'
import './celular.css'

interface Props {
  celular: PonteCelular
  /** Onde as preferências ficam guardadas. Padrão: configuração local do app (não é segredo). */
  armazem?: ArmazemPrefs
  /** E-mail da conta do Claude do cliente (só para mostrar). */
  conta?: string
  onVoltar: () => void
  /** Fecha o começo e vai para as obras. */
  onConcluir: () => void
}

/** Frequências (id, nome, quando chega a próxima notícia no exemplo do protótipo, que mostra 15h). */
export const FREQUENCIAS: { id: Frequencia; nome: string; proxima: string }[] = [
  { id: '30m', nome: 'A cada 30 min', proxima: '15h30' },
  { id: '1h', nome: 'A cada 1 hora', proxima: '16h' },
  { id: '3h', nome: 'A cada 3 horas', proxima: '18h' },
  { id: 'etapa', nome: 'Só quando terminar uma etapa', proxima: 'quando a etapa 5 terminar' },
]

export const AVISOS: { id: IdAviso; nome: string }[] = [
  { id: 'precisa', nome: 'Me avisar quando a obra precisar de mim' },
  { id: 'etapa', nome: 'Me avisar quando uma etapa terminar' },
  { id: 'fim', nome: 'Me avisar quando a obra ficar pronta' },
]

/** Quadradinho de exemplo do protótipo. O QR de verdade (do endereço da ponte) é pendência de /entregar. */
function Qr({ endereco }: { endereco: string }) {
  return (
    <svg className="at-cel__qr" width="84" height="84" viewBox="0 0 21 21" role="img" aria-label="QR code para baixar o app do Claude" data-endereco={endereco}>
      <path d="M0 0h7v7H0zM14 0h7v7h-7zM0 14h7v7H0z" fill="#141619" />
      <path d="M1 1h5v5H1zM15 1h5v5h-5zM1 15h5v5H1z" fill="#FFFFFF" />
      <path d="M2 2h3v3H2zM16 2h3v3h-3zM2 16h3v3H2zM9 1h2v2H9zM8 8h3v2H8zM12 10h2v1h-2zM15 9h1v3h-1zM18 8h2v1h-2zM8 13h1v3H8zM11 12h3v1h-3zM16 14h3v2h-3zM10 16h2v2h-2zM14 17h1v3h-1zM17 18h3v1h-3zM9 19h3v1H9z" fill="#141619" />
    </svg>
  )
}

/** F04b: computador ligado, acompanhe pelo celular (prototipo/F04bCelular). */
export function Celular({ celular, armazem, conta = 'zé@barbeariadoze.com.br', onVoltar, onConcluir }: Props) {
  const [guardado] = useState<ArmazemPrefs>(() => armazem ?? criarArmazemLocal())
  const [prefs, setPrefs] = useState<PrefsCelular>(() => guardado.ler())
  const [aviso, setAviso] = useState('')

  /** Guarda no app e passa para a sessão do computador. Se a conexão ainda não existe, a escolha fica guardada e o cliente é avisado com calma. */
  const mudar = (nova: PrefsCelular) => {
    setPrefs(nova)
    guardado.guardar(nova)
    setAviso('')
    celular.aplicar(nova).catch(() => setAviso('Guardei a sua escolha. O celular ainda não está ligado ao computador; assim que ligar, eu uso ela.'))
  }
  const proxima = (FREQUENCIAS.find((f) => f.id === prefs.frequencia) ?? FREQUENCIAS[1]).proxima

  return (
    <div className="at-ativ-fundo">
      <div className="at-ativ at-contas at-cel">
        <LateralPassos agora={5} />
        <section className="at-cel__corpo">
          <div className="at-cel__col">
            <div className="at-claude__cab">
              <span className="at-claude__rotulo">ÚLTIMO PASSO</span>
              <h1>Deixe o computador ligado e acompanhe pelo app do Claude, de onde estiver.</h1>
              <span className="at-ativ__txt">O computador é o <b>canteiro</b>: é nele que ficam os arquivos e as ferramentas do seu sistema. Por isso ele precisa ficar ligado durante a obra. Mas você não precisa ficar na frente dele. Pelo <b>app do Claude no celular</b> você vê tudo e dá ordens, de onde estiver.</span>
            </div>
            <div className="at-cel__cartao at-cel__cartao--linha">
              <Qr endereco={celular.enderecoApp()} />
              <div className="at-cel__txt">
                <b>1. Baixe o app do Claude no celular</b>
                <span>Aponte a câmera para o quadradinho. Entre com a mesma conta: <b>{conta}</b>. Pronto: suas obras aparecem lá sozinhas.</span>
              </div>
            </div>
            <div className="at-cel__cartao">
              <b>2. De quanto em quanto tempo você quer notícias da obra?</b>
              <div className="at-cel__freqs" role="radiogroup" aria-label="Frequência das notícias">
                {FREQUENCIAS.map((f) => (
                  <button key={f.id} type="button" role="radio" aria-checked={prefs.frequencia === f.id} className={`at-cel__freq ${prefs.frequencia === f.id ? 'at-cel__freq--on' : ''}`} onClick={() => mudar({ ...prefs, frequencia: f.id })}>{f.nome}</button>
                ))}
              </div>
              <div className="at-cel__avisos">
                {AVISOS.map((a) => (
                  <button key={a.id} type="button" role="switch" aria-checked={prefs.avisos[a.id]} className="at-cel__aviso" onClick={() => mudar({ ...prefs, avisos: { ...prefs.avisos, [a.id]: !prefs.avisos[a.id] } })}>
                    <span className="at-cel__trilho" aria-hidden="true" />{a.nome}
                  </button>
                ))}
              </div>
              <span className="at-cel__nota">Pelo celular você também pode responder falando: "pausa a obra", "troca a cor do botão", "como está?".</span>
            </div>
            {aviso && <p className="at-cel__aviso-geral" role="status">{aviso}</p>}
            <div className="at-ativ__rodape at-cel__rodape">
              <Botao variante="secundario" onClick={onVoltar}>← Voltar</Botao>
              <Botao onClick={onConcluir}>Concluir e ir para as obras →</Botao>
            </div>
          </div>
          <div className="at-cel__lado">
            <span className="at-cel__nota">Assim chega no seu celular:</span>
            <div className="at-cel__cel" role="img" aria-label="Exemplo do que chega no celular">
              <div className="at-cel__tela">
                <div className="at-cel__topo">
                  <div className="at-cel__status"><span>15:00</span><span>5G</span></div>
                  <div className="at-cel__push">
                    <div className="at-cel__push-cab"><b>Claude</b><span>agora</span></div>
                    <span><b>Notícia das 15h</b> · Agenda da Barbearia do Zé: 62% pronta.</span>
                  </div>
                </div>
                <div className="at-cel__titulo">Agenda da Barbearia do Zé</div>
                <div className="at-cel__conversa">
                  <div className="at-cel__bolha">
                    <b>Notícia das 15h</b>
                    <span className="at-cel__linha"><Icone nome="check" tamanho={13} /> Tela de marcar horário pronta e testada.</span>
                    <span className="at-cel__linha"><Icone nome="martelo" tamanho={13} /> Agora: confirmação pelo WhatsApp (etapa 5 de 8).</span>
                    <span className="at-cel__linha"><Icone nome="relogio" tamanho={13} /> Faltam umas 9 h de obra.</span>
                    <span>Próxima notícia: {proxima}.</span>
                  </div>
                  <div className="at-cel__bolha at-cel__bolha--eu">
                    <span className="at-cel__falado"><Icone nome="microfone" tamanho={11} /> falado</span>
                    Beleza. Coloca o botão de marcar em marrom, igual a fachada.
                  </div>
                  <div className="at-cel__bolha">Anotado! Faço isso logo depois desta etapa e te mostro antes de colocar no ar.</div>
                </div>
                <div className="at-cel__resp"><span>Responder…</span><span className="at-cel__mic"><Icone nome="microfone" tamanho={16} /></span></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
