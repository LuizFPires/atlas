/* eslint-disable */
// @ts-nocheck
// ADAPTADOR REAL (Deno / Supabase Edge Function): Store no Postgres, carregador do kit no Storage e envio de e-mail.
// Só a edge function (api/index.ts) importa este arquivo. Fica fora do tsc/vitest do CI (como api/index.ts):
// o que é testado em CI é a porta (tipos.ts) com o StoreMemoria; aqui só há tradução porta -> banco.
// A verificação de RUNTIME exige um projeto Supabase real e credenciais (ver app/PENDENTE-ENTREGAR.md, "Adaptador real").
//
// ── Variáveis de ambiente (só os NOMES; valores ficam nos segredos do Supabase, NUNCA em arquivo) ──
//   SUPABASE_URL                 já injetada pelo Supabase na edge function.
//   SUPABASE_SERVICE_ROLE_KEY    chave service_role (já injetada pelo Supabase; fica só no servidor).
//   ATLAS_KIT_BUCKET             nome do bucket PRIVADO do kit (padrão: 'kit').
//   RESEND_API_KEY               chave do provedor de e-mail (do usuário). Sem ela o envio FALHA com erro claro; nada finge envio.
//   ATLAS_EMAIL_FROM             remetente verificado no provedor. Ex.: 'Atlas <ola@seu-dominio.com.br>'.
//   ATLAS_INSTALAR_URL           endereço da página de instalação (padrão: https://atlas-ia.app.br/instalar); o link leva ?t=<token>.
//
// ── Provedor de e-mail configurável ──
// O envio passa por uma porta simples: EnviadorEmail = (mensagem) => Promise<void>. O padrão é a API HTTP do Resend.
// Para trocar de provedor, chame definirEnviadorEmail(outro) antes de atender requisições. A conta e a chave são do usuário.
//
// ── Mapeamento método do Store -> banco (para conferir sem banco ao vivo) ──
//   clientePorEmail            SELECT clientes (id,email_compra,nome_tratamento,empresa,ramo,cadastro_em,auth_user_id) WHERE email_compra
//   clientePorId/PorAuthUser   idem, WHERE id / auth_user_id
//   vincularAuthUser           UPDATE clientes SET auth_user_id WHERE id AND auth_user_id IS NULL (1 instrução = atômico; 0 linhas = false)
//   salvarCadastro             UPDATE clientes SET nome_tratamento,empresa,ramo,cidade,uf,cadastro_em WHERE id AND cadastro_em IS NULL
//   reabrirCadastro            UPDATE clientes SET cadastro_em=NULL WHERE id
//   licencaDoCliente/PorId     SELECT licencas (11 colunas seguras, sem plano_valor/criada_em)
//   salvarLicenca              UPDATE licencas SET <campos> WHERE id
//   atualizarLicencaSe         UPDATE licencas SET <set> WHERE id AND <cond> RETURNING id (0 linhas = false)
//   licencaPorGateway          SELECT licencas WHERE conta_gateway_id AND (gateway_assinatura_ref | gateway_cliente_ref)
//   licencasAtrasadas / licencasEncerramentoVencido   SELECT licencas WHERE status='atrasada' / status<>'cancelada' AND mensalidade_encerra_em<=agora
//   criarCompra                RPC criar_compra (0010)
//   definirIdiomaLicenca       UPDATE licencas SET idioma WHERE id (0034)
//   criarCortesia              RPC criar_cortesia (0013)
//   configDegustacao           SELECT config_degustacao (ativa,dias) WHERE id=1 (0016)
//   definirConfigDegustacao    UPDATE config_degustacao SET ativa,dias,atualizada_em,atualizada_por WHERE id=1
//   dominioBloqueado           SELECT dominios_bloqueados WHERE dominio
//   pedirDegustacao / criarDegustacao / limparIpsDegustacao   RPC pedir_degustacao / criar_degustacao (0016/0017) / limpar_ips_degustacao (0017)
//   inserirLink / linkPorHash  INSERT / SELECT links_instalacao (id,cliente_id,token_hash,expira_em,usado_em) WHERE token_hash
//   consumirLink               RPC consumir_link (0002)
//   invalidarLinks             UPDATE links_instalacao SET usado_em WHERE cliente_id AND usado_em IS NULL
//   trocarLinks                RPC trocar_links (0010)
//   inserirCodigo              RPC inserir_codigo (0002)
//   codigoAberto               SELECT codigos WHERE cliente_id AND finalidade AND usado_em IS NULL ORDER BY criado_em DESC LIMIT 1
//   incrementarTentativa       RPC incrementar_tentativa (0002)  [0 linhas = null]
//   consumirCodigo             RPC consumir_codigo (0002)
//   tentarEvento / limparEventos   RPC tentar_evento / limpar_eventos (0002)
//   ativacaoAtiva              SELECT ativacoes (inclui token_hash: o servidor confere o device token) WHERE licenca_id AND ativo
//   computadorJaTestou         RPC computador_ja_testou: ledger degustacoes_dispositivos (HMAC), licenca_id <> atual  (0019)
//   registrarDispositivoTeste  RPC registrar_dispositivo_teste (0019)
//   inserirAtivacao            INSERT ativacoes (índice único parcial garante 1 ativo por licença; violação = erro)
//   rotacionarToken            UPDATE ativacoes SET token_hash WHERE id
//   trocarAtivacao             RPC trocar_computador (0002)
//   liberarAtivacao            RPC liberar_computador (0008)
//   trocasDa                   SELECT trocas_computador (licenca_id,de_hash,para_hash,feita_em,por_admin) WHERE licenca_id
//   inserirEntrega             INSERT entregas_kit
//   inserirOcorrencia          INSERT ocorrencias_admin (cliente_id,tipo,descricao,autor,resolvida,criada_em)
//   substituirStatusObras / statusObrasDaLicenca   RPC substituir_status_obras (0022; 2 casas no 0035) / SELECT status_obras WHERE licenca_id
//   salvarPersonalizacao / personalizacaoDaLicenca   UPSERT / SELECT personalizacao_app (0024) por licenca_id
//   contaGateway               SELECT contas_gateway (id,conta_stripe_id,segredo_ref,modo,base_retorno) WHERE id  [só a referência do segredo]
//   registrarEventoGateway     INSERT eventos_gateway; violação de PK (23505) = já visto = false
//   liberarEventoGateway       DELETE eventos_gateway WHERE (conta_gateway_id, evento_id)
//   gravarPagamento            RPC gravar_pagamento (0010)
//   pagamentoPorRef/PorPi/Da   SELECT pagamentos (licenca_id,conta_gateway_id,tipo,valor,status,gateway_ref,gateway_pi,pago_em,segmento)
//   atualizarStatusPagamento   UPDATE pagamentos SET status WHERE conta_gateway_id AND gateway_ref
//   registrarConsentimento     INSERT consentimentos (email,versao_termos,origem,aceito_em)  (0011)
//   excluirConta               RPC excluir_conta (0012): anonimiza o cliente, apaga o pessoal, mantém pagamentos
//   registrarSessao            INSERT sessoes_checkout ... ON CONFLICT (sessao_id) DO NOTHING
//   marcarSessaoPaga           UPDATE sessoes_checkout SET paga,paga_em WHERE sessao_id; se 0 linhas, INSERT (2 passos, com retry no 23505)
//   sessaoPorId                SELECT sessoes_checkout (conta_gateway_id,sessao_id,email,paga) WHERE sessao_id
//   listarClientes/Licencas    SELECT paginado (mesmas colunas seguras acima)
//   listarPagamentos           SELECT paginado só (licenca_id,tipo,valor,status,pago_em,segmento); gateway_ref/pi/conta saem vazios (painel nunca vê)
//   listarAtivacoes            SELECT paginado SEM token_hash (sai null)
//   listarTrocas               SELECT paginado trocas_computador
//   ocorrenciasAbertas         SELECT ocorrencias_admin WHERE NOT resolvida ORDER BY criada_em DESC LIMIT n
//   resolverOcorrencia         UPDATE ocorrencias_admin SET resolvida,resolvida_por,resolvida_em WHERE id AND NOT resolvida RETURNING id
//   entregasRecentes/DaLicenca/PorMarca   SELECT entregas_kit (licenca_id,obra_id,marca_dagua,baixado_em) ORDER BY baixado_em DESC
//   salvarConviteTeste / conviteTeste* / registrarTestador / testadoresDoConvite   lojas_convites e lojas_testadores (0032)
//   registrarEventoPolitica / eventosPolitica* / situacoesPolitica* / definirSituacaoPolitica   politica_eventos e politica_obras (0031)
//   registrarEventoRadar / eventosRadar / limparEventosRadar   INSERT / SELECT / DELETE radar_eventos (0028; nunca IP: só UF e dispositivo curto)
//   barradasDeTeste            SELECT degustacoes_dispositivos (dispositivo_hmac,licenca_id,barradas,ultima_barrada_em) WHERE barradas>=n; só 8 chars do HMAC saem
//   baixasRadar / baixarSinalRadar   SELECT / UPSERT radar_baixas (0028)
//
// ── Carregador do kit ──
// Bucket PRIVADO (ATLAS_KIT_BUCKET, padrão 'kit'). Layout: 'base/...' (comum a todas as obras) e '<obra_id>/...' (da obra);
// o da obra vence o de mesmo caminho. Lido em memória e devolvido ao /entregar-kit, que aplica marca d'água/aviso. Nada vai a disco.
//
// Invariantes: nenhum segredo em arquivo; pagamento é da conta do cliente (chaves STRIPE_<ref>_* resolvidas no index.ts);
// marca d'água e aviso de licença são do /entregar-kit (kit.ts), não daqui.

