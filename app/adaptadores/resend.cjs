// Resend, o carteiro (Luiz, 28/11/2026, protótipo aprovado telas 2 e 3): a 4ª conta, opcional, que deixa o sistema mandar e-mail
// para qualquer pessoa (senha, convites, avisos). O envio padrão do Supabase só entrega para a equipe do projeto, 2 por hora.
//  guardarChave(chave): confere a chave na API do Resend (precisa ver os domínios = "Full access") e guarda no cofre.
//  escolherDominio(dominio): cria o domínio no Resend (região São Paulo), pede a verificação e guarda { dominio, id } (sem segredo).
//  conferir(): pergunta ao Resend se os registros de DNS já chegaram. Verificado => chave só de envio (para o Supabase) no cofre.
//  paraSupabase(): { dominio, senha } quando está tudo pronto (a senha é a chave só de envio), senão null.
// A conta é do cliente. Nenhuma chave vai para arquivo nem para a tela.
'use strict'
const fs = require('node:fs')
const path = require('node:path')

const CHAVE = 'atlas/resend'
const CHAVE_ENVIO = 'atlas/resend-envio'
const FORMATO = /^re_[A-Za-z0-9_]{16,120}$/
const DOMINIO = /^(?=.{4,190}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/
const ID = /^[0-9a-f-]{8,64}$/i

/** Só estes caminhos da API do Resend, com a chave no cabeçalho. */
function caminhoPermitido(metodo, caminho) {
  return (metodo === 'GET' && caminho === '/domains')
    || (metodo === 'POST' && caminho === '/domains')
    || (metodo === 'GET' && /^\/domains\/[0-9a-f-]{8,64}$/i.test(caminho))
    || (metodo === 'POST' && /^\/domains\/[0-9a-f-]{8,64}\/verify$/i.test(caminho))
    || (metodo === 'POST' && caminho === '/api-keys')
}

function criarPedirResend(pedir) {
  return async function pedirResend(metodo, caminho, corpo, chave) {
    if (!caminhoPermitido(metodo, caminho)) throw new Error('caminho-invalido')
    if (typeof chave !== 'string' || !FORMATO.test(chave)) throw new Error('sem-token')
    const r = await pedir({ host: 'api.resend.com', metodo, caminho, corpo, cabecalhos: { Accept: 'application/json', Authorization: `Bearer ${chave}` } })
    let j = null
    try { j = JSON.parse(r.corpo || 'null') } catch { j = null }
    if (r.status < 200 || r.status >= 300) {
      const msg = String((j && (j.name || j.message)) || '').slice(0, 160)
      throw Object.assign(new Error(`resend-${r.status}`), msg ? { detalhe: msg } : {})
    }
    return j
  }
}

const REGISTRO_STATUS = { verified: 'ok', pending: 'esperando', not_started: 'esperando', failed: 'falhou', temporary_failure: 'esperando' }
function registrosDe(d) {
  const lista = Array.isArray(d && d.records) ? d.records : []
  return lista.slice(0, 8).map((x) => ({
    tipo: String(x.type || x.record || '').toUpperCase().slice(0, 8),
    nome: String(x.name || '').slice(0, 120),
    valor: String(x.value || '').slice(0, 600),
    ...(x.priority !== undefined && x.priority !== null ? { prioridade: Number(x.priority) } : {}),
    estado: REGISTRO_STATUS[String(x.status || '')] || 'esperando',
  }))
}

function criarResend({ cofre, dados, pedir, agora = () => new Date(), vercel = null, resolvedor = null, rdapCom = null }) {
  const pedirResend = criarPedirResend(pedir)
  const arquivo = path.join(dados, 'resend.json')
  const ler = () => { try { const j = JSON.parse(fs.readFileSync(arquivo, 'utf8')); return j && typeof j === 'object' ? j : {} } catch { return {} } }
  const gravar = (j) => { fs.mkdirSync(dados, { recursive: true }); const tmp = `${arquivo}.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify(j) + '\n'); fs.renameSync(tmp, arquivo) }
  const chave = async () => { try { const c = await cofre.ler(CHAVE); return FORMATO.test(String(c || '')) ? c : null } catch { return null } }

  async function situacao() {
    const c = await chave()
    const j = ler()
    const dominio = typeof j.dominio === 'string' && DOMINIO.test(j.dominio) ? j.dominio : null
    const estado = !dominio ? 'sem-dominio' : j.estado === 'verificado' ? 'verificado' : j.estado === 'falhou' ? 'falhou' : 'esperando'
    return { ligado: !!c, dominio, estado, registros: Array.isArray(j.registros) ? j.registros : [], remetente: dominio ? `nao-responda@${dominio}` : null, pelaVercel: j.pelaVercel === true }
  }

  const api = {
    situacao,
    async guardarChave(texto) {
      const c = String(texto ?? '').trim()
      if (!FORMATO.test(c)) return { ok: false, motivo: 'formato' }
      try { await pedirResend('GET', '/domains', null, c) } catch (e) {
        const m = String(e && e.message)
        if (m === 'resend-401') return { ok: false, motivo: 'recusada' }
        if (m === 'resend-403' || m === 'resend-400') return { ok: false, motivo: 'sem-permissao' } // chave "Sending access": não vê domínios
        return { ok: false, motivo: 'sem-internet' }
      }
      await cofre.guardar(CHAVE, c)
      return { ok: true }
    },
    async escolherDominio(texto) {
      const dominio = String(texto ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
      if (!DOMINIO.test(dominio) || /\.vercel\.app$|\.resend\.dev$/.test(dominio)) throw new Error('dominio-invalido')
      const c = await chave()
      if (!c) throw new Error('resend-sem-chave')
      let d = null
      const lista = await pedirResend('GET', '/domains', null, c)
      const existentes = Array.isArray(lista && lista.data) ? lista.data : []
      const ja = existentes.find((x) => x && String(x.name).toLowerCase() === dominio)
      if (ja && ID.test(String(ja.id))) d = await pedirResend('GET', `/domains/${ja.id}`, null, c)
      else d = await pedirResend('POST', '/domains', { name: dominio, region: 'sa-east-1' }, c)
      if (!d || !ID.test(String(d.id))) throw new Error('resend-falhou')
      try { await pedirResend('POST', `/domains/${d.id}/verify`, null, c) } catch { /* a conferência pede de novo */ }
      gravar({ dominio, id: d.id, estado: d.status === 'verified' ? 'verificado' : 'esperando', registros: registrosDe(d), desde: agora().toISOString() })
      return situacao()
    },
    /** Domínios da conta Vercel do cliente (U1UsarSistema, aba 3): quais usam os servidores da Vercel (aí o Atlas cria os
     *  registros sozinho). O .vercel.app não serve para e-mail. */
    async dominiosNaVercel() {
      if (!vercel) return []
      const r = await vercel(['domains', 'ls'], { timeoutMs: 60_000 })
      if (!r || r.codigo !== 0) throw new Error('vercel-dominios')
      const vistos = []
      for (const linha of String(r.saida || '').split(/\r?\n/)) {
        const tok = linha.trim().split(/\s+/)[0] || ''
        const d = tok.toLowerCase()
        if (DOMINIO.test(d) && !/\.vercel\.app$/.test(d) && !vistos.includes(d)) vistos.push(d)
      }
      const res = resolvedor ? resolvedor() : null
      const out = []
      for (const d of vistos.slice(0, 30)) {
        let ns = []
        try { ns = res ? await res.resolveNs(d) : [] } catch { ns = [] }
        out.push({ dominio: d, servidoresVercel: ns.length > 0 && ns.every((x) => /\.vercel-dns\.com\.?$/i.test(String(x))) })
      }
      return out
    },
    /** Domínio nos servidores da Vercel: cadastra no Resend e cria cada registro pedido na Vercel do cliente. */
    async ligarPelaVercel(texto) {
      const dominio = String(texto ?? '').trim().toLowerCase()
      if (!DOMINIO.test(dominio) || /\.vercel\.app$/.test(dominio)) throw new Error('dominio-invalido')
      if (!vercel) throw new Error('vercel-dns-recusou')
      const s = await api.escolherDominio(dominio)
      for (const reg of s.registros) {
        if (!/^(TXT|MX|CNAME)$/.test(reg.tipo) || !/^[a-z0-9._-]{1,120}$/i.test(reg.nome)) continue
        const args = ['dns', 'add', dominio, reg.nome, reg.tipo, reg.valor]
        if (reg.tipo === 'MX') args.push(String(Number(reg.prioridade) || 10))
        const r = await vercel(args, { timeoutMs: 60_000 })
        if (r && r.codigo !== 0 && !/already exists|duplicate/i.test(String(r.saida || ''))) throw new Error('vercel-dns-recusou')
      }
      gravar({ ...ler(), pelaVercel: true })
      try { await api.conferir() } catch { /* a vigia confere de minuto em minuto */ }
      return situacao()
    },
    /** Nome para comprar: só .com tem resposta oficial (RDAP da Verisign); o resto é incerto (a Vercel mostra na compra). */
    async nomeLivre(texto) {
      const d = String(texto ?? '').trim().toLowerCase()
      if (!DOMINIO.test(d)) return 'invalido'
      if (!/^[a-z0-9-]{1,63}\.com$/.test(d) || !rdapCom) return 'incerto'
      try { const st = await rdapCom(d); return st === 404 ? 'livre' : st === 200 ? 'ocupado' : 'incerto' } catch { return 'incerto' }
    },
    /** Pergunta ao Resend. Devolve a situação; `virouVerificado` true só na vez em que passou a verificado. */
    async conferir() {
      const j = ler()
      const c = await chave()
      if (!c || !j.id || !ID.test(String(j.id))) return { ...(await situacao()), virouVerificado: false }
      const d = await pedirResend('GET', `/domains/${j.id}`, null, c)
      const verificado = d && d.status === 'verified'
      const antes = j.estado
      if (!verificado && d && (d.status === 'not_started' || d.status === 'failed')) { try { await pedirResend('POST', `/domains/${j.id}/verify`, null, c) } catch { /* tenta na próxima */ } }
      if (verificado) {
        let envio = null
        try { envio = await cofre.ler(CHAVE_ENVIO) } catch { envio = null }
        if (!FORMATO.test(String(envio || ''))) {
          const k = await pedirResend('POST', '/api-keys', { name: `Atlas · e-mails do sistema (${j.dominio})`, permission: 'sending_access', domain_id: j.id }, c)
          if (!k || !FORMATO.test(String(k.token || ''))) throw new Error('resend-falhou')
          await cofre.guardar(CHAVE_ENVIO, k.token)
        }
      }
      gravar({ ...j, estado: verificado ? 'verificado' : d && d.status === 'failed' ? 'falhou' : 'esperando', registros: registrosDe(d) })
      return { ...(await situacao()), virouVerificado: verificado && antes !== 'verificado' }
    },
    async paraSupabase() {
      const s = await situacao()
      if (s.estado !== 'verificado') return null
      let senha = null
      try { senha = await cofre.ler(CHAVE_ENVIO) } catch { senha = null }
      return FORMATO.test(String(senha || '')) ? { dominio: s.dominio, senha } : null
    },
  }
  return api
}

module.exports = { criarResend, criarPedirResend, caminhoPermitido, CHAVE, CHAVE_ENVIO }
