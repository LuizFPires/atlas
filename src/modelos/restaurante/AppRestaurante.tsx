// App-modelo RESTAURANTE — ponto de entrada: confere a licença com o guardião ANTES de mostrar qualquer dado do negócio.
// Produção: guardião real (bloqueia com aviso honesto se a licença não confere). modoFixture(): libera (demonstração).
import { useEffect, useMemo, useState } from 'react'
import { criarPonteFixture, type PonteDesktop } from '../../app/ponte'
import { guardiaoPadrao, type PortaGuardiao, type VeredictoGuardiao } from '../../app/guardiao'
import { Cardapio } from './Cardapio'
import { Cozinha } from './Cozinha'
import { Pedidos } from './Pedidos'
import { Restaurante, avisoDeLicenca, Marca, type LicencaDoApp } from './Restaurante'
import { criarDadosFixture, type PortaDados } from './dados'
import { criarComandaFixture, type PortaComanda } from './comanda'
import { PERSONALIZACAO_EXEMPLO, personalizacaoSegura, variaveisDoTema, type PersonalizacaoApp } from './personalizacao'

export const LICENCA_EXEMPLO: LicencaDoApp = { cliente: 'Dona Maria Restaurante', marca: 'fixture-marca-0123456789ab' }

interface Props {
  personalizacao?: PersonalizacaoApp
  licenca?: LicencaDoApp
  dados?: PortaDados
  comanda?: PortaComanda
  /** Para testes; por padrão usa o guardião do ambiente (real em produção, fixture em desenvolvimento). */
  guardiao?: PortaGuardiao
  ponte?: Pick<PonteDesktop, 'cofre' | 'hashComputador'>
}

export function AppRestaurante({ personalizacao = PERSONALIZACAO_EXEMPLO, licenca = LICENCA_EXEMPLO, dados, comanda, guardiao, ponte }: Props) {
  const [veredito, setVeredito] = useState<VeredictoGuardiao | null>(null)
  const dadosUsados = useMemo(() => dados ?? criarDadosFixture(), [dados])
  const comandaUsada = useMemo(() => comanda ?? criarComandaFixture(), [comanda])
  const g = useMemo(
    () => guardiao ?? guardiaoPadrao(ponte ?? window.atlasDesktop ?? criarPonteFixture()),
    [guardiao, ponte],
  )
  useEffect(() => {
    let vivo = true
    g.conferir().then((v) => { if (vivo) setVeredito(v) }).catch(() => {
      // Falha inesperada do guardião: fecha (não libera por erro).
      if (vivo) setVeredito({ estado: 'bloqueado', mensagem: 'Não conseguimos confirmar a licença deste app agora: a internet ou o servidor não respondeu. Confira a conexão e tente de novo em alguns minutos.' })
    })
    return () => { vivo = false }
  }, [g])

  const p = personalizacaoSegura(personalizacao)
  if (!veredito || veredito.estado === 'bloqueado') {
    // Sem dado nenhum do negócio: só o aviso e a mensagem.
    return (
      <div className="rt" data-testid="app-restaurante-bloqueado" style={variaveisDoTema(p)}>
        <p className="rt-aviso" role="note">{avisoDeLicenca(licenca)}</p>
        <div className="rt-bloqueio">
          {!veredito
            ? <p role="status" className="rt-mute">Conferindo a licença…</p>
            : <><h1 className="rt-nome">App bloqueado</h1><p role="alert">{veredito.mensagem}</p></>}
        </div>
        <Marca licenca={licenca} />
      </div>
    )
  }
  return (
    <Restaurante
      personalizacao={personalizacao}
      licenca={licenca}
      telas={{
        cardapio: <Cardapio dados={dadosUsados} />,
        pedidos: <Pedidos dados={dadosUsados} />,
        cozinha: <Cozinha dados={dadosUsados} comanda={comandaUsada} />,
      }}
    />
  )
}