import type { CanalCelular, Pedido } from './celular.ts'
import type { CanalPush, EnvioPush } from './push.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { urlPublica } from './url-publica.ts'
import { montarBoasVindas, montarConfirmacaoDegustacao, montarCortesia, remetentePessoal } from './emails.ts'
import { montarAvisoAtraso, montarCodigoAtivacao } from './emails-avisos.ts'
import { ARQUIVO_ATUALIZACAO_MAC, ARQUIVO_MANIFESTO_MAC, criarFonteAtualizacaoStorage, criarLinkInstaladorStorage, lerConfigInstalador } from './instalador-storage.ts'
import { KIT_EMBUTIDO } from './kit-embutido.ts'
import { juntarKit } from './kit.ts'

function env(nome: string): string {
  const v = Deno.env.get(nome)
  if (!v) throw new Error(`configuração ausente: defina ${nome} nos segredos do servidor.`)
  return v
}

let _cli: any = null
function db() {
  if (!_cli) _cli = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
  return _cli
}

// ── utilitários ──
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)
const dt = (v: any) => (v ? new Date(v) : null)
/** Falha fechado: qualquer erro do banco vira exceção (nada de "deu certo" por engano). */
function ok<T>(r: { data: T; error: any }, o = 'consulta'): T {
  if (r.error) throw new Error(`banco (${o}): ${r.error.code ?? ''} ${r.error.message}`)
  return r.data
}
async function rpc(nome: string, args: Record<string, unknown>) {
  return ok(await db().rpc(nome, args), nome)
}
/** Lê em páginas de 1000 (limite padrão da API) até `limite` linhas. `mk` devolve uma consulta nova com ordem estável. */
async function ler(mk: () => any, limite = Infinity): Promise<any[]> {
  const saida: any[] = []
  for (let de = 0; saida.length < limite; de += 1000) {
    const n = Math.min(1000, limite - saida.length)
    const lote = ok(await mk().range(de, de + n - 1), 'listar')
    saida.push(...lote)
    if (lote.length < n) break
  }
  return saida
}

// Colunas lidas (só o que o servidor precisa).
const C_CLIENTE = 'id,email_compra,nome_tratamento,empresa,ramo,cadastro_em,auth_user_id,excluido_em,cidade,uf'
const C_LICENCA = 'id,cliente_id,status,pausa_prevista_em,troca_liberada_em,comprada_em,avisos_atraso,conta_gateway_id,gateway_cliente_ref,gateway_assinatura_ref,mensalidade_encerra_em,tipo,origem,validade_em,cancelada_em'
const C_ATIVACAO = 'id,licenca_id,computador_hash,token_hash,ativo,ativado_em,desativado_em'
const C_ATIVACAO_ADMIN = 'id,licenca_id,computador_hash,ativo,ativado_em,desativado_em'
const C_PAGAMENTO = 'licenca_id,conta_gateway_id,tipo,valor,status,gateway_ref,gateway_pi,pago_em,segmento'
const C_ENTREGA = 'licenca_id,obra_id,marca_dagua,baixado_em'
const C_OCORRENCIA = 'id,cliente_id,tipo,descricao,autor,resolvida,criada_em,resolvida_por,resolvida_em,chave'

const cliente = (r: any) => r && { id: r.id, email_compra: r.email_compra, nome_tratamento: r.nome_tratamento, empresa: r.empresa, ramo: r.ramo, cadastro_em: dt(r.cadastro_em), auth_user_id: r.auth_user_id, excluido_em: dt(r.excluido_em), cidade: r.cidade ?? null, uf: r.uf ?? null }
const licenca = (r: any) => r && {
  id: r.id, cliente_id: r.cliente_id, status: r.status, pausa_prevista_em: dt(r.pausa_prevista_em), troca_liberada_em: dt(r.troca_liberada_em),
  comprada_em: dt(r.comprada_em), avisos_atraso: r.avisos_atraso ?? 0, conta_gateway_id: r.conta_gateway_id ?? null,
  gateway_cliente_ref: r.gateway_cliente_ref ?? null, gateway_assinatura_ref: r.gateway_assinatura_ref ?? null, mensalidade_encerra_em: dt(r.mensalidade_encerra_em),
  tipo: r.tipo === 'cortesia' ? 'cortesia' : 'paga', origem: r.origem === 'degustacao' ? 'degustacao' : null, validade_em: dt(r.validade_em), cancelada_em: dt(r.cancelada_em),
  ...(r.idioma === 'en' ? { idioma: 'en' as const } : {}),
}
const ativacao = (r: any) => r && { id: r.id, licenca_id: r.licenca_id, computador_hash: r.computador_hash, token_hash: r.token_hash ?? null, ativo: r.ativo, ativado_em: new Date(r.ativado_em), desativado_em: dt(r.desativado_em) }
const pagamento = (r: any) => r && { licenca_id: r.licenca_id, conta_gateway_id: r.conta_gateway_id ?? '', tipo: r.tipo, valor: Number(r.valor), status: r.status, gateway_ref: r.gateway_ref ?? '', gateway_pi: r.gateway_pi ?? null, pago_em: dt(r.pago_em), segmento: r.segmento ?? null }
const entrega = (r: any) => ({ licenca_id: r.licenca_id, obra_id: r.obra_id, marca_dagua: r.marca_dagua, baixado_em: new Date(r.baixado_em) })
const codigo = (r: any) => r && { id: r.id, cliente_id: r.cliente_id, finalidade: r.finalidade, codigo_hash: r.codigo_hash, tentativas: r.tentativas, expira_em: new Date(r.expira_em), usado_em: dt(r.usado_em) }
const link = (r: any) => r && { id: r.id, cliente_id: r.cliente_id, token_hash: r.token_hash, expira_em: new Date(r.expira_em), usado_em: dt(r.usado_em) }
const troca = (r: any) => ({ licenca_id: r.licenca_id, de_hash: r.de_hash, para_hash: r.para_hash ?? null, feita_em: new Date(r.feita_em), por_admin: r.por_admin })
const conviteTeste = (r: any) => ({ codigo: r.codigo, licenca_id: r.licenca_id, obra_id: r.obra_id, app_nome: r.app_nome, grupo_url: r.grupo_url, optin_url: r.optin_url, criado_em: new Date(r.criado_em) })
const C_CONVITE = 'codigo,licenca_id,obra_id,app_nome,grupo_url,optin_url,criado_em'
const eventoPolitica = (r: any) => ({ licenca_id: r.licenca_id, obra_id: r.obra_id, onde: r.onde, texto: r.texto, criado_em: new Date(r.criado_em) })
const situacaoPolitica = (r: any) => ({ licenca_id: r.licenca_id, obra_id: r.obra_id, situacao: r.situacao, desde: new Date(r.desde), decidido_por: r.decidido_por ?? null })
const ocorrencia = (r: any) => ({ id: r.id, cliente_id: r.cliente_id, tipo: r.tipo, descricao: r.descricao, autor: r.autor ?? null, resolvida: r.resolvida, criada_em: new Date(r.criada_em), resolvida_por: r.resolvida_por ?? null, resolvida_em: dt(r.resolvida_em), chave: r.chave ?? null })

