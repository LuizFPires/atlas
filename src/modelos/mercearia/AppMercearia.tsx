// App-modelo MERCEARIA — ponto de entrada: confere a licença com o guardião ANTES de mostrar qualquer dado do negócio.
// Produção: guardião real (bloqueia com aviso honesto se a licença não confere). modoFixture(): libera (demonstração).
import { useEffect, useMemo, useState } from 'react'
import { criarPonteFixture, type PonteDesktop } from '../../app/ponte'
import { guardiaoPadrao, type PortaGuardiao, type VeredictoGuardiao } from '../../app/guardiao'
import { Estoque } from './Estoque'
import { Vender } from './Vender'
import { Avisos } from './Avisos'
import { Mercearia, avisoDeLicenca, Marca, type LicencaDoApp } from './Mercearia'
import { criarDadosFixture, type PortaDados } from './dados'
import { criarCupomFixture, type PortaCupom } from './cupom'
import { PERSONALIZACAO_EXEMPLO, personalizacaoSegura, variaveisDoTema, type PersonalizacaoApp } from './personalizacao'

export const LICENCA_EXEMPLO: LicencaDoApp = { cliente: 'Seu Zé Mercearia', marca: 'fixture-marca-0123456789ab' }

interface Props {
  personalizacao?: PersonalizacaoApp
  licenca?: LicencaDoApp
  dados?: PortaDados
  cupom?: PortaCupom
  /** Para testes; por padrão usa o guardião do ambiente (real em produção, fixture em desenvolvimento). */
  guardiao?: PortaGuardiao
  ponte?: Pick<PonteDesktop, 'cofre' | 'hashComputador'>
}

export function AppMercearia({ personalizacao = PERSONALIZACAO_EXEMPLO, licenca = LICENCA_EXEMPLO, dados, cupom, guardiao, ponte }: Props) {
  const [veredito, setVeredito] = useState<VeredictoGuardiao | null>(null)
  const dadosUsados = useMemo(() => dados ?? criarDadosFixture(), [dados])
  const cupomUsado = useMemo(() => cupom ?? criarCupomFixture(), [cupom])
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
      <div className="mc" data-testid="app-mercearia-bloqueado" style={variaveisDoTema(p)}>
        <p className="mc-aviso" role="note">{avisoDeLicenca(licenca)}</p>
        <div className="mc-bloqueio">
          {!veredito
            ? <p role="status" className="mc-mute">Conferindo a licença…</p>
            : <><h1 className="mc-nome">App bloqueado</h1><p role="alert">{veredito.mensagem}</p></>}
        </div>
        <Marca licenca={licenca} />
      </div>
    )
  }
  return (
    <Mercearia
      personalizacao={personalizacao}
      licenca={licenca}
      telas={{
        estoque: <Estoque dados={dadosUsados} />,
        vender: <Vender dados={dadosUsados} cupom={cupomUsado} />,
        avisos: <Avisos dados={dadosUsados} />,
      }}
    />
  )
}
