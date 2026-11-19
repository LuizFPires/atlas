// Bloco B — degustação self-service: teste de N dias com e-mail CONFIRMADO, anti-abuso e liga/desliga pelo painel.
// Fluxo: pedir (público) -> e-mail com token de uso único -> confirmar (público) -> licença de teste (tipo 'cortesia').
// Sem clicar no link, NENHUMA licença é criada. Pagamento/assinatura não são tocados.
import { adminLogado, type DepsAdmin } from './admin.ts'
import { DOMINIO_RE, JANELA_AUDITORIA_DIAS, PROVEDORES_COMUNS } from './auditoria.ts'
import { hmac, sha256, tokenAleatorio } from './cripto.ts'
import { DOMINIOS_DESCARTAVEIS } from './dominios-descartaveis.ts'
import { gerarLink } from './links.ts'
import { type Deps, ErroRegra } from './tipos.ts'

export const VALIDADE_CONFIRMACAO_MS = 48 * 3600_000
export const LIMITE_IP = { max: 5, janelaMs: 60 * 60_000 }
export const LIMITE_EMAIL = { max: 3, janelaMs: 60 * 60_000 }
export const LIMITE_CONFIRMAR_IP = { max: 20, janelaMs: 15 * 60_000 }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GMAIL = new Set(['gmail.com', 'googlemail.com'])

export interface DepsDegustacao extends Deps {
  /** Envia o e-mail de confirmação. Fixture/testes: grava. Produção: adaptador de e-mail (Resend). */
  enviarConfirmacaoDegustacao: (email: string, dados: { token: string; expira_em: Date; dias: number }) => Promise<void>
}

/** Tira o ponto final do domínio ("gmail.com." é o mesmo domínio que "gmail.com"). */
export function semPontoFinal(email: string): string {
  return email.replace(/\.+$/, '')
}

/**
 * lower/trim, sem ponto final no domínio; em TODOS os domínios tira o '+tag' do local; só em gmail/googlemail
 * tira também os pontos e unifica o domínio. Chave anti-repetição.
 */
export function normalizarEmail(bruto: string): string {
  const e = semPontoFinal(bruto.trim().toLowerCase())
  const arroba = e.lastIndexOf('@')
  if (arroba < 1) return e
  let local = e.slice(0, arroba)
  let dominio = e.slice(arroba + 1)
  const base = local.split('+')[0]
  if (base) local = base // '+x@dom' (local só de tag) fica como está
  if (GMAIL.has(dominio)) {
    local = local.replace(/\./g, '')
    dominio = 'gmail.com'
  }
  return `${local}@${dominio}`
}

/** Chave anti-repetição: HMAC com o segredo do servidor e separação de domínio (sem o segredo, não dá para confirmar que um e-mail está na tabela). */
export const hashEmail = (segredo: string, norm: string) => hmac(segredo, `degustacao:${norm}`)

/** Domínio e todos os "pais" (a.b.mailinator.com -> também mailinator.com). */
const sufixos = (dominio: string) => {
  const p = dominio.split('.')
  return p.map((_, i) => p.slice(i).join('.')).filter((s) => s.includes('.'))
}

export async function dominioDescartavel(d: Deps, email: string): Promise<boolean> {
  const dominio = email.slice(email.lastIndexOf('@') + 1)
  for (const s of sufixos(dominio)) {
    if (DOMINIOS_DESCARTAVEIS.has(s) || (await d.store.dominioBloqueado(s))) return true
  }
  return false
}

/** Público: a página de vendas só mostra o bloco quando `ativa`. */
export async function estadoDegustacao(d: Deps) {
  const c = await d.store.configDegustacao()
  return { ativa: c.ativa, dias: c.dias }
}

/**
 * Pedido: valida, confere que a oferta está ligada, aplica os freios (IP, domínio descartável, 1 por e-mail normalizado,
 * quem já tem conta) e manda o e-mail de confirmação. NÃO cria licença.
 */
