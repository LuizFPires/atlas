import './web.css'

/** Retorno da Stripe para quem comprou de DENTRO do Atlas instalado (checkout com origem "app").
 *  A licença vira paga pelo webhook e o app percebe sozinho: aqui não há cadastro nem novo e-mail de instalação. */
export function CompraPeloApp({ cancelada = false }: { cancelada?: boolean }) {
  return (
    <div className="v v-confirmar">
      <div className="v-modal" style={{ margin: '12vh auto 0' }}>
        {cancelada ? (
          <>
            <h2>Nada foi cobrado.</h2>
            <p>Quando quiser, é só clicar de novo em Quero o Atlas, dentro do Atlas.</p>
          </>
        ) : (
          <>
            <h2>Pagamento confirmado.</h2>
            <p>Pode voltar para o Atlas: ele já sabe que você comprou.</p>
            <p className="v-mute">Se pagou com Pix, a confirmação pode levar alguns minutos para chegar ao Atlas.</p>
          </>
        )}
      </div>
    </div>
  )
}
