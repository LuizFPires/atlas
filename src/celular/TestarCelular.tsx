// Testar a ideia no celular (protótipo aprovado pelo Luiz em 28/11/2026): o cartão na obra e logo depois de aprovar as telas, e a
// tela do teste, que usa as MESMAS telas do computador (Praça, relatório, entrevistas, ideias) ligadas ao notebook.
import { useMemo } from 'react'
import { Icone } from '../ui/Icone'
import { TestarIdeia } from '../app/TestarIdeia'
import type { ResumoTesteCelular } from '../app/teste-celular'
import type { ApiCelular, EstadoCelular } from './api'
import { criarPonteTestarCelular } from './ponte-testar-celular'

const mil = (n: number) => n.toLocaleString('pt-BR')

/** O cartão: convite (sem teste), andamento (rodando) ou o último resultado. */
export function CartaoTestar({ resumo, nome, convite = false, onAbrir }: { resumo: ResumoTesteCelular | null; nome: string; convite?: boolean; onAbrir: () => void }) {
  const ultimo = resumo?.testes[0] ?? null
  const pronto = resumo?.testes.find((t) => t.estado === 'pronto' && t.termometro) ?? null
  if (ultimo && ultimo.estado !== 'pronto') {
    return (
      <button type="button" className="cel-cartao cel-testar" onClick={onAbrir}>
        <span className="cel-rotulo" style={{ color: 'var(--lime)' }}>Testar a ideia · teste {ultimo.n}</span>
        <b>{ultimo.estado === 'pausado-cota' ? 'Pausado: a cota do Claude acabou' : 'Os agentes estão olhando as telas'}</b>
        <span className="cel-sub"><span className="cel-ponto cel-ponto--vivo" />{mil(ultimo.feitos)} de {mil(ultimo.quantidade)} agentes · toque para ver ao vivo</span>
      </button>
    )
  }
  if (pronto?.termometro) {
    const t = pronto.termometro
    return (
      <button type="button" className="cel-cartao cel-testar" onClick={onAbrir}>
        <span className="cel-rotulo">Testar a ideia · teste {pronto.n}{pronto.versao ? ` · protótipo ${pronto.versao}` : ''}</span>
        <span className="cel-testar__res"><b>{t.pctUsaria}%</b><span className="cel-testar__bar"><i style={{ width: `${t.pctUsaria}%`, background: '#4C8DFF' }} /><i style={{ width: `${t.pctNao}%`, background: '#FF5A4E', marginLeft: 'auto' }} /></span></span>
        <span className="cel-sub">dos agentes de IA usariam{pronto.maisContra ? ` · mais citado contra: ${pronto.maisContra}` : ''}</span>
        <span className="cel-sub" style={{ color: 'var(--lime)' }}>Ver o relatório e testar de novo <Icone nome="chevron" /></span>
      </button>
    )
  }
  return (
    <div className={`cel-cartao cel-testar${convite ? ' cel-testar--convite' : ''}`}>
      <span className="cel-rotulo" style={{ color: 'var(--lime)' }}>{convite ? 'O Atlas sugere · antes de construir' : 'Testar a ideia'}</span>
      <b style={{ fontSize: 19, lineHeight: 1.3 }}>Quer ver como 500 clientes reagem {nome ? `ao ${nome}` : 'à sua ideia'}?</b>
      <span className="cel-texto" style={{ fontSize: 14 }}>O notebook cria 500 pessoas diferentes, mostra as telas para cada uma e conta o que acharam: o que agradou, o que incomodou e quanto pagariam.</span>
      <span className="cel-testar__tags"><span>≈ 25 MIN</span><span>USA A SUA COTA</span><span>PODE BLOQUEAR O CELULAR</span></span>
      <button type="button" className="cel-botao cel-botao--sec" onClick={onAbrir}>Testar a ideia →</button>
      <span className="cel-sub" style={{ fontSize: 12 }}>São agentes de IA, não pessoas reais: um termômetro, não pesquisa de mercado. O Atlas não recomenda nem garante nada.</span>
    </div>
  )
}

/** A tela do teste no celular. `ler` = leitura do estado com cache (uma por vez para todas as partes da tela). */
export function TelaTestar({ api, obraId, nome, ler, ligado, onVoltar }: { api: ApiCelular; obraId: string; nome: string; ler: (forcar?: boolean) => Promise<EstadoCelular>; ligado: boolean; onVoltar: () => void }) {
  const ponte = useMemo(() => criarPonteTestarCelular(api, obraId, { ler }), [api, obraId, ler])
  return (
    <main className="cel cel-testar-tela">
      <header className="cel-topo">
        <button type="button" className="cel-voltar" aria-label="Voltar para a obra" onClick={onVoltar}><Icone nome="chevron" /></button>
        <span className="cel-rotulo">{nome} · Testar a ideia</span><span style={{ width: 44 }} />
      </header>
      {!ligado && <div className="cel-cartao cel-cartao--aviso" style={{ margin: '0 20px' }}><span style={{ fontSize: 14, lineHeight: 1.45 }}>O notebook está desligado ou com o Atlas fechado. Dá para ver os testes já feitos; um teste novo ou uma entrevista começam quando ele ligar.</span></div>}
      <div className="cel-corpo">
        <TestarIdeia pasta={obraId} nome={nome} ponte={ponte} revisarPrototipo={(p) => ponte.revisarPrototipo(p)} ondeAprovar="no Atlas do computador, na aba Protótipo" />
      </div>
    </main>
  )
}
