// Casos NÃO resolvidos da Ajuda do Atlas -> painel do administrador (ocorrencias_admin, M7/S9), atrás de uma porta.
// Só o necessário: motivo, onde, passo, erro, a tela e a última fala do cliente. Nunca o histórico inteiro e nunca segredo:
// chave, token, senha, e-mail e parâmetros de endereço são trocados antes de sair do computador.
// Aqui só existe o mock do modo fixture; o adaptador real (servidor, com o token do dispositivo) é pendência de /entregar.

import { textoDaObra } from './ponte-cota'
import { AINDA_NAO_DEU, type ContextoAjuda, type Turno } from './ponte-ajuda'

/** Tira de um texto qualquer coisa que pareça segredo. */
export function tirarSegredos(t: string): string {
  return t
    .replace(/\b(?:sk|pk|rk|ghp|gho|ghu|ghs|github_pat|xox[baprs]|AKIA|EAA)[-_A-Za-z0-9]{8,}/g, '[segredo]')
    .replace(/\beyJ[\w-]{10,}(?:\.[\w-]{5,})*/g, '[segredo]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [segredo]')
    // chave=valor genérico (DB_PASSWORD=x, api key: z, access-token: y); o valor pode vir após um newline
    .replace(/[\w-]*(?:key|token|secret|pass(?:word|wd)?|senha|chave)[\w-]*[ \t]*[:=][ \t]*\n?[ \t]*\S+/gi, '[segredo]')
    // "<valor> como/de senha": apaga também o valor que vem ANTES do gatilho
    .replace(/\S+\s+(?:como|de|é a|e a)\s+(?=(?:senha|password|passwd|pass|chave|token|segredo|secret|pin)(?![A-Za-zÀ-ÿ]))/gi, '[segredo] ')
    // palavra-gatilho: apaga TUDO dali até o fim da frase (melhor apagar demais do que vazar); atravessa newline logo após a palavra
    .replace(/(?<![A-Za-zÀ-ÿ])(senha|password|passwd|pass|chave|api[_ -]?key|access[_ -]?token|secret[_ -]?key|auth[_ -]?token|key|token|segredo|secret|cpf|cnpj|cart[ãa]o|card|c[óo]digo|code|pin|cookie)(?![A-Za-zÀ-ÿ])(?:\s*\n\s*\S+|(?:[^\n.!?]|[.!?](?!\s|$))*)/gi, '$1 [segredo]')
    .replace(/\b\d(?:[ -]?\d){12,18}\b/g, '[segredo]')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[e-mail]')
    .replace(/\b[A-Fa-f0-9]{32,}\b/g, '[segredo]')
    .replace(/\b[A-Za-z0-9+/_=-]{40,}\b/g, '[segredo]')
    .replace(/(https?:\/\/[^\s?#]*)[?#]\S*/gi, '$1?…')
    .replace(/[?&#][\w.-]+=\S*/g, '?…')
    .replace(/([?#])\S+/g, '$1…')
}

export type MotivoCaso = 'ainda-nao-deu' | 'sem-saida' | 'fechou-sem-resolver'

/** Linha do ocorrencias_admin: `tipo` + `descricao`. O cliente_id vem da licença no servidor, nunca daqui. */
export interface CasoAjuda {
  tipo: 'ajuda_nao_resolvida'
  descricao: string
}

const MOTIVOS: Record<MotivoCaso, string> = {
  'ainda-nao-deu': 'o cliente tentou os passos e disse que ainda não deu',
  'sem-saida': 'o Atlas não achou saída',
  'fechou-sem-resolver': 'o cliente fechou a Ajuda sem resolver',
}

export function montarCaso(contexto: ContextoAjuda, historico: Turno[], motivo: MotivoCaso): CasoAjuda {
  const limpo = (t: string | undefined, max: number) => tirarSegredos(textoDaObra(t, max))
  const ultima = [...historico].reverse().find((t) => t.de === 'cliente' && t.texto !== AINDA_NAO_DEU)
  const linhas = [
    `Motivo: ${MOTIVOS[motivo]}`,
    contexto.onde && `Onde: ${limpo(contexto.onde, 80)}`,
    contexto.passo && `Passo: ${contexto.passo.passo} de ${contexto.passo.totalPassos} (${limpo(contexto.passo.conta, 60)})`,
    contexto.erro && `Erro: ${limpo(contexto.erro.titulo, 120)} ${limpo(contexto.erro.detalhe, 300)}`.trim(),
    contexto.print && `Tela: ${limpo(contexto.print.titulo, 100)} (${limpo(contexto.print.url, 100)})`,
    ultima && `Cliente disse: ${limpo(ultima.texto, 300)}`,
  ].filter(Boolean)
  return { tipo: 'ajuda_nao_resolvida', descricao: linhas.join('\n').slice(0, 1200) }
}

export interface PonteCasosAdmin {
  /** Grava o caso no painel do administrador (S9). */
  enviar(caso: CasoAjuda): Promise<void>
}

export interface CasosFixture extends PonteCasosAdmin {
  readonly enviados: CasoAjuda[]
}

export function criarCasosFixture(): CasosFixture {
  const enviados: CasoAjuda[] = []
  return { enviados, async enviar(c) { enviados.push(structuredClone(c)) } }
}

/** Sem adaptador real e fora do modo fixture: não finge que anotou. */
export const casosIndisponivel: PonteCasosAdmin = { async enviar() { throw new Error('indisponivel') } }
