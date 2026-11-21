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
//   substituirStatusObras / statusObrasDaLicenca   RPC substituir_status_obras (0022) / SELECT status_obras WHERE licenca_id
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

import { createClient } from 'npm:@supabase/supabase-js@2'
import { montarBoasVindas, montarConfirmacaoDegustacao, montarCortesia } from './emails.ts'
import { montarAvisoAtraso, montarCodigoAtivacao } from './emails-avisos.ts'
import { criarLinkInstaladorGitHub, lerConfigInstalador } from './instalador-github.ts'

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
}
const ativacao = (r: any) => r && { id: r.id, licenca_id: r.licenca_id, computador_hash: r.computador_hash, token_hash: r.token_hash ?? null, ativo: r.ativo, ativado_em: new Date(r.ativado_em), desativado_em: dt(r.desativado_em) }
const pagamento = (r: any) => r && { licenca_id: r.licenca_id, conta_gateway_id: r.conta_gateway_id ?? '', tipo: r.tipo, valor: Number(r.valor), status: r.status, gateway_ref: r.gateway_ref ?? '', gateway_pi: r.gateway_pi ?? null, pago_em: dt(r.pago_em), segmento: r.segmento ?? null }
const entrega = (r: any) => ({ licenca_id: r.licenca_id, obra_id: r.obra_id, marca_dagua: r.marca_dagua, baixado_em: new Date(r.baixado_em) })
const codigo = (r: any) => r && { id: r.id, cliente_id: r.cliente_id, finalidade: r.finalidade, codigo_hash: r.codigo_hash, tentativas: r.tentativas, expira_em: new Date(r.expira_em), usado_em: dt(r.usado_em) }
const link = (r: any) => r && { id: r.id, cliente_id: r.cliente_id, token_hash: r.token_hash, expira_em: new Date(r.expira_em), usado_em: dt(r.usado_em) }
const troca = (r: any) => ({ licenca_id: r.licenca_id, de_hash: r.de_hash, para_hash: r.para_hash ?? null, feita_em: new Date(r.feita_em), por_admin: r.por_admin })
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
      await rpc('substituir_status_obras', { p_licenca: licencaId, p_obras: obras.map((o) => ({ ...o, ultima_noticia_em: iso(o.ultima_noticia_em) })), p_agora: iso(agora) })
    },
    async statusObrasDaLicenca(licencaId: string) {
      const linhas = await ler(() => t('status_obras').select('obra_id,nome,segmento,etapa_atual_numero,etapa_atual_rotulo,total_etapas,percentual,estado,ativa_agora,ultima_noticia,ultima_noticia_em').eq('licenca_id', licencaId).order('obra_id'), 100)
      return linhas.map((r: any) => ({ ...r, segmento: r.segmento ?? null, ultima_noticia_em: new Date(r.ultima_noticia_em) }))
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

/** Carrega o kit de uma obra: base/ + <obra>/ (a obra vence). Só em memória; sem base e sem obra = erro (não entrega kit vazio). */
export function criarCarregarKit() {
  return async (obraId: string) => {
    // Só slug/UUID seguro: começa com alfanumérico, só [a-z0-9-] depois. Rejeita ".", "..", ponto inicial e separadores — o valor vira prefixo do bucket.list.
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/i.test(obraId)) throw new Error('kit: obra inválida')
    const bucket = db().storage.from(Deno.env.get('ATLAS_KIT_BUCKET') ?? 'kit')
    const mapa = new Map<string, string>() // caminho relativo -> conteúdo
    for (const raiz of ['base', obraId]) {
      for (const completo of await listarRecursivo(bucket, raiz)) {
        const rel = completo.slice(raiz.length + 1)
        const { data, error } = await bucket.download(completo)
        if (error || !data) throw new Error(`kit: não consegui ler ${completo}`)
        mapa.set(rel, await data.text())
      }
    }
    if (mapa.size === 0) throw new Error('kit: nenhum arquivo no bucket (suba o kit em base/ ou na pasta da obra)')
    return [...mapa].map(([caminho, conteudo]) => ({ caminho, conteudo }))
  }
}

// ── Instalador para baixar (release privada do GitHub; a página só recebe um endereço temporário) ──
/** Liga o download quando ATLAS_INSTALADOR_REPO e ATLAS_INSTALADOR_GITHUB_TOKEN estão definidos (ver instalador-github.ts).
 *  Sem eles devolve undefined: a página continua dizendo que o instalador ainda não está disponível. */
export function criarInstalador(): { link: () => Promise<string | null> } | undefined {
  const cfg = lerConfigInstalador((nome) => Deno.env.get(nome))
  return cfg ? { link: criarLinkInstaladorGitHub(cfg) } : undefined
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
    body: JSON.stringify({ from: de, to: [m.para], subject: m.assunto, text: m.texto, html: m.html }),
  })
  if (!r.ok) throw new Error(`e-mail não enviado: o provedor respondeu ${r.status}.`) // sem corpo/chave no erro
}

let enviador: EnviadorEmail = enviadorResend
/** Troca o provedor de e-mail (ex.: outro serviço) sem mexer no resto. */
export function definirEnviadorEmail(e: EnviadorEmail) { enviador = e }

export async function enviarCodigo(email: string, codigo: string) {
  const m = montarCodigoAtivacao({ codigo })
  await enviador({ para: email, assunto: m.assunto, texto: m.texto, html: m.html })
}

export async function enviarAvisoAtraso(email: string, aviso: { n: 1 | 2 | 3; pausa_em: Date; nome: string }) {
  const m = montarAvisoAtraso(aviso)
  await enviador({ para: email, assunto: m.assunto, texto: m.texto, html: m.html })
}

export async function enviarBoasVindas(email: string, d: { nome: string; empresa: string; ramo: string; token: string; expira_em: Date }) {
  const base = Deno.env.get('ATLAS_INSTALAR_URL') ?? 'https://atlas-ia.app.br/instalar'
  const m = montarBoasVindas({ nome: d.nome, empresa: d.empresa, ramo: d.ramo, expira_em: d.expira_em, link_instalacao: `${base}?t=${encodeURIComponent(d.token)}` })
  await enviador({ para: email, assunto: m.assunto, texto: m.texto, html: m.html })
}

export async function enviarCortesia(email: string, d: { token: string; expira_em: Date; validade_em: Date }) {
  const base = Deno.env.get('ATLAS_INSTALAR_URL') ?? 'https://atlas-ia.app.br/instalar'
  const m = montarCortesia({ validade_em: d.validade_em, link_expira_em: d.expira_em, link: `${base}?t=${encodeURIComponent(d.token)}` })
  await enviador({ para: email, assunto: m.assunto, texto: m.texto, html: m.html })
}

export async function enviarConfirmacaoDegustacao(email: string, d: { token: string; expira_em: Date; dias: number }) {
  const base = Deno.env.get('ATLAS_DEGUSTACAO_URL') ?? 'https://atlas-ia.app.br/degustacao'
  const m = montarConfirmacaoDegustacao({ dias: d.dias, expira_em: d.expira_em, link: `${base}?t=${encodeURIComponent(d.token)}` })
  await enviador({ para: email, assunto: m.assunto, texto: m.texto, html: m.html })
}
