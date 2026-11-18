import { Botao } from '../ui'
import { LateralPassos } from './Ativacao'
import type { PonteCelular } from './ponte-celular'
import './app.css'
import './claude.css'
import './contas.css'
import './celular.css'

interface Props {
  celular: PonteCelular
  /** E-mail da conta do Claude do cliente (só para mostrar). */
  conta?: string
  onVoltar: () => void
  /** Fecha o começo e vai para as obras. */
  onConcluir: () => void
}

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
export function Celular({ celular, conta = 'zé@barbeariadoze.com.br', onVoltar, onConcluir }: Props) {
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
            <div className="at-ativ__rodape at-cel__rodape">
              <Botao variante="secundario" onClick={onVoltar}>← Voltar</Botao>
              <Botao onClick={onConcluir}>Concluir e ir para as obras →</Botao>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