/** Converte o `set` de licença (Date -> ISO). Campos undefined ficam de fora; id/cliente_id nunca são alterados. */
function linhaLicenca(set: Record<string, any>) {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(set)) {
    if (v === undefined || k === 'id' || k === 'cliente_id') continue
    out[k] = v instanceof Date ? v.toISOString() : v
  }
  return out
}

const um = async (q: any, map: (r: any) => any) => map(ok(await q.limit(1).maybeSingle(), 'um')) ?? null

export function criarStoreSupabase() {
  const t = (n: string) => db().from(n)
  return {
    // ── clientes ──
    clientePorEmail: (email: string) => um(t('clientes').select(C_CLIENTE).eq('email_compra', email), cliente),
    clientePorId: (id: string) => um(t('clientes').select(C_CLIENTE).eq('id', id), cliente),
    clientePorAuthUser: (id: string) => um(t('clientes').select(C_CLIENTE).eq('auth_user_id', id), cliente),
    async vincularAuthUser(clienteId: string, authUserId: string) {
      const r = ok(await t('clientes').update({ auth_user_id: authUserId }).eq('id', clienteId).is('auth_user_id', null).select('id'), 'vincularAuthUser')
      return r.length === 1
    },
    async salvarCadastro(clienteId: string, c: { nome: string; empresa: string; ramo: string; cidade?: string | null; uf?: string | null }, quando: Date) {
      const r = ok(await t('clientes').update({ nome_tratamento: c.nome, empresa: c.empresa, ramo: c.ramo, cidade: c.cidade ?? null, uf: c.uf ?? null, cadastro_em: iso(quando) }).eq('id', clienteId).is('cadastro_em', null).select('id'), 'salvarCadastro')
      return r.length === 1
    },
    async reabrirCadastro(clienteId: string) { ok(await t('clientes').update({ cadastro_em: null }).eq('id', clienteId), 'reabrirCadastro') },

    // ── licenças ──
    licencaDoCliente: (id: string) => um(t('licencas').select(C_LICENCA).eq('cliente_id', id).order('criada_em', { ascending: true }), licenca),
    licencaPorId: (id: string) => um(t('licencas').select(C_LICENCA).eq('id', id), licenca),
    async salvarLicenca(l: any) {
      const r = ok(await t('licencas').update(linhaLicenca(l)).eq('id', l.id).select('id'), 'salvarLicenca')
      if (r.length !== 1) throw new Error('banco (salvarLicenca): licença não encontrada')
    },
    async atualizarLicencaSe(id: string, set: Record<string, any>, c: Record<string, any>) {
      const linha = linhaLicenca(set)
      if (Object.keys(linha).length === 0) return false
      let q = t('licencas').update(linha).eq('id', id)
      if (c.status) q = q.eq('status', c.status)
      if (c.status_diferente) q = q.neq('status', c.status_diferente)
      if (c.avisos_atraso !== undefined) q = q.eq('avisos_atraso', c.avisos_atraso)
      if (c.pausa_prevista_ate) q = q.lte('pausa_prevista_em', c.pausa_prevista_ate.toISOString()) // NULL <= x é falso, como no StoreMemoria
      if (c.encerra_ate) q = q.lte('mensalidade_encerra_em', c.encerra_ate.toISOString())
      return ok(await q.select('id'), 'atualizarLicencaSe').length === 1
    },
    async licencaPorGateway(conta: string, ref: { cliente?: string | null; assinatura?: string | null }) {
      if (ref.assinatura) {
        const l = await um(t('licencas').select(C_LICENCA).eq('conta_gateway_id', conta).eq('gateway_assinatura_ref', ref.assinatura), licenca)
        if (l) return l
      }
      if (ref.cliente) return um(t('licencas').select(C_LICENCA).eq('conta_gateway_id', conta).eq('gateway_cliente_ref', ref.cliente), licenca)
      return null
    },
    async licencasAtrasadas() { return (await ler(() => t('licencas').select(C_LICENCA).eq('status', 'atrasada').order('id'))).map(licenca) },
    async licencasEncerramentoVencido(agora: Date) {
      return (await ler(() => t('licencas').select(C_LICENCA).neq('status', 'cancelada').not('mensalidade_encerra_em', 'is', null).lte('mensalidade_encerra_em', agora.toISOString()).order('id'))).map(licenca)
    },
    async criarCortesia(c: any) {
      const r = await rpc('criar_cortesia', { p_email: c.email, p_nome: c.nome, p_validade: iso(c.validade_em), p_agora: iso(c.agora) })
      return { resultado: r.resultado, licenca: licenca(r.licenca) }
    },
    // Degustação (0016)
    async configDegustacao() {
      const r = ok(await t('config_degustacao').select('ativa,dias').eq('id', 1).maybeSingle(), 'configDegustacao')
      return r ? { ativa: !!r.ativa, dias: r.dias } : { ativa: false, dias: 5 }
    },
    async definirConfigDegustacao(c: any) {
      const linha: Record<string, any> = { ativa: c.ativa, atualizada_em: iso(c.agora), atualizada_por: c.por }
      if (c.dias !== undefined) linha.dias = c.dias
      const r = ok(await t('config_degustacao').update(linha).eq('id', 1).select('ativa,dias'), 'definirConfigDegustacao')
      return { ativa: !!r[0].ativa, dias: r[0].dias }
    },
    async dominioBloqueado(d: string) { return !!ok(await t('dominios_bloqueados').select('dominio').eq('dominio', d).limit(1).maybeSingle(), 'dominioBloqueado') },
    async pedirDegustacao(p: any) {
      return await rpc('pedir_degustacao', { p_email: p.email, p_hash: p.email_hash, p_token_hash: p.token_hash, p_ip: p.ip, p_expira: iso(p.expira_em), p_agora: iso(p.agora) })
    },
    async listarDominiosBloqueados() {
      return (await ler(() => t('dominios_bloqueados').select('dominio,motivo,criado_em').order('dominio'), 5000)).map((r: any) => ({ dominio: r.dominio, motivo: r.motivo, criado_em: new Date(r.criado_em) }))
    },
    async adicionarDominioBloqueado(dominio: string, motivo: string, agora: Date) {
      const r = ok(await t('dominios_bloqueados').upsert({ dominio, motivo, criado_em: iso(agora) }, { onConflict: 'dominio', ignoreDuplicates: true }).select('dominio'), 'adicionarDominioBloqueado')
      return r.length === 1
    },
    async removerDominioBloqueado(dominio: string) { return ok(await t('dominios_bloqueados').delete().eq('dominio', dominio).select('dominio'), 'removerDominioBloqueado').length === 1 },
    async auditarDegustacao(agora: Date, desde: Date) { return Number(await rpc('auditar_degustacao', { p_agora: iso(agora), p_desde: iso(desde) })) || 0 },
    async registrarBarradaDispositivo(hmac: string, quando: Date) { await rpc('registrar_barrada_dispositivo', { p_hmac: hmac, p_quando: iso(quando) }) },
    async limparIpsDegustacao(agora: Date, dias: number) { return await rpc('limpar_ips_degustacao', { p_agora: iso(agora), p_dias: dias }) },
    async criarDegustacao(p: any) {
      const r = await rpc('criar_degustacao', { p_token_hash: p.token_hash, p_dias: p.dias, p_agora: iso(p.agora) })
      return { resultado: r.resultado, email: r.email, licenca: r.licenca ? licenca(r.licenca) : undefined }
    },
    async criarCompra(c: any) {
      const r = await rpc('criar_compra', { p_email: c.email, p_nome: c.nome, p_valor: c.valor, p_conta: c.conta_gateway_id, p_cliente_ref: c.gateway_cliente_ref, p_agora: iso(c.agora) })
      return { licenca: licenca(r.licenca), nova: !!r.nova }
    },

    async definirIdiomaLicenca(id: string, idioma: 'pt' | 'en') { ok(await t('licencas').update({ idioma }).eq('id', id), 'definirIdiomaLicenca') },
    // Lida à parte (fora do C_LICENCA) para as funções não quebrarem antes da migration 0034 ser aplicada: sem a coluna = 'pt'.
    async idiomaDaLicenca(id: string) {
      const r = await t('licencas').select('idioma').eq('id', id).maybeSingle()
      return r.error || r.data?.idioma !== 'en' ? 'pt' as const : 'en' as const
    },

    // ── links ──
    async inserirLink(l: any) { ok(await t('links_instalacao').insert({ cliente_id: l.cliente_id, token_hash: l.token_hash, expira_em: iso(l.expira_em) }), 'inserirLink') },
    linkPorHash: (h: string) => um(t('links_instalacao').select('id,cliente_id,token_hash,expira_em,usado_em').eq('token_hash', h), link),
    async consumirLink(id: string, quando: Date) { return (await rpc('consumir_link', { p_id: id, p_agora: iso(quando) })) === true },
    async invalidarLinks(clienteId: string, quando: Date) {
      ok(await t('links_instalacao').update({ usado_em: iso(quando) }).eq('cliente_id', clienteId).is('usado_em', null), 'invalidarLinks')
    },
    async trocarLinks(l: any, quando: Date) { await rpc('trocar_links', { p_cliente: l.cliente_id, p_hash: l.token_hash, p_expira: iso(l.expira_em), p_agora: iso(quando) }) },

    // ── códigos e limites ──
    async inserirCodigo(c: any, agora: Date) {
      await rpc('inserir_codigo', { p_cliente: c.cliente_id, p_finalidade: c.finalidade, p_hash: c.codigo_hash, p_expira: iso(c.expira_em), p_agora: iso(agora) })
    },
    codigoAberto: (cid: string, f: string) => um(t('codigos').select('id,cliente_id,finalidade,codigo_hash,tentativas,expira_em,usado_em').eq('cliente_id', cid).eq('finalidade', f).is('usado_em', null).order('criado_em', { ascending: false }), codigo),
    async incrementarTentativa(id: string, max: number, agora: Date) {
      const r = await rpc('incrementar_tentativa', { p_id: id, p_max: max, p_agora: iso(agora) })
      const linha = Array.isArray(r) ? r[0] : r
      return linha ? codigo(linha) : null // 0 linhas = null
    },
    async consumirCodigo(id: string, max: number, agora: Date) { return (await rpc('consumir_codigo', { p_id: id, p_max: max, p_agora: iso(agora) })) === true },
    async tentarEvento(chave: string, max: number, janelaMs: number, agora: Date) {
      return (await rpc('tentar_evento', { p_chave: chave, p_max: max, p_janela_ms: janelaMs, p_agora: iso(agora) })) === true
    },
    async limparEventos(chave: string) { await rpc('limpar_eventos', { p_chave: chave }) },

    // ── ativações e trocas ──
    ativacaoAtiva: (lid: string) => um(t('ativacoes').select(C_ATIVACAO).eq('licenca_id', lid).eq('ativo', true), ativacao),
    async computadorJaTestou(hmac: string, licencaIdAtual: string) { return (await rpc('computador_ja_testou', { p_hmac: hmac, p_licenca: licencaIdAtual })) === true },
    async registrarDispositivoTeste(hmac: string, licencaId: string, quando: Date) {
      return (await rpc('registrar_dispositivo_teste', { p_hmac: hmac, p_licenca: licencaId, p_quando: iso(quando) })) === true
    },
    async inserirAtivacao(lid: string, hash: string, quando: Date, tokenHash: string) {
      ok(await t('ativacoes').insert({ licenca_id: lid, computador_hash: hash, token_hash: tokenHash, ativo: true, ativado_em: iso(quando) }), 'inserirAtivacao')
    },
    async rotacionarToken(id: string, tokenHash: string) { ok(await t('ativacoes').update({ token_hash: tokenHash }).eq('id', id), 'rotacionarToken') },
    async trocarAtivacao(p: any) {
      return (await rpc('trocar_computador', {
        p_licenca: p.licenca_id, p_ativacao_atual: p.ativacao_atual_id, p_de: p.de_hash, p_para: p.para_hash, p_token_hash: p.token_hash,
        p_quando: iso(p.quando), p_por_admin: p.por_admin, p_intervalo_ms: p.intervalo_ms, p_dispositivo_hmac: p.dispositivo_hmac ?? null,
      })) === true
    },
    async liberarAtivacao(p: any) {
      return (await rpc('liberar_computador', {
        p_licenca: p.licenca_id, p_ativacao_atual: p.ativacao_atual_id, p_de: p.de_hash, p_quando: iso(p.quando), p_por_admin: p.por_admin, p_intervalo_ms: p.intervalo_ms,
      })) === true
    },
    async trocasDa(lid: string) { return (await ler(() => t('trocas_computador').select('licenca_id,de_hash,para_hash,feita_em,por_admin').eq('licenca_id', lid).order('feita_em').order('id'))).map(troca) },

    // ── entregas e ocorrências ──
    async inserirEntrega(e: any) { ok(await t('entregas_kit').insert({ licenca_id: e.licenca_id, obra_id: e.obra_id, marca_dagua: e.marca_dagua, baixado_em: iso(e.baixado_em) }), 'inserirEntrega') },
    async inserirOcorrencia(o: any) {
      ok(await t('ocorrencias_admin').insert({
        cliente_id: o.cliente_id, tipo: o.tipo, descricao: o.descricao, autor: o.autor ?? null,
        resolvida: o.resolvida ?? false, ...(o.chave ? { chave: o.chave } : {}), ...(o.criada_em ? { criada_em: iso(o.criada_em) } : {}),
      }), 'inserirOcorrencia')
    },

    // ── status das obras (M30, relay) ──
    async substituirStatusObras(licencaId: string, obras: any[], agora: Date) {
      const enviar = (lista: any[]) => rpc('substituir_status_obras', { p_licenca: licencaId, p_obras: lista.map((o) => ({ ...o, ultima_noticia_em: iso(o.ultima_noticia_em) })), p_agora: iso(agora) })
      try { await enviar(obras) } catch (e) {
        // Enquanto a migration 0035 (2 casas) não estiver no banco, a coluna é inteira: manda arredondado em vez de falhar.
        if (!/22P02/.test(String((e as Error)?.message))) throw e
        await enviar(obras.map((o) => ({ ...o, percentual: Math.floor(o.percentual) })))
      }
    },
    async statusObrasDaLicenca(licencaId: string) {
      const linhas = await ler(() => t('status_obras').select('obra_id,nome,segmento,etapa_atual_numero,etapa_atual_rotulo,total_etapas,percentual,estado,ativa_agora,ultima_noticia,ultima_noticia_em').eq('licenca_id', licencaId).order('obra_id'), 100)
      return linhas.map((r: any) => ({ ...r, percentual: Number(r.percentual), segmento: r.segmento ?? null, ultima_noticia_em: new Date(r.ultima_noticia_em) }))
    },

    // ── personalização do app pronto (M32 b) ──
    async salvarPersonalizacao(licencaId: string, p: any, agora: Date) {
      ok(await t('personalizacao_app').upsert({ licenca_id: licencaId, nome_negocio: p.nome_negocio, logo_url: p.logo_url, cor_principal: p.cor_principal, cor_apoio: p.cor_apoio, atualizado_em: iso(agora) }, { onConflict: 'licenca_id' }), 'salvarPersonalizacao')
    },
    personalizacaoDaLicenca: (licencaId: string) => um(t('personalizacao_app').select('nome_negocio,logo_url,cor_principal,cor_apoio').eq('licenca_id', licencaId), (r: any) => r && { nome_negocio: r.nome_negocio, logo_url: r.logo_url ?? null, cor_principal: r.cor_principal, cor_apoio: r.cor_apoio }),

    // ── pagamento (M3) ──
    contaGateway: (id: string) => um(t('contas_gateway').select('id,conta_stripe_id,segredo_ref,modo,base_retorno').eq('id', id), (r: any) => r && { id: r.id, conta_stripe_id: r.conta_stripe_id, segredo_ref: r.segredo_ref, modo: r.modo, base_retorno: r.base_retorno ?? null }),
    async registrarEventoGateway(conta: string, ev: string) {
      const r = await t('eventos_gateway').insert({ conta_gateway_id: conta, evento_id: ev })
      if (r.error?.code === '23505') return false // PK (conta, evento): já visto
      ok(r, 'registrarEventoGateway')
      return true
    },
    async liberarEventoGateway(conta: string, ev: string) { ok(await t('eventos_gateway').delete().eq('conta_gateway_id', conta).eq('evento_id', ev), 'liberarEventoGateway') },
    async gravarPagamento(p: any) {
      const antes = await rpc('gravar_pagamento', {
        p_licenca: p.licenca_id, p_conta: p.conta_gateway_id, p_tipo: p.tipo, p_valor: p.valor, p_status: p.status, p_ref: p.gateway_ref, p_pi: p.gateway_pi, p_pago_em: iso(p.pago_em), p_segmento: p.segmento ?? null,
      })
      return antes ?? null
    },
    pagamentoPorRef: (conta: string, ref: string) => um(t('pagamentos').select(C_PAGAMENTO).eq('conta_gateway_id', conta).eq('gateway_ref', ref), pagamento),
    async pagamentosPorPi(conta: string, pi: string) { return (await ler(() => t('pagamentos').select(C_PAGAMENTO).eq('conta_gateway_id', conta).eq('gateway_pi', pi).order('id'))).map(pagamento) },
    async pagamentosDa(lid: string) { return (await ler(() => t('pagamentos').select(C_PAGAMENTO).eq('licenca_id', lid).order('id'))).map(pagamento) },
    async atualizarStatusPagamento(conta: string, ref: string, status: string) {
      ok(await t('pagamentos').update({ status }).eq('conta_gateway_id', conta).eq('gateway_ref', ref), 'atualizarStatusPagamento')
    },
    async registrarConsentimento(email: string, versao: string, origem: string, quando: Date) {
      ok(await t('consentimentos').insert({ email, versao_termos: versao, origem, aceito_em: iso(quando) }), 'registrarConsentimento')
    },
    async excluirConta(clienteId: string, quando: Date) { return (await rpc('excluir_conta', { p_cliente: clienteId, p_quando: iso(quando) })) === true },
    async registrarSessao(conta: string, id: string, email: string) {
      ok(await t('sessoes_checkout').upsert({ sessao_id: id, conta_gateway_id: conta, email }, { onConflict: 'sessao_id', ignoreDuplicates: true }), 'registrarSessao')
    },
    async marcarSessaoPaga(conta: string, id: string, email: string) {
      const agora = new Date().toISOString()
      for (let i = 0; i < 2; i++) {
        const u = ok(await t('sessoes_checkout').update({ paga: true, paga_em: agora }).eq('sessao_id', id).select('sessao_id'), 'marcarSessaoPaga')
        if (u.length === 1) return
        const ins = await t('sessoes_checkout').insert({ sessao_id: id, conta_gateway_id: conta, email, paga: true, paga_em: agora })
        if (!ins.error) return
        if (ins.error.code !== '23505') ok(ins, 'marcarSessaoPaga') // 23505 = outro processo criou antes: tenta o UPDATE de novo
      }
      throw new Error('banco (marcarSessaoPaga): não foi possível gravar a sessão')
    },
    sessaoPorId: (id: string) => um(t('sessoes_checkout').select('conta_gateway_id,sessao_id,email,paga').eq('sessao_id', id), (r: any) => r && { conta_gateway_id: r.conta_gateway_id, sessao_id: r.sessao_id, email: r.email, paga: r.paga }),

    // ── painel do administrador (M7): só colunas seguras ──
    async listarClientes() { return (await ler(() => t('clientes').select(C_CLIENTE).order('id'))).map(cliente) },
    async listarLicencas() { return (await ler(() => t('licencas').select(C_LICENCA).order('id'))).map(licenca) },
    async listarPagamentos() {
      return (await ler(() => t('pagamentos').select('licenca_id,tipo,valor,status,pago_em,segmento').order('id'))).map(pagamento) // sem gateway_ref/pi/conta (segmento não é sensível: diz só qual app pronto)
    },
    async listarAtivacoes() { return (await ler(() => t('ativacoes').select(C_ATIVACAO_ADMIN).order('id'))).map(ativacao) }, // sem token_hash
    async listarTrocas() { return (await ler(() => t('trocas_computador').select('licenca_id,de_hash,para_hash,feita_em,por_admin').order('feita_em').order('id'))).map(troca) },
    async ocorrenciasAbertas(limite: number) {
      return (await ler(() => t('ocorrencias_admin').select(C_OCORRENCIA).eq('resolvida', false).order('criada_em', { ascending: false }).order('id'), limite)).map(ocorrencia)
    },
    async resolverOcorrencia(id: string, por: string, quando: Date) {
      const r = ok(await t('ocorrencias_admin').update({ resolvida: true, resolvida_por: por, resolvida_em: iso(quando) }).eq('id', id).eq('resolvida', false).select('id'), 'resolverOcorrencia')
      return r.length === 1
    },
    async entregasRecentes(limite: number) { return (await ler(() => t('entregas_kit').select(C_ENTREGA).order('baixado_em', { ascending: false }).order('id'), limite)).map(entrega) },
    async entregasDaLicenca(licencaId: string, limite: number) {
      return (await ler(() => t('entregas_kit').select(C_ENTREGA).eq('licenca_id', licencaId).order('baixado_em', { ascending: false }).order('id'), limite)).map(entrega)
    },
    // ── Radar de pirataria (M33): só aviso, nada aqui mexe em licença ──
    async registrarEventoRadar(e: any) { ok(await t('radar_eventos').insert({ licenca_id: e.licenca_id, tipo: e.tipo, uf: e.uf ?? null, dispositivo: e.dispositivo ?? null, criado_em: iso(e.criado_em) }), 'registrarEventoRadar') },
    async eventosRadar(desde: Date) {
      return (await ler(() => t('radar_eventos').select('licenca_id,tipo,uf,dispositivo,criado_em').gte('criado_em', desde.toISOString()).order('criado_em').order('id'), 50000)).map((r: any) => ({ licenca_id: r.licenca_id, tipo: r.tipo, uf: r.uf ?? null, dispositivo: r.dispositivo ?? null, criado_em: new Date(r.criado_em) }))
    },
    async barradasDeTeste(desde: Date, minimo: number) {
      const l = await ler(() => t('degustacoes_dispositivos').select('dispositivo_hmac,licenca_id,barradas,ultima_barrada_em').gte('barradas', minimo).gte('ultima_barrada_em', desde.toISOString()).order('id'), 5000)
      return l.map((r: any) => ({ dispositivo: String(r.dispositivo_hmac).slice(0, 8), licenca_id: r.licenca_id, barradas: r.barradas, ultima_em: new Date(r.ultima_barrada_em) })) // nunca o HMAC inteiro
    },
    async baixasRadar() { return (await ler(() => t('radar_baixas').select('sinal_id,resolvida_em').order('sinal_id'), 20000)).map((r: any) => ({ sinal_id: r.sinal_id, resolvida_em: new Date(r.resolvida_em) })) },
    async baixarSinalRadar(id: string, por: string, quando: Date) {
      ok(await t('radar_baixas').upsert({ sinal_id: id, resolvida_por: por, resolvida_em: iso(quando) }, { onConflict: 'sinal_id' }), 'baixarSinalRadar')
    },
    async limparEventosRadar(antes: Date) { return ok(await t('radar_eventos').delete().lt('criado_em', antes.toISOString()).select('id'), 'limparEventosRadar').length },
    async registrarEventoPolitica(e: any) { ok(await t('politica_eventos').insert({ licenca_id: e.licenca_id, obra_id: e.obra_id, onde: e.onde, texto: e.texto, criado_em: iso(e.criado_em) }), 'registrarEventoPolitica') },
    async eventosPoliticaDaObra(licencaId: string, obraId: string, desde: Date) {
      return (await ler(() => t('politica_eventos').select('licenca_id,obra_id,onde,texto,criado_em').eq('licenca_id', licencaId).eq('obra_id', obraId).gte('criado_em', desde.toISOString()).order('criado_em').order('id'))).map(eventoPolitica)
    },
    async eventosPoliticaRecentes(desde: Date, limite: number) {
      return (await ler(() => t('politica_eventos').select('licenca_id,obra_id,onde,texto,criado_em').gte('criado_em', desde.toISOString()).order('criado_em', { ascending: false }).order('id'), limite)).map(eventoPolitica)
    },
    async situacoesPolitica(licencaId: string) { return (await ler(() => t('politica_obras').select('licenca_id,obra_id,situacao,desde,decidido_por').eq('licenca_id', licencaId).order('obra_id'))).map(situacaoPolitica) },
    async situacoesPoliticaAbertas() { return (await ler(() => t('politica_obras').select('licenca_id,obra_id,situacao,desde,decidido_por').in('situacao', ['embargada', 'recusada']).order('desde', { ascending: false }).order('obra_id'))).map(situacaoPolitica) },
    async definirSituacaoPolitica(s: any) { ok(await t('politica_obras').upsert({ licenca_id: s.licenca_id, obra_id: s.obra_id, situacao: s.situacao, desde: iso(s.desde), decidido_por: s.decidido_por ?? null }, { onConflict: 'licenca_id,obra_id' }), 'definirSituacaoPolitica') },
    async salvarConviteTeste(c: any) { ok(await t('lojas_convites').upsert({ codigo: c.codigo, licenca_id: c.licenca_id, obra_id: c.obra_id, app_nome: c.app_nome, grupo_url: c.grupo_url, optin_url: c.optin_url, criado_em: iso(c.criado_em) }, { onConflict: 'codigo' }), 'salvarConviteTeste') },
    async conviteTestePorCodigo(codigo: string) { const l = await ler(() => t('lojas_convites').select(C_CONVITE).eq('codigo', codigo), 1); return l[0] ? conviteTeste(l[0]) : null },
    async conviteTesteDaObra(licencaId: string, obraId: string) { const l = await ler(() => t('lojas_convites').select(C_CONVITE).eq('licenca_id', licencaId).eq('obra_id', obraId), 1); return l[0] ? conviteTeste(l[0]) : null },
    async registrarTestador(x: any) { ok(await t('lojas_testadores').insert({ codigo: x.codigo, nome: x.nome, entrou_em: iso(x.entrou_em) }), 'registrarTestador') },
    async testadoresDoConvite(codigo: string) { return (await ler(() => t('lojas_testadores').select('codigo,nome,entrou_em').eq('codigo', codigo).order('entrou_em').order('id'), 500)).map((r: any) => ({ codigo: r.codigo, nome: r.nome, entrou_em: new Date(r.entrou_em) })) },
    async entregasPorMarca(marca: string) { return (await ler(() => t('entregas_kit').select(C_ENTREGA).eq('marca_dagua', marca).order('baixado_em', { ascending: false }).order('id'))).map(entrega) },
  }
}