export async function pedirDegustacao(d: DepsDegustacao, a: { email: unknown; ip: string }) {
  // O ponto final do domínio sai ANTES de tudo (regex, descartável, normalização, e-mail guardado).
  const email = typeof a.email === 'string' ? semPontoFinal(a.email.trim().toLowerCase()) : ''
  if (email.length > 254 || !EMAIL_RE.test(email)) throw new ErroRegra('email_invalido', 'Confira o e-mail: ele precisa ter um @ e um final, como .com.br.', 400)
  const cfg = await d.store.configDegustacao()
  if (!cfg.ativa) throw new ErroRegra('oferta_desligada', 'O teste grátis não está aberto agora. Volte daqui a pouco.', 409)
  if (!(await d.store.tentarEvento(`degustacao:ip:${a.ip}`, LIMITE_IP.max, LIMITE_IP.janelaMs, d.agora()))) {
    throw new ErroRegra('muitas_solicitacoes', 'Muitos pedidos deste lugar. Espere um pouco e tente de novo.', 429)
  }
  if (await dominioDescartavel(d, email)) {
    throw new ErroRegra('dominio_descartavel', 'Esse tipo de e-mail temporário não serve para o teste. Use o e-mail que você realmente abre no dia a dia.', 400)
  }
  const norm = normalizarEmail(email)
  // clientePorEmail NÃO normaliza (compara o texto exato): olha o e-mail digitado e o normalizado (voce+1@gmail.com vs voce@gmail.com).
  const cli = (await d.store.clientePorEmail(email)) ?? (norm !== email ? await d.store.clientePorEmail(norm) : null)
  if (cli && (await d.store.licencaDoCliente(cli.id))) {
    throw new ErroRegra('ja_tem_conta', 'Esse e-mail já tem um acesso ao Atlas (teste ou conta). Entre pela sua conta.', 409)
  }
  if (!(await d.store.tentarEvento(`degustacao:email:${norm}`, LIMITE_EMAIL.max, LIMITE_EMAIL.janelaMs, d.agora()))) {
    throw new ErroRegra('muitas_solicitacoes', 'Já mandei o e-mail algumas vezes. Olhe a caixa de entrada e o spam, ou tente de novo daqui a uma hora.', 429)
  }
  const token = tokenAleatorio()
  const expira_em = new Date(d.agora().getTime() + VALIDADE_CONFIRMACAO_MS)
  const r = await d.store.pedirDegustacao({ email, email_hash: await hashEmail(d.segredo, norm), token_hash: await sha256(token), ip: a.ip, expira_em, agora: d.agora() })
  if (r === 'ja_usada') throw new ErroRegra('ja_usou_degustacao', 'Esse e-mail já usou o teste grátis. Para continuar, é só assinar o Atlas.', 409)
  try {
    await d.enviarConfirmacaoDegustacao(email, { token, expira_em, dias: cfg.dias })
  } catch {
    throw new ErroRegra('email_nao_enviado', 'Não consegui mandar o e-mail agora. Tente de novo em instantes.', 502)
  }
  return { ok: true, enviado: true }
}

/**
 * Confirmação (o token do e-mail é a prova). Cria a licença de teste pela RPC atômica criar_degustacao.
 * Devolve também um link de instalação de uso único (o mesmo da compra) para a pessoa seguir direto.
 */
export async function confirmarDegustacao(d: Deps, a: { token: unknown; ip: string }) {
  const token = typeof a.token === 'string' ? a.token.trim() : ''
  if (!/^[\w-]{20,128}$/.test(token)) throw new ErroRegra('token_invalido', 'Esse link não é válido. Peça o teste de novo na página inicial.', 400)
  if (!(await d.store.tentarEvento(`degustacao:confirmar:${a.ip}`, LIMITE_CONFIRMAR_IP.max, LIMITE_CONFIRMAR_IP.janelaMs, d.agora()))) {
    throw new ErroRegra('muitas_solicitacoes', 'Muitas tentativas. Espere uns minutos.', 429)
  }
  const cfg = await d.store.configDegustacao()
  // Oferta desligada depois do pedido: não libera mais (o gestor mandou parar).
  if (!cfg.ativa) throw new ErroRegra('oferta_desligada', 'O teste grátis não está aberto agora. Volte daqui a pouco.', 409)
  const r = await d.store.criarDegustacao({ token_hash: await sha256(token), dias: cfg.dias, agora: d.agora() })
  switch (r.resultado) {
    case 'criada': {
      const link = await gerarLink(d, r.email!)
      return { ok: true, dias: cfg.dias, validade_em: r.licenca!.validade_em, link_token: link.token, link_expira_em: link.expira_em }
    }
    case 'expirada':
      throw new ErroRegra('link_expirado', 'Esse link venceu. Peça o teste de novo na página inicial.', 410)
    case 'ja_usada':
      throw new ErroRegra('link_usado', 'Esse link já foi usado. Se o teste já está liberado, é só abrir o Atlas.', 410)
    case 'ja_tem_licenca':
      throw new ErroRegra('ja_tem_conta', 'Esse e-mail já tem um acesso ao Atlas (teste ou conta). Nada novo foi criado.', 409)
    default:
      throw new ErroRegra('token_invalido', 'Esse link não é válido. Peça o teste de novo na página inicial.', 404)
  }
}

