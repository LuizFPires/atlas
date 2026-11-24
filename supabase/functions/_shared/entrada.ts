// Código de ENTRADA no Atlas pelo e-mail (celular /app e conta /conta). Bug de 24/11/2026: o código vinha do envio padrão do
// Supabase Auth, que é limitado, e quem tinha cortesia não recebia. Agora:
//  1. só cliente com licença (paga ou cortesia, não cancelada) recebe; para qualquer outro e-mail a resposta é IGUAL (não revela);
//  2. o código é gerado pelo próprio Supabase Auth com a service_role, SEM mandar e-mail (admin generate_link → email_otp), então a
//     verificação continua sendo a do Auth (/auth/v1/verify) e a sessão é a mesma de sempre;
//  3. o e-mail sai pelo mesmo envio dos outros e-mails do Atlas (Resend), com o modelo do Atlas.
// Limites: por IP e por cliente, iguais aos do código de ativação. Nada do código vai para log.
import { JANELA_LIMITE_MS, MAX_EMISSOES } from './ativacao.ts'
import { type Deps, ErroRegra } from './tipos.ts'

export interface DepsEntrada extends Deps {
  /** Gera o código de 6 números no Supabase Auth (cria o login se ainda não existir, já confirmado). Não manda e-mail. */
  gerarCodigoEntrada(email: string): Promise<string>
  /** Manda o código pelo e-mail do Atlas. */
  enviarCodigoEntrada(email: string, codigo: string, nome?: string): Promise<void>
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/

export async function pedirCodigoEntrada(d: DepsEntrada, emailBruto: string, ip = 'desconhecido') {
  const email = String(emailBruto ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) throw new ErroRegra('email_invalido', 'Confira o e-mail: ele precisa ter um @ e um final, como .com.br.', 400)
  if (!(await d.store.tentarEvento(`entrada:ip:${ip}`, MAX_EMISSOES * 3, JANELA_LIMITE_MS, d.agora()))) {
    throw new ErroRegra('muitas_solicitacoes', 'Você pediu códigos demais. Espere uns 15 minutos e tente de novo.', 429)
  }
  const cliente = await d.store.clientePorEmail(email)
  if (!cliente) return { ok: true }
  const lic = await d.store.licencaDoCliente(cliente.id)
  if (!lic || lic.status === 'cancelada') return { ok: true }
  if (!(await d.store.tentarEvento(`entrada:cliente:${cliente.id}`, MAX_EMISSOES, JANELA_LIMITE_MS, d.agora()))) return { ok: true }
  const codigo = await d.gerarCodigoEntrada(cliente.email_compra)
  await d.enviarCodigoEntrada(cliente.email_compra, codigo, cliente.nome_tratamento ?? undefined)
  return { ok: true }
}