// ── Kit no Storage privado ──
const MAX_ARQUIVOS = 500
const MAX_PROFUNDIDADE = 8

async function listarRecursivo(bucket: any, prefixo: string, prof = 0, acc: string[] = []): Promise<string[]> {
  if (prof > MAX_PROFUNDIDADE) throw new Error('kit: pastas fundas demais')
  const itens = ok(await bucket.list(prefixo, { limit: 1000, sortBy: { column: 'name', order: 'asc' } }), 'kit.list')
  for (const it of itens) {
    const caminho = prefixo ? `${prefixo}/${it.name}` : it.name
    if (it.id === null) await listarRecursivo(bucket, caminho, prof + 1, acc) // pasta
    else acc.push(caminho)
    if (acc.length > MAX_ARQUIVOS) throw new Error('kit: arquivos demais')
  }
  return acc
}

/** Carrega o kit de uma obra: o kit EMBUTIDO na função (kit-embutido.ts, gerado do .claude/ do repositório) + o bucket
 *  base/ + <obra>/ (o bucket vence pelo mesmo caminho). Só em memória. Sem nada no bucket (ou sem bucket), entrega o embutido:
 *  24/11/2026, o bucket estava vazio e nenhuma obra começava ("código: kit-indisponivel"). */
export function criarCarregarKit() {
  return async (obraId: string) => {
    // Só slug/UUID seguro: começa com alfanumérico, só [a-z0-9-] depois. Rejeita ".", "..", ponto inicial e separadores — o valor vira prefixo do bucket.list.
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/i.test(obraId)) throw new Error('kit: obra inválida')
    const doStorage: { caminho: string; conteudo: string }[] = []
    try {
      const bucket = db().storage.from(Deno.env.get('ATLAS_KIT_BUCKET') ?? 'kit')
      for (const raiz of ['base', obraId]) {
        for (const completo of await listarRecursivo(bucket, raiz)) {
          const { data, error } = await bucket.download(completo)
          if (error || !data) throw new Error(`kit: não consegui ler ${completo}`)
          doStorage.push({ caminho: completo.slice(raiz.length + 1), conteudo: await data.text() })
        }
      }
    } catch (e) {
      if (doStorage.length > 0) throw e // leu parte e falhou: não entrega kit pela metade
      // sem bucket ou vazio: segue só com o embutido
    }
    const kit = juntarKit(KIT_EMBUTIDO, doStorage)
    if (kit.length === 0) throw new Error('kit: vazio')
    return kit
  }
}

