// App-modelo BARBEARIA — ponto de entrada: confere a licença com o guardião ANTES de mostrar qualquer dado do negócio.
// Produção: guardião real (bloqueia com aviso honesto se a licença não confere). modoFixture(): libera (demonstração).
import { useEffect, useMemo, useState } from 'react'
import { criarPonteFixture, type PonteDesktop } from '../../app/ponte'
import { guardiaoPadrao, type PortaGuardiao, type VeredictoGuardiao } from '../../app/guardiao'
import { Agenda } from './Agenda'
import { Barbearia, avisoDeLicenca, Marca, type LicencaDoApp } from './Barbearia'
import { criarDadosFixture, diaDeHoje, type PortaDados } from './dados'
import { criarEnvioFixture, type PortaEnvio } from './lembretes'
import { Clientes } from './Clientes'
import { PERSONALIZACAO_EXEMPLO, personalizacaoSegura, variaveisDoTema, type PersonalizacaoApp } from './personalizacao'

export const LICENCA_EXEMPLO: LicencaDoApp = { cliente: 'Zé da Barbearia', marca: 'fixture-marca-0123456789ab' }

interface Props {
  personalizacao?: PersonalizacaoApp
  licenca?: LicencaDoApp
  dados?: PortaDados
  envio?: PortaEnvio
  /** Para testes; por padrão usa o guardião do ambiente (real em produção, fixture em desenvolvimento). */
  guardiao?: PortaGuardiao
  ponte?: Pick<PonteDesktop, 'cofre' | 'hashComputador'>
}

export function AppBarbearia({ personalizacao = PERSONALIZACAO_EXEMPLO, licenca = LICENCA_EXEMPLO, dados, envio, guardiao, ponte }: Props) {
  const [veredito, setVeredito] = useState<VeredictoGuardiao | null>(null)
  const dadosUsados = useMemo(() => dados ?? criarDadosFixture(), [dados])
  const envioUsado = useMemo(() => envio ?? criarEnvioFixture(), [envio])
  const g = useMemo(
    () => guardiao ?? guardiaoPadrao(ponte ?? window.atlasDesktop ?? criarPonteFixture()),
    [guardiao, ponte],
  )
  useEffect(() => {
    let vivo = true
    g.conferir().then((v) => { if (vivo) setVeredito(v) }).catch(() => {
      // Falha inesperada do guardião: fecha (não libera por erro).
      if (vivo) setVeredito({ estado: 'bloqueado', mensagem: 'Não conseguimos confirmar a licença deste app agora. Tente de novo em instantes.' })
    })
    return () => { vivo = false }
  }, [g])

  const p = personalizacaoSegura(personalizacao)
  if (!veredito || veredito.estado === 'bloqueado') {
    // Sem dado nenhum do negócio: só o aviso e a mensagem.
    return (
      <div className="bb" data-testid="app-barbearia-bloqueado" style={variaveisDoTema(p)}>
        <p className="bb-aviso" role="note">{avisoDeLicenca(licenca)}</p>
        <div className="bb-bloqueio">
          {!veredito
            ? <p role="status" className="bb-mute">Conferindo a licença…</p>
            : <><h1 className="bb-nome">App bloqueado</h1><p role="alert">{veredito.mensagem}</p></>}
        </div>
        <Marca licenca={licenca} />
      </div>
    )
  }
  return (
    <Barbearia
      personalizacao={personalizacao}
      licenca={licenca}
      telas={{
        agenda: <Agenda dados={dadosUsados} dia={diaDeHoje()} nomeNegocio={p.nome} envio={envioUsado} />,
        clientes: <Clientes dados={dadosUsados} />,
      }}
    />
  )
}
