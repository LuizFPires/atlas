// App-modelo ACADEMIA — ponto de entrada: confere a licença com o guardião ANTES de mostrar qualquer dado do negócio.
// Produção: guardião real (bloqueia com aviso honesto se a licença não confere). modoFixture(): libera (demonstração).
import { useEffect, useMemo, useState } from 'react'
import { criarPonteFixture, type PonteDesktop } from '../../app/ponte'
import { guardiaoPadrao, type PortaGuardiao, type VeredictoGuardiao } from '../../app/guardiao'
import { Alunos } from './Alunos'
import { Treino } from './Treino'
import { Checkin } from './Checkin'
import { Evolucao } from './Evolucao'
import { Academia, avisoDeLicenca, Marca, type LicencaDoApp } from './Academia'
import { criarDadosFixture, type PortaDados } from './dados'
import { PERSONALIZACAO_EXEMPLO, personalizacaoSegura, variaveisDoTema, type PersonalizacaoApp } from './personalizacao'

export const LICENCA_EXEMPLO: LicencaDoApp = { cliente: 'Corpo em Dia Academia', marca: 'fixture-marca-0123456789ab' }

interface Props {
  personalizacao?: PersonalizacaoApp
  licenca?: LicencaDoApp
  dados?: PortaDados
  /** Dia de "hoje" (AAAA-MM-DD) para testes; por padrão é o dia LOCAL do computador. */
  hoje?: string
  /** Para testes; por padrão usa o guardião do ambiente (real em produção, fixture em desenvolvimento). */
  guardiao?: PortaGuardiao
  ponte?: Pick<PonteDesktop, 'cofre' | 'hashComputador'>
}

export function AppAcademia({ personalizacao = PERSONALIZACAO_EXEMPLO, licenca = LICENCA_EXEMPLO, dados, hoje, guardiao, ponte }: Props) {
  const [veredito, setVeredito] = useState<VeredictoGuardiao | null>(null)
  const [alunoId, setAlunoId] = useState<string | null>(null)
  const dadosUsados = useMemo(() => dados ?? criarDadosFixture(hoje), [dados, hoje])
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
      <div className="ac" data-testid="app-academia-bloqueado" style={variaveisDoTema(p)}>
        <p className="ac-aviso" role="note">{avisoDeLicenca(licenca)}</p>
        <div className="ac-bloqueio">
          {!veredito
            ? <p role="status" className="ac-mute">Conferindo a licença…</p>
            : <><h1 className="ac-nome">App bloqueado</h1><p role="alert">{veredito.mensagem}</p></>}
        </div>
        <Marca licenca={licenca} />
      </div>
    )
  }
  return (
    <Academia
      personalizacao={personalizacao}
      licenca={licenca}
      telas={{
        alunos: (ir) => <Alunos dados={dadosUsados} escolhido={alunoId} onEscolher={setAlunoId} onIrTreino={() => ir('treino')} />,
        treino: <Treino key={alunoId} dados={dadosUsados} alunoId={alunoId} />,
        checkin: <Checkin dados={dadosUsados} hoje={hoje} />,
        evolucao: <Evolucao key={alunoId} dados={dadosUsados} alunoId={alunoId} hoje={hoje} />,
      }}
    />
  )
}