// ── Instalador para baixar (pasta PRIVADA do Storage; a página só recebe um endereço temporário) ──
/** Liga o download quando ATLAS_INSTALADOR_ARQUIVO está definido (ver instalador-storage.ts).
 *  Sem ele devolve undefined: a página continua dizendo que o instalador ainda não está disponível. */
/** Links provisórios do protótipo: pasta PRIVADA "prototipos" (criada na primeira vez), um <token>.json por link. */
export function criarArmazemPrototipos() {
  const BUCKET = 'prototipos'
  const pasta = () => db().storage.from(BUCKET)
  return {
    async guardar(token: string, p: unknown) {
      const corpo = new Blob([JSON.stringify(p)], { type: 'application/json' })
      let r = await pasta().upload(`${token}.json`, corpo, { upsert: false, contentType: 'application/json' })
      if (r.error && /not.?found|bucket/i.test(String((r.error as { message?: string }).message ?? r.error))) {
        await db().storage.createBucket(BUCKET, { public: false })
        r = await pasta().upload(`${token}.json`, corpo, { upsert: false, contentType: 'application/json' })
      }
      if (r.error) throw new Error(`prototipo upload: ${String((r.error as { message?: string }).message ?? r.error)}`)
    },
    async ler(token: string) {
      const { data, error } = await pasta().download(`${token}.json`)
      if (error || !data || data.size > 2_000_000) return null
      return JSON.parse(await data.text())
    },
  }
}

