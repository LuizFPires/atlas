// Porta das OCORRÊNCIAS (F11): o ÚNICO tipo de parada que exige o cliente (nota u11). Liga no livro de ocorrências do kit
// (.claude/hooks/ocorrencias.cjs, docs/ocorrencias.json) da obra: `ocorrenciaDoKit` traduz uma entrada aberta para a tela.
// Vale nos DOIS modos da obra: mesmo no automático ela para e chama o cliente (é a trava real).
// Aqui só existe o mock do modo fixture; o adaptador real é pendência de /entregar (app/PENDENTE-ENTREGAR.md, M20).
// Motivo, ação e passos podem vir de serviços externos: são DADO (escapados, nunca executados, sem link nem imagem vindos de dado).
// Nenhum segredo fica em arquivo: a chave que o cliente cola vai direto ao cofre pelo adaptador.

import { textoDaObra } from './ponte-cota'

export interface PassoOcorrencia {
  titulo: string
  desc: string
  /** Legenda do print do passo (o print em si vem do adaptador real; a tela desenha um quadro, nunca uma URL vinda de dado). */
  print?: string
}

export interface Ocorrencia {
  id: number
  /** "Conecte o WhatsApp da barbearia". */
  titulo: string
  /** Por que só o cliente pode resolver. */
  motivo: string
  minutos: number
  passos: PassoOcorrencia[]
  /** Campo para colar uma chave/credencial (vai ao cofre, nunca a arquivo). */
  campo?: { rotulo: string; dica: string }
}

export interface AvisoEnviado { celular: boolean; email: boolean }

export interface PonteOcorrencias {
  /** A ocorrência aberta que exige o cliente nesta obra; null se não há. */
  ler(pasta: string): Promise<Ocorrencia | null>
  /** Manda o passo a passo ao celular e ao e-mail (uma vez por ocorrência; repetir não manda de novo). */
  avisar(pasta: string, id: number): Promise<AvisoEnviado>
  /** O cliente fez: fecha a ocorrência (`resolver` do kit) e a obra continua. A chave, se houver, vai direto ao cofre. */
  resolver(pasta: string, id: number, segredo?: string): Promise<void>
  /** "Fazer depois": a obra segue com o que não depende disso; a ocorrência continua aberta. */
  adiar(pasta: string, id: number): Promise<void>
}

