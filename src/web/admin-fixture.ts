// Modo demonstração do painel do administrador: dados de mentira, em memória, só para olhar e clicar sem servidor.
// Só entra quando modoFixture() é verdadeiro (dev). Em produção o App usa criarAdminApi() (login + lista de admins no servidor).
import type { AdminApi, DominioBloqueado, FluxoCaixa, ItemAtencao, LinhaCadastro, LinhaCliente, LinhaEntrega, PainelAdmin } from './admin-api'

const HORA = 3600_000
const DIA = 24 * HORA
const atras = (agora: number, ms: number) => new Date(agora - ms).toISOString()
const isoMes = (agora: number, voltar: number) => {
  const d = new Date(agora); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - voltar)
  return d.toISOString().slice(0, 7)
}
const primeiroNome = (n: string) => n.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function criarAdminFixture(agora: number = Date.now()): AdminApi {
  const c = (id: string, nome: string, empresa: string, ramo: string, situacao: LinhaCliente['situacao'], obras: number, sinalMs: number | null, extra: Partial<LinhaCliente> = {}): LinhaCliente =>
    ({ licenca_id: id, nome, empresa, ramo, situacao, obras, ultimo_sinal_em: sinalMs === null ? null : atras(agora, sinalMs), travado_em: null, ...extra })

  const clientes: LinhaCliente[] = [
    c('lic-01', 'Marina Alves', 'Barbearia do Zé', 'Barbearia', 'em_dia', 2, 2 * HORA),
    c('lic-02', 'Carlos Pinto', 'Restaurante Sabor da Casa', 'Restaurante', 'em_dia', 3, 5 * HORA),
    c('lic-03', 'Paula Nunes', 'Mercearia Nunes', 'Mercearia', 'em_dia', 1, 1 * DIA),
    c('lic-04', 'Rafael Souza', 'Academia Corpo em Forma', 'Academia', 'em_dia', 2, 3 * DIA),
    c('lic-05', 'Juliana Reis', 'Studio Juliana Reis', 'Estética', 'em_dia', 1, 30 * 60_000),
    c('lic-06', 'Eduardo Lima', 'Lima Autopeças', 'Autopeças', 'atrasada', 1, 4 * DIA),
    c('lic-07', 'Patrícia Gomes', 'Doces da Pat', 'Confeitaria', 'atrasada', 0, 6 * DIA),
    c('lic-08', 'Bruno Teixeira', 'Teixeira Contabilidade', 'Contabilidade', 'pausada', 1, 12 * DIA),
    c('lic-09', 'Sandra Melo', 'Pet Shop Melo', 'Pet shop', 'cancelada', 1, 40 * DIA),
    c('lic-10', 'Tiago Rocha', 'Rocha Fotografia', 'Fotografia', 'cancelada', 0, 55 * DIA),
    c('lic-11', 'Fernanda Dias', 'Clínica Sorriso', 'Odontologia', 'ativando', 0, null, { travado_em: 'cadastro' }),
    c('lic-12', 'Gustavo Prado', 'Prado Eventos', 'Eventos', 'ativando', 0, 3 * DIA, { travado_em: 'instalacao' }),
    c('lic-13', 'Amiga do Luiz', '', 'Cortesia', 'em_dia', 0, 1 * DIA, { tipo: 'cortesia', validade_em: atras(agora, -12 * DIA) }),
    c('lic-14', 'Cunhado Teste', '', 'Cortesia', 'em_dia', 1, 2 * DIA, { tipo: 'cortesia', validade_em: atras(agora, -5 * DIA) }),
  ]
  let atencao: ItemAtencao[] = [
    { id: 'at-1', tipo: 'travado', quem: 'Clínica Sorriso', oque: 'Comprou há 3 dias e ainda não respondeu o cadastro.', quando: atras(agora, 3 * DIA), licenca_id: 'lic-11' },
    { id: 'at-2', tipo: 'travado', quem: 'Prado Eventos', oque: 'Respondeu o cadastro, mas não instalou o Atlas.', quando: atras(agora, 3 * DIA), licenca_id: 'lic-12' },
    { id: 'at-3', tipo: 'atraso', quem: 'Doces da Pat', oque: 'Mensalidade atrasada há 6 dias. A licença pausa em 1 dia.', quando: atras(agora, 6 * DIA), licenca_id: 'lic-07' },
    { id: 'at-4', tipo: 'troca', quem: 'Studio Juliana Reis', oque: 'Pediu para trocar de computador antes dos 7 dias.', quando: atras(agora, 4 * HORA), licenca_id: 'lic-05' },
    { id: 'at-5', tipo: 'dominio', quem: 'Teste grátis', oque: 'Três pedidos seguidos com e-mail de @tempmail.dev.', quando: atras(agora, 1 * DIA), licenca_id: null, dominio_sugerido: 'tempmail.dev' },
  ]
  let dominios: DominioBloqueado[] = [
    { dominio: 'mailinator.com', motivo: 'e-mail temporário', criado_em: atras(agora, 30 * DIA) },
    { dominio: 'guerrillamail.com', motivo: 'e-mail temporário', criado_em: atras(agora, 20 * DIA) },
  ]
  let teste = { ativa: true, dias: 5 }
  const trocas = new Set<string>()
  const ativos = () => clientes.filter((x) => x.situacao === 'em_dia' && x.tipo !== 'cortesia').length
  const painel = (): PainelAdmin => ({
    gerado_em: new Date(agora).toISOString(),
    indicadores: {
      clientes_ativos: ativos(),
      receita: { recorrente_mensal: ativos() * 197, recebida_no_mes: (ativos() - 1) * 197 + 1490, implantacoes_recebidas_no_mes: 1490 },
      ativacoes: { no_mes: 6, meta: 10, computadores_ativos: ativos() + 2 },
      inadimplencia: { atrasadas: clientes.filter((x) => x.situacao === 'atrasada').length, pausadas: clientes.filter((x) => x.situacao === 'pausada').length, valor_em_aberto: 197 * 3 },
      travados: clientes.filter((x) => x.travado_em).length,
      cancelamentos_no_mes: 1,
    },
    atencao: atencao.map((a) => ({ ...a })),
    clientes: clientes.map((x) => ({ ...x })),
  })
  const cadastros: LinhaCadastro[] = clientes.filter((x) => x.tipo !== 'cortesia').map((x, n) => ({
    licenca_id: x.licenca_id, nome: x.nome, empresa: x.empresa, ramo: x.ramo, email: `${primeiroNome(x.nome)}@exemplo.com.br`,
    comprada_em: atras(agora, (60 - n * 4) * DIA), cadastro_em: x.travado_em === 'cadastro' ? null : atras(agora, (59 - n * 4) * DIA), situacao: x.travado_em === 'cadastro' ? 'pendente' : 'feito',
  }))
  const entregas: LinhaEntrega[] = [
    { licenca_id: 'lic-01', cliente: 'Barbearia do Zé', obra_id: 'agenda-barbearia', marca_dagua: 'ATL-7F3K-0001', baixado_em: atras(agora, 2 * DIA) },
    { licenca_id: 'lic-02', cliente: 'Restaurante Sabor da Casa', obra_id: 'cardapio-digital', marca_dagua: 'ATL-9QW2-0002', baixado_em: atras(agora, 4 * DIA) },
    { licenca_id: 'lic-02', cliente: 'Restaurante Sabor da Casa', obra_id: 'comandas', marca_dagua: 'ATL-9QW2-0003', baixado_em: atras(agora, 9 * DIA) },
    { licenca_id: 'lic-03', cliente: 'Mercearia Nunes', obra_id: 'estoque-mercearia', marca_dagua: 'ATL-1ZX8-0004', baixado_em: atras(agora, 15 * DIA) },
    { licenca_id: 'lic-04', cliente: 'Academia Corpo em Forma', obra_id: 'alunos-academia', marca_dagua: 'ATL-5MN4-0005', baixado_em: atras(agora, 21 * DIA) },
  ]
  const implantacoes = [2980, 4470, 2980, 5960, 4470, 1490]
  const prateleira = [297, 594, 891, 594, 1188, 495]
  const mensalidades = [788, 985, 1182, 1379, 1576, 1773]
  const fluxo: FluxoCaixa = {
    meses: [5, 4, 3, 2, 1, 0].map((voltar, n) => ({ mes: isoMes(agora, voltar), implantacoes: implantacoes[n], prateleira: prateleira[n], mensalidades: mensalidades[n] })),
  }
  const ok = <T extends object>(v: T) => Promise.resolve({ ok: true as const, ...v })
  return {
    logado: () => true,
    entrar: () => ok({}),
    eu: () => ok({ email: 'admin@demonstracao.local' }),
    painel: () => ok({ painel: painel() }),
    liberarTroca(licencaId) {
      const ja = trocas.has(licencaId)
      trocas.add(licencaId)
      return ok({ ja_liberada: ja })
    },
    resolverOcorrencia(id) { atencao = atencao.filter((a) => a.id !== id); return ok({}) },
    liberarCortesia(email, validadeEm, nome) {
      const e = email.trim().toLowerCase()
      const nomeC = nome?.trim() || e
      const ex = clientes.find((x) => x.tipo === 'cortesia' && x.nome === nomeC)
      if (ex) ex.validade_em = validadeEm
      else clientes.push(c(`lic-${String(clientes.length + 1).padStart(2, '0')}`, nomeC, '', 'Cortesia', 'em_dia', 0, null, { tipo: 'cortesia', validade_em: validadeEm }))
      return ok({ nova: !ex, validade_em: validadeEm })
    },
    degustacao(m = {}) {
      if (typeof m.dias === 'number' && (m.dias < 1 || m.dias > 30)) return Promise.resolve({ ok: false as const, mensagem: 'Escolha de 1 a 30 dias.' })
      if (typeof m.ativa === 'boolean') teste = { ...teste, ativa: m.ativa }
      if (typeof m.dias === 'number') teste = { ...teste, dias: Math.round(m.dias) }
      return ok({ ...teste })
    },
    dominios: () => ok({ dominios: dominios.map((d) => ({ ...d })) }),
    bloquearDominio(dominio) {
      const d = dominio.trim().toLowerCase()
      const ja = dominios.some((x) => x.dominio === d)
      if (!ja) dominios = [...dominios, { dominio: d, motivo: 'bloqueado por você', criado_em: new Date(agora).toISOString() }]
      return ok({ dominio: d, ja_existia: ja })
    },
    liberarDominio(dominio) { dominios = dominios.filter((x) => x.dominio !== dominio); return ok({ dominio }) },
    entregas(filtro = {}) {
      const m = filtro.marca?.trim().toLowerCase()
      return ok({ entregas: entregas.filter((e) => (!m || e.marca_dagua.toLowerCase() === m) && (!filtro.licenca_id || e.licenca_id === filtro.licenca_id)) })
    },
    cadastros: () => ok({ cadastros }),
    fluxoCaixa: () => ok({ fluxo }),
    sair() { /* demonstração: não há sessão para encerrar */ },
  }
}