/** Atualização automática do app: mesma pasta e mesmo .exe do instalador, mais o atualizacao.json. Sem configuração: undefined. */
export function criarAtualizacao() {
  const cfg = lerConfigInstalador((nome) => Deno.env.get(nome))
  if (!cfg) return undefined
  const doBucket = (bucket: string) => db().storage.from(bucket)
  // M48: o Mac tem a sua (o .zip do Atlas.app e o atualizacao-mac.json), na mesma pasta privada.
  return { windows: criarFonteAtualizacaoStorage(cfg, doBucket), mac: criarFonteAtualizacaoStorage({ ...cfg, arquivo: ARQUIVO_ATUALIZACAO_MAC }, doBucket, ARQUIVO_MANIFESTO_MAC) }
}

export function criarInstalador(): { link: (nomeDoDownload: string) => Promise<string | null> } | undefined {
  const cfg = lerConfigInstalador((nome) => Deno.env.get(nome))
  return cfg ? { link: criarLinkInstaladorStorage(cfg, (bucket) => db().storage.from(bucket)) } : undefined
}

// ── E-mail (provedor configurável; padrão Resend) ──
export interface MensagemEmail { para: string; assunto: string; texto: string; html: string }
export type EnviadorEmail = (m: MensagemEmail) => Promise<void>