/** Painel: lê (corpo sem `ativa`) ou liga/desliga e ajusta os dias (1 a 30). Só admin (JWT + allowlist). */
export async function configDegustacaoAdmin(d: DepsAdmin, jwt: string, a: { ativa?: unknown; dias?: unknown }) {
  const adm = await adminLogado(d, jwt)
  if (a.ativa === undefined && a.dias === undefined) return { ok: true, ...(await d.store.configDegustacao()) }
  const atual = await d.store.configDegustacao()
  if (a.ativa !== undefined && typeof a.ativa !== 'boolean') throw new ErroRegra('config_invalida', 'Escolha ligado ou desligado.', 400)
  let dias: number | undefined
  if (a.dias !== undefined) {
    if (typeof a.dias !== 'number' || !Number.isInteger(a.dias) || a.dias < 1 || a.dias > 30) throw new ErroRegra('dias_invalidos', 'O teste pode durar de 1 a 30 dias.', 400)
    dias = a.dias
  }
  const ativa = (a.ativa as boolean | undefined) ?? atual.ativa
  const novo = await d.store.definirConfigDegustacao({ ativa, dias, por: adm.email, agora: d.agora() })
  await d.store.inserirOcorrencia({ cliente_id: null, tipo: 'degustacao_config', descricao: `Teste grátis ${novo.ativa ? 'ligado' : 'desligado'} (${novo.dias} dias)`, autor: adm.email, resolvida: true, criada_em: d.agora() })
  return { ok: true, ...novo }
}

// ── Bloco C: lista de descartáveis editável pelo painel + auto-auditoria ──────────────────────────────────────────

/** "  @Mailinator.COM. " -> "mailinator.com". Aceita colar um e-mail inteiro (pega o que vem depois do @). Vazio/inválido -> null. */
export function normalizarDominio(bruto: unknown): string | null {
  if (typeof bruto !== 'string') return null
  let x = bruto.trim().toLowerCase()
  if (x.includes('@')) x = x.slice(x.lastIndexOf('@') + 1)
  x = x.replace(/\.+$/, '')
  return DOMINIO_RE.test(x) ? x : null
}

/** Painel: lista os domínios bloqueados pelo gestor (a lista base em código não aparece aqui; é fixa). */
export async function listarDominios(d: DepsAdmin, jwt: string) {
  await adminLogado(d, jwt)
  return { dominios: (await d.store.listarDominiosBloqueados()).map((x) => ({ dominio: x.dominio, motivo: x.motivo, criado_em: x.criado_em })) }
}

/** Painel: bloqueia um domínio (e os subdomínios dele). Valida o formato, normaliza e não duplica. Provedores grandes não podem ser bloqueados. */
export async function adicionarDominio(d: DepsAdmin, jwt: string, a: { dominio: unknown }) {
  const adm = await adminLogado(d, jwt)
  const dominio = normalizarDominio(a.dominio)
  if (!dominio) throw new ErroRegra('dominio_invalido', 'Esse domínio não parece certo. Escreva só a parte depois do @, por exemplo mailinator.com.', 400)
  if (PROVEDORES_COMUNS.has(dominio)) throw new ErroRegra('dominio_protegido', 'Esse é um e-mail de uso comum (como Gmail ou Hotmail). Bloquear barraria gente de verdade.', 409)
  const novo = await d.store.adicionarDominioBloqueado(dominio, 'descartavel', d.agora())
  if (novo) await d.store.inserirOcorrencia({ cliente_id: null, tipo: 'degustacao_dominio', descricao: `Domínio bloqueado no teste grátis: ${dominio}`, autor: adm.email, resolvida: true, criada_em: d.agora() })
  return { ok: true, dominio, ja_existia: !novo }
}

/** Painel: libera de volta um domínio (os pedidos dele voltam a ser aceitos). */
export async function removerDominio(d: DepsAdmin, jwt: string, a: { dominio: unknown }) {
  const adm = await adminLogado(d, jwt)
  const dominio = normalizarDominio(a.dominio)
  if (!dominio) throw new ErroRegra('dominio_invalido', 'Esse domínio não parece certo.', 400)
  if (!(await d.store.removerDominioBloqueado(dominio))) throw new ErroRegra('dominio_nao_encontrado', 'Esse domínio não está na lista.', 404)
  await d.store.inserirOcorrencia({ cliente_id: null, tipo: 'degustacao_dominio', descricao: `Domínio liberado no teste grátis: ${dominio}`, autor: adm.email, resolvida: true, criada_em: d.agora() })
  return { ok: true, dominio }
}

/** Auto-auditoria semanal (rota de serviço /degustacao/auditar, chamada pelo cron do deploy). Só abre ocorrências; não bloqueia nada sozinha. */
export async function auditarDegustacao(d: Deps) {
  const agora = d.agora()
  const novos = await d.store.auditarDegustacao(agora, new Date(agora.getTime() - JANELA_AUDITORIA_DIAS * 24 * 3600_000))
  return { ok: true, novos }
}