/** Entrada do `docs/ocorrencias.json` do kit (campos que a tela usa). `passos`/`minutos`/`campo` são extensões opcionais. */
export interface EntradaDoKit {
  id: number
  status: string
  servico?: string
  motivo?: string
  acao?: string
  passos?: { titulo?: unknown; desc?: unknown; print?: unknown }[]
  minutos?: unknown
  campo?: { rotulo?: unknown; dica?: unknown }
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** Traduz a entrada do kit para a tela. Tudo vira texto simples de uma linha; sem passos, a "ação" do kit vira o único passo. */
export function ocorrenciaDoKit(o: EntradaDoKit): Ocorrencia | null {
  if (!o || o.status !== 'aberta' || !Number.isInteger(o.id)) return null
  const passos = (Array.isArray(o.passos) ? o.passos : []).slice(0, 12)
    .map((p) => ({ titulo: textoDaObra(str(p?.titulo), 100), desc: textoDaObra(str(p?.desc), 220), print: str(p?.print) ? textoDaObra(str(p?.print), 100) : undefined }))
    .filter((p) => p.titulo)
  const acao = textoDaObra(o.acao, 200)
  const min = typeof o.minutos === 'number' && o.minutos > 0 ? Math.min(Math.round(o.minutos), 240) : 5
  const campo = o.campo && str(o.campo.rotulo) ? { rotulo: textoDaObra(str(o.campo.rotulo), 80), dica: textoDaObra(str(o.campo.dica), 160) } : undefined
  const servico = textoDaObra(o.servico, 60)
  return {
    id: o.id,
    titulo: servico ? `${servico}: precisa de você` : 'Precisa de você',
    motivo: textoDaObra(o.motivo, 400) || 'Só você pode resolver isto, porque é a sua conta.',
    minutos: min,
    passos: passos.length ? passos : acao ? [{ titulo: acao, desc: '' }] : [],
    campo,
  }
}

export interface OcorrenciasFixture extends PonteOcorrencias {
  readonly chamadas: string[]
  /** O que foi para o celular/e-mail. */
  readonly avisos: { id: number; canal: 'celular' | 'email' }[]
  /** Quantas vezes uma chave foi entregue ao cofre (o valor NUNCA é guardado). */
  segredosEntregues: number
  readonly simular: {
    abrir(o: Ocorrencia): void
  }
}

/** `aoMudar` liga o mock ao painel do fixture (parada 'voce' liga/desliga). */
export function criarOcorrenciasFixture(aoMudar?: (precisaDeVoce: boolean) => void, opcoes: { semAviso?: boolean } = {}): OcorrenciasFixture {
  const chamadas: string[] = []
  const avisos: { id: number; canal: 'celular' | 'email' }[] = []
  let aberta: Ocorrencia | null = null
  const f: OcorrenciasFixture = {
    chamadas,
    avisos,
    segredosEntregues: 0,
    simular: { abrir(o) { aberta = o; aoMudar?.(true) } },
    async ler() { chamadas.push('ler'); return aberta ? structuredClone(aberta) : null },
    async avisar(_p, id) {
      if (opcoes.semAviso) return { celular: false, email: false }
      if (!avisos.some((a) => a.id === id)) { chamadas.push('avisar'); avisos.push({ id, canal: 'celular' }, { id, canal: 'email' }) }
      return { celular: true, email: true }
    },
    async resolver(_p, id, segredo) {
      if (!aberta || aberta.id !== id) throw new Error('ocorrencia-inexistente')
      chamadas.push('resolver')
      if (segredo) f.segredosEntregues++
      aberta = null
      aoMudar?.(false)
    },
    async adiar(_p, id) {
      if (!aberta || aberta.id !== id) throw new Error('ocorrencia-inexistente')
      chamadas.push('adiar')
      aoMudar?.(false)
    },
  }
  return f
}

/** Exemplo do protótipo F11 (WhatsApp da barbearia). */
export const OCORRENCIA_EXEMPLO: Ocorrencia = {
  id: 2,
  titulo: 'Conecte o WhatsApp da barbearia',
  motivo: 'Para mandar a confirmação dos horários, o sistema precisa de uma chave do WhatsApp Business. Só você pode criar, porque é a sua conta. O resto da obra continua enquanto isso.',
  minutos: 5,
  passos: [
    { titulo: 'Abra o Meta Business', desc: 'O Atlas já abriu a página certa no seu navegador.', print: 'Página inicial do Meta Business' },
    { titulo: 'Entre com o Facebook da barbearia', desc: 'Use a mesma conta da página da barbearia.', print: 'Tela de entrada com o Facebook' },
    { titulo: 'Toque em "Criar chave de acesso"', desc: 'Escolha "WhatsApp" e confirme o número da barbearia.', print: 'Botão Criar chave de acesso' },
    { titulo: 'Copie a chave e cole ao lado', desc: 'É um texto longo que começa com "EAA".', print: 'Chave gerada, pronta para copiar' },
  ],
  campo: { rotulo: 'Chave do WhatsApp Business', dica: 'Fica guardada só no seu computador e na sua conta. O Atlas não vê.' },
}

/** Sem adaptador real e fora do modo fixture: não finge. */
export const ocorrenciasIndisponivel: PonteOcorrencias = {
  async ler() { throw new Error('indisponivel') },
  async avisar() { throw new Error('indisponivel') },
  async resolver() { throw new Error('indisponivel') },
  async adiar() { throw new Error('indisponivel') },
}
