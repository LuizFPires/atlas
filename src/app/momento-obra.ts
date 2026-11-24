// M41 — a obra nunca fica no escuro (protótipo O1–O4 aprovado pelo Luiz em 24/11/2026: "não pode ficar no escuro ... o usuário
// tem que ter a oportunidade de tomar uma ação"). Em qualquer situação: um selo (4 estados), uma frase do que está acontecendo e
// pelo menos uma ação. Trava do próprio Atlas nunca vira "precisa de você": depois das tentativas do vigia é "com defeito".
import type { EstadoObra, Situacao } from './ponte-painel'

export type NivelObra = 'trabalhando' | 'esperando' | 'precisa' | 'defeito' | 'pausada' | 'pronta'
/** tentar: religar já · continuar: tirar a pausa · planos: site de planos do Claude · esperar: fica como está · ajuda: Ajuda do
 *  Atlas · contas: ligar a conta pedida · diario: ver o diário completo · ok: liberar a próxima etapa · teste: versão de teste */
export type AcaoObra = 'tentar' | 'continuar' | 'planos' | 'esperar' | 'ajuda' | 'contas' | 'diario' | 'ok' | 'teste'

export interface MomentoObra {
  nivel: NivelObra
  selo: string
  rotulo: string
  titulo: string
  texto: string
  fala?: string
  conta?: string
  sinal?: string
  acoes: AcaoObra[]
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
function duracao(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
function sinalHa(iso: string | null | undefined, agora: Date): string | undefined {
  if (!iso) return undefined
  const s = Math.max(0, Math.round((agora.getTime() - Date.parse(iso)) / 1000))
  if (!Number.isFinite(s)) return undefined
  return s < 60 ? `Último sinal há ${s} s` : `Último sinal há ${duracao(s * 1000)}`
}

export function momentoDaObra(e: EstadoObra, sit: Situacao, agora: Date = new Date()): MomentoObra {
  if (sit === 'concluida') return { nivel: 'pronta', selo: 'Obra concluída', rotulo: 'OBRA PRONTA', titulo: 'A obra está pronta.', texto: 'Falta só escolher onde o seu sistema vai morar.', acoes: ['teste'] }
  if (sit === 'pausada') return { nivel: 'pausada', selo: 'Pausada por você', rotulo: 'PAUSADA', titulo: 'Você pausou a obra.', texto: 'Nada se perde. Quando quiser, ela continua exatamente de onde parou.', acoes: ['continuar'] }
  if (sit === 'cota') {
    const volta = e.voltaEm && Number.isFinite(Date.parse(e.voltaEm)) ? e.voltaEm : null
    const falta = volta ? Date.parse(volta) - agora.getTime() : null
    return {
      nivel: 'esperando', selo: 'Esperando', rotulo: 'PAROU · NÃO É ERRO',
      titulo: volta ? `A cota do seu plano do Claude acabou. A obra volta sozinha às ${hora(volta)}.` : 'A cota do seu plano do Claude acabou. A obra volta sozinha quando a cota renovar.',
      texto: `${falta !== null && falta > 0 ? `Faltam ${duracao(falta)}. ` : ''}Você não precisa fazer nada. Se quiser acelerar, um plano maior do Claude dá mais cota e a obra anda mais rápido. A troca é feita no site do Claude, na sua conta.`,
      acoes: ['planos', 'esperar'],
    }
  }
  if (sit === 'espera-ok') return { nivel: 'precisa', selo: 'Precisa de você', rotulo: 'ESPERANDO O SEU OK', titulo: e.etapaPronta ? `Ficou pronta a etapa M${e.etapaPronta.n} · ${e.etapaPronta.nome}.` : 'Uma etapa ficou pronta.', texto: 'Dê uma olhada na versão de teste e diga quando posso seguir para a próxima.', acoes: ['teste', 'ok'] }
  if (sit === 'precisa-de-voce' || sit === 'billing') return { nivel: 'precisa', selo: 'Precisa de você', rotulo: 'PRECISA DE VOCÊ', titulo: sit === 'billing' ? 'Uma cobrança ou um acesso de uma conta sua precisa de atenção.' : 'A obra precisa de uma coisa que só você pode fazer.', texto: 'O Atlas explica o passo a passo. Resolvendo, a obra continua sozinha.', acoes: ['ajuda'] }

  const v = e.vigia
  if (v && v.situacao === 'tentando') {
    return { nivel: 'esperando', selo: 'Esperando', rotulo: 'PAROU SOZINHA', titulo: 'A obra parou sozinha. O Atlas já está cuidando disso.', texto: `${v.motivo} Vou religar sozinho${v.proximaEm ? ` às ${hora(v.proximaEm)}` : ''} (tentativa ${Math.min(v.tentativa + 1, v.de)} de ${v.de}).`, acoes: ['tentar', 'diario'] }
  }
  if (v && v.situacao === 'precisa-voce' && v.tentativa > 0) {
    return { nivel: 'defeito', selo: 'Com defeito', rotulo: `O ATLAS TENTOU ${v.tentativa} ${v.tentativa === 1 ? 'VEZ' : 'VEZES'}`, titulo: 'A obra parou. O Atlas não conseguiu continuar sozinho.', texto: `${v.motivo} A Ajuda do Atlas já sabe o que aconteceu e resolve com você.`, acoes: ['ajuda', 'tentar', 'diario'] }
  }
  if (v && v.situacao === 'precisa-voce') {
    return { nivel: 'precisa', selo: 'Precisa de você', rotulo: 'PRECISA DE VOCÊ', titulo: v.motivo || 'A obra está esperando você.', texto: 'Assim que resolver, a obra continua sozinha.', ...(v.fala ? { fala: v.fala } : {}), ...(v.conta ? { conta: v.conta } : {}), acoes: v.conta ? ['contas', 'ajuda'] : ['ajuda', 'tentar'] }
  }
  const quem = e.agora[0]
  if (quem) return { nivel: 'trabalhando', selo: 'Trabalhando', rotulo: 'AGORA NA OBRA', titulo: quem.oque, texto: 'Tudo certo. A equipe está trabalhando, e o Atlas confere sozinho, a cada minuto, se ela continua andando.', sinal: sinalHa(e.sinal, agora), acoes: ['diario'] }
  return { nivel: 'esperando', selo: 'Esperando', rotulo: 'NINGUÉM TRABALHANDO', titulo: 'Ninguém trabalhando agora.', texto: 'O Atlas confere a cada minuto e religa sozinho. Se preferir, religue agora.', acoes: ['tentar', 'diario'] }
}