/** Resend: HTTP POST com RESEND_API_KEY (do usuário). Sem chave ou sem remetente: erro claro, nunca finge envio. */
export const enviadorResend: EnviadorEmail = async (m) => {
  const chave = Deno.env.get('RESEND_API_KEY')
  const de = Deno.env.get('ATLAS_EMAIL_FROM')
  if (!chave) throw new Error('e-mail não configurado: defina RESEND_API_KEY nos segredos do servidor.')
  if (!de) throw new Error('e-mail não configurado: defina ATLAS_EMAIL_FROM (remetente verificado no provedor).')
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: remetentePessoal(de), to: [m.para], subject: m.assunto, text: m.texto, html: m.html }),
  })
  if (!r.ok) throw new Error(`e-mail não enviado: o provedor respondeu ${r.status}.`) // sem corpo/chave no erro
}

let enviador: EnviadorEmail = enviadorResend
/** Troca o provedor de e-mail (ex.: outro serviço) sem mexer no resto. */
export function definirEnviadorEmail(e: EnviadorEmail) { enviador = e }

export async function enviarCodigo(email: string, codigo: string, idioma?: 'pt' | 'en') {
  const m = montarCodigoAtivacao({ codigo, idioma })
  await enviador({ para: email, assunto: m.assunto, texto: m.texto, html: m.html })
}

/** Código de entrada (celular/conta): o e-mail do Atlas, não o envio padrão do Supabase Auth. */
export async function enviarCodigoEntrada(email: string, codigo: string, nome?: string) {
  const m = montarCodigoAtivacao({ codigo, nome, finalidade: 'entrada', validade_min: 60 })
  await enviador({ para: email, assunto: m.assunto, texto: m.texto, html: m.html })
}

/** Gera o código de entrada no Supabase Auth com a service_role, SEM mandar e-mail (admin/generate_link, tipo magiclink → email_otp).
 *  Se o login ainda não existe (cortesia ou compra que nunca entrou), cria já confirmado: só chega aqui quem tem licença. */
export async function gerarCodigoEntrada(email: string): Promise<string> {
  const url = Deno.env.get('SUPABASE_URL')
  const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !chave) throw new Error('auth não configurado')
  const h = { Authorization: `Bearer ${chave}`, apikey: chave, 'Content-Type': 'application/json' }
  const gerar = () => fetch(`${url}/auth/v1/admin/generate_link`, { method: 'POST', headers: h, body: JSON.stringify({ type: 'magiclink', email }) })
  let r = await gerar()
  if (!r.ok) {
    const c = await fetch(`${url}/auth/v1/admin/users`, { method: 'POST', headers: h, body: JSON.stringify({ email, email_confirm: true }) })
    if (!c.ok && c.status !== 422) throw new Error(`auth admin users: ${c.status}`)
    r = await gerar()
  }
  if (!r.ok) throw new Error(`auth generate_link: ${r.status}`)
  const j = await r.json()
  const otp = String(j?.email_otp ?? j?.properties?.email_otp ?? '')
  if (!/^\d{6,10}$/.test(otp)) throw new Error('auth generate_link: sem código')
  return otp
}

export async function enviarAvisoAtraso(email: string, aviso: { n: 1 | 2 | 3; pausa_em: Date; nome: string }) {
  const m = montarAvisoAtraso(aviso)
  await enviador({ para: email, assunto: m.assunto, texto: m.texto, html: m.html })
}

export async function enviarBoasVindas(email: string, d: { nome: string; empresa: string; ramo: string; token: string; expira_em: Date; idioma?: 'pt' | 'en' }) {
  const base = urlPublica(Deno.env.get('ATLAS_INSTALAR_URL'), 'https://atlas-ia.app.br/instalar')
  // M31: licença em inglês abre a página de instalação em inglês.
  const link = `${base}?t=${encodeURIComponent(d.token)}${d.idioma === 'en' ? '&idioma=en' : ''}`
  const m = montarBoasVindas({ nome: d.nome, empresa: d.empresa, ramo: d.ramo, expira_em: d.expira_em, link_instalacao: link, idioma: d.idioma })
  await enviador({ para: email, assunto: m.assunto, texto: m.texto, html: m.html })
}

/** Endereço de instalação de um link de uso único (o mesmo no e-mail da cortesia e no "Copiar link" do painel). */
export function linkInstalar(token: string): string {
  const base = urlPublica(Deno.env.get('ATLAS_INSTALAR_URL'), 'https://atlas-ia.app.br/instalar')
  return `${base}?t=${encodeURIComponent(token)}`
}

export async function enviarCortesia(email: string, d: { token: string; expira_em: Date; validade_em: Date; nome?: string }) {
  const m = montarCortesia({ nome: d.nome, validade_em: d.validade_em, link_expira_em: d.expira_em, link: linkInstalar(d.token) })
  await enviador({ para: email, assunto: m.assunto, texto: m.texto, html: m.html })
}

export async function enviarConfirmacaoDegustacao(email: string, d: { token: string; expira_em: Date; dias: number }) {
  const base = urlPublica(Deno.env.get('ATLAS_DEGUSTACAO_URL'), 'https://atlas-ia.app.br/degustacao')
  const m = montarConfirmacaoDegustacao({ dias: d.dias, expira_em: d.expira_em, link: `${base}?t=${encodeURIComponent(d.token)}` })
  await enviador({ para: email, assunto: m.assunto, texto: m.texto, html: m.html })
}

/** M33: canal celular ↔ notebook nas tabelas celular_* (0029). Sempre filtrado pela licença. */
// ── M41: avisos no celular (Web Push) ──
export function criarCanalPush(): CanalPush {
  const t = () => db().from('celular_push')
  return {
    async guardar(l, a) { ok(await t().upsert({ licenca_id: l, endpoint: a.endpoint, p256dh: a.p256dh, auth: a.auth, criada_em: iso(a.criada_em) }, { onConflict: 'licenca_id,endpoint' }), 'push guardar') },
    async listar(l) {
      const r = ok(await t().select('endpoint,p256dh,auth,criada_em').eq('licenca_id', l), 'push listar') as any[]
      return (r ?? []).map((x) => ({ endpoint: x.endpoint, p256dh: x.p256dh, auth: x.auth, criada_em: new Date(x.criada_em) }))
    },
    async apagar(l, endpoint) { ok(await t().delete().eq('licenca_id', l).eq('endpoint', endpoint), 'push apagar') },
  }
}

/** Envia pelo web-push (VAPID). Sem as 3 chaves nos segredos: undefined (as rotas de aviso respondem 503). */
export function criarEnvioPush(publica?: string, privada?: string, assunto?: string): EnvioPush | undefined {
  if (!publica || !privada || !assunto) return undefined
  let lib: any = null
  return async (a, corpo) => {
    if (!lib) { lib = (await import('npm:web-push@3.6.7')).default; lib.setVapidDetails(assunto, publica, privada) }
    try {
      await lib.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, corpo, { TTL: 6 * 3600 })
      return 'ok'
    } catch (e: any) {
      return e && (e.statusCode === 404 || e.statusCode === 410) ? 'fim' : 'erro'
    }
  }
}

export function criarCanalCelular(): CanalCelular {
  const t = (n: string) => db().from(n)
  const pedido = (r: any): Pedido => ({ ...r, dados: r.dados ?? {}, criado_em: new Date(r.criado_em), entregue_em: dt(r.entregue_em) })
  return {
    async sinal(l, agora, ocupado) { ok(await t('celular_sinal').upsert({ licenca_id: l, visto_em: iso(agora), ocupado }), 'celular sinal') },
    async ultimoSinal(l) {
      const r = ok(await t('celular_sinal').select('visto_em,ocupado').eq('licenca_id', l).maybeSingle(), 'celular ultimoSinal') as any
      return r ? { visto_em: new Date(r.visto_em), ocupado: r.ocupado ?? null } : null
    },
    async criarPedido(p) {
      ok(await t('celular_pedidos').insert({ id: p.id, licenca_id: p.licenca_id, tipo: p.tipo, obra_id: p.obra_id, dados: p.dados, estado: p.estado, mensagem: p.mensagem, criado_em: iso(p.criado_em) }), 'celular criarPedido')
    },
    async contarAbertos(l) {
      const r = await t('celular_pedidos').select('id', { count: 'exact', head: true }).eq('licenca_id', l).in('estado', ['pendente', 'entregue'])
      ok(r, 'celular contarAbertos')
      return r.count ?? 0
    },
    async levarPedidos(l, agora, reentregaMs, limite) {
      const linhas = (await rpc('levar_pedidos_celular', { p_licenca: l, p_agora: iso(agora), p_reentrega_ms: reentregaMs, p_limite: limite })) as any[]
      return (linhas ?? []).map(pedido).sort((a, b) => a.criado_em.getTime() - b.criado_em.getTime())
    },
    async responder(l, id, estado, mensagem) {
      const r = ok(await t('celular_pedidos').update({ estado, mensagem }).eq('id', id).eq('licenca_id', l).select('id'), 'celular responder') as any[]
      return r.length > 0
    },
    async pedidosRecentes(l, limite) {
      return (await ler(() => t('celular_pedidos').select('*').eq('licenca_id', l).order('criado_em', { ascending: false }), limite)).map(pedido)
    },
    async salvarProjeto(l, p) {
      const { obra_id, telas_token, atualizado_em, ...dados } = p
      ok(await t('celular_projetos').upsert({ licenca_id: l, obra_id, dados, telas_token, atualizado_em: iso(atualizado_em) }), 'celular salvarProjeto')
    },
    async projetos(l) {
      const linhas = await ler(() => t('celular_projetos').select('obra_id,dados,telas_token,atualizado_em').eq('licenca_id', l).order('atualizado_em', { ascending: false }), 50)
      return linhas.map((r: any) => ({ ...r.dados, obra_id: r.obra_id, telas_token: r.telas_token ?? null, atualizado_em: new Date(r.atualizado_em) }))
    },
    async salvarTeste(l, x) {
      ok(await t('celular_testes').upsert({ licenca_id: l, obra_id: x.obra_id, dados: x.dados, atualizado_em: iso(x.atualizado_em) }), 'celular salvarTeste')
    },
    async testes(l) {
      const linhas = await ler(() => t('celular_testes').select('obra_id,dados,atualizado_em').eq('licenca_id', l).order('atualizado_em', { ascending: false }), 20)
      return linhas.map((r: any) => ({ obra_id: r.obra_id, dados: r.dados ?? {}, atualizado_em: new Date(r.atualizado_em) }))
    },
    async guardarReferencia(id, r) { ok(await t('celular_referencias').insert({ id, licenca_id: r.licenca_id, imagem: r.imagem, criada_em: iso(r.criada_em) }), 'celular guardarReferencia') },
    async contarReferencias(l) {
      const r = await t('celular_referencias').select('id', { count: 'exact', head: true }).eq('licenca_id', l)
      ok(r, 'celular contarReferencias')
      return r.count ?? 0
    },
    async tirarReferencia(l, id) {
      const r = ok(await t('celular_referencias').delete().eq('id', id).eq('licenca_id', l).select('licenca_id,imagem,criada_em'), 'celular tirarReferencia') as any[]
      return r[0] ? { licenca_id: r[0].licenca_id, imagem: r[0].imagem, criada_em: new Date(r[0].criada_em) } : null
    },
    async referenciaExiste(l, id) {
      const r = ok(await t('celular_referencias').select('id').eq('id', id).eq('licenca_id', l).maybeSingle(), 'celular referenciaExiste')
      return !!r
    },
  }
}

/** M47: o arquivo do Mac (.dmg) na mesma pasta privada. Liga com ATLAS_INSTALADOR_MAC_ARQUIVO; sem ele a página diz que a versão
 *  para Mac ainda não está disponível (e oferece a do Windows). */
export function criarInstaladorMac(): { link: (nomeDoDownload: string) => Promise<string | null> } | undefined {
  const cfg = lerConfigInstalador((nome) => (nome === 'ATLAS_INSTALADOR_ARQUIVO' ? Deno.env.get('ATLAS_INSTALADOR_MAC_ARQUIVO') : Deno.env.get(nome)))
  return cfg ? { link: criarLinkInstaladorStorage(cfg, (bucket) => db().storage.from(bucket)) } : undefined
}
