// Adaptador real do PonteOcorrencias (src/app/ponte-ocorrencia.ts) — processo principal do Electron (só Windows).
//
// O QUE FAZ
//  O livro de ocorrências do kit (.claude/hooks/ocorrencias.cjs) mora em <obra>\docs\ocorrencias.json. O kit NÃO fica no
//  repositório do cliente, então este adaptador lê e grava o MESMO formato direto (o teste confere paridade com o script do kit).
//  ler(pasta): a primeira ocorrência ABERTA que exige o cliente (cota é F10 e cobrança é outra parada: ficam de fora). Traduz com
//    espelho de ocorrenciaDoKit: motivo/ação/passos/serviço viram DADO (comoDado: sem HTML/Markdown, uma linha, tamanho limitado),
//    nunca executados, sem link nem imagem vindos de dado (print é só legenda). Quem escreveu a entrada pode ser um serviço externo.
//  resolver(pasta, id, segredo?): a chave colada vai ao COFRE (DPAPI, cofre.cjs) e NUNCA a arquivo/log/livro; só depois fecha a
//    ocorrência (status 'resolvida', nota fixa). Cofre indisponível = nada é fechado ('cofre-indisponivel'): nem a chave se perde
//    nem a ocorrência some. Segredo só vale para ocorrência que tem `campo`. Chave do cofre: oc/<hash da obra>/<id>.
//  adiar(pasta, id): registra uma `tentativa` ("adiada pelo cliente") e MANTÉM aberta; o resto da linha segue.
//  avisar(pasta, id): UMA vez por ocorrência e por canal (<obra>\.atlas\avisos.json guarda só {id, canal, em}, nunca o conteúdo).
//    Canais ainda NÃO EXISTEM neste computador, por isso nada finge: sem canal ligado devolve {celular:false, email:false} e a tela
//    diz isso com calma e mantém o passo a passo nela. PENDÊNCIA (app/PENDENTE-ENTREGAR.md): (a) celular depende da conexão do
//    Remote Control (celular.cjs); (b) e-mail precisa de um endpoint do servidor (Resend, autenticado pelo token do dispositivo,
//    como o /verificar) que mande o e-mail da conta do cliente; o e-mail do cliente fica no servidor, não em arquivo daqui.
//    Os canais entram por `canais: { celular(msg), email(msg) }` (async, devolvem true/false); msg = só título e motivo já limpos.
//
// COMO TESTAR (Windows): `node --test app/adaptadores/*.teste.cjs`. Na máquina: abrir uma ocorrência na obra
// (`node .claude/hooks/ocorrencias.cjs abrir ...` com CLAUDE_PROJECT_DIR=<obra>) e abrir o painel: a tela F11 aparece.
'use strict'
const crypto = require('node:crypto')
const { caminhoSeguro } = require('../seguro.cjs')
const { pastaDaObra, pastaAtlas, gravarAtomico, lerJson } = require('./obra-fs.cjs')
const { comoDado } = require('./plan-md.cjs')
const { tipoDaTrava } = require('./travas.cjs')

// Palavra inteira para cota (não casa "cotação", "escota").
const RE_COTA = /(?<!\p{L})(?:cota|quota|limite de uso|usage limit|rate.?limit)(?!\p{L})/iu
const RE_COBRANCA = /billing|cobran|pagamento|fatura|cart[aã]o/i
const MAX_SEGREDO = 4000

const str = (v) => (typeof v === 'string' ? v : '')
/** Igual a textoDaObra (ponte-cota.ts): uma linha, sem marcação, tamanho limitado. */
const textoDaObra = (t, max = 120) => comoDado(str(t), max).join(' ').slice(0, max).trim()

/** Espelho de ocorrenciaDoKit (src/app/ponte-ocorrencia.ts). Manter em sincronia. */
function ocorrenciaDoKit(o) {
  if (!o || o.status !== 'aberta' || !Number.isInteger(o.id)) return null
  const passos = (Array.isArray(o.passos) ? o.passos : []).slice(0, 12)
    .map((p) => ({ titulo: textoDaObra(p && p.titulo, 100), desc: textoDaObra(p && p.desc, 220), print: str(p && p.print) ? textoDaObra(p.print, 100) : undefined }))
    .filter((p) => p.titulo)
  const acao = textoDaObra(o.acao, 200)
  const min = typeof o.minutos === 'number' && o.minutos > 0 ? Math.min(Math.round(o.minutos), 240) : 5
  const campo = o.campo && str(o.campo.rotulo) ? { rotulo: textoDaObra(o.campo.rotulo, 80), dica: textoDaObra(o.campo.dica, 160) } : undefined
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

/** Esta entrada aberta é um caso do cliente (nem cota, que é F10, nem cobrança, nem trava conhecida, que tem ficha própria)? */
const exigeCliente = (o) => o && o.status === 'aberta' && !tipoDaTrava(o) && Number.isInteger(o.id) && !RE_COTA.test(`${str(o.servico)} ${str(o.motivo)}`) && !RE_COBRANCA.test(`${str(o.servico)} ${str(o.motivo)}`)

/**
 * `deps`: { raiz, cofre ({guardar}), canais?: { celular?, email? }, agora? }
 */
function criarOcorrencias({ raiz, cofre, canais = {}, agora = () => new Date() }) {
  const arquivoLivro = (pasta) => caminhoSeguro(raiz, pasta, 'docs', 'ocorrencias.json')
  const lerLivro = (pasta) => {
    pastaDaObra(raiz, pasta)
    const d = lerJson(arquivoLivro(pasta))
    return d && Array.isArray(d.ocorrencias) ? d : null
  }
  /** Grava no formato do kit (JSON de 2 espaços). Relê logo antes: a linha de produção também escreve no livro. */
  const gravarLivro = (pasta, d) => gravarAtomico(arquivoLivro(pasta), JSON.stringify(d, null, 2) + '\n')
  const achar = (pasta, id) => {
    if (!Number.isInteger(id)) throw new Error('ocorrencia-inexistente')
    const d = lerLivro(pasta)
    const o = d && d.ocorrencias.find((x) => x && x.id === id)
    if (!o || o.status !== 'aberta' || !exigeCliente(o)) throw new Error('ocorrencia-inexistente')
    return { d, o }
  }
  const arquivoAvisos = (pasta) => caminhoSeguro(raiz, pasta, '.atlas', 'avisos.json')
  const lerAvisos = (pasta) => { const a = lerJson(arquivoAvisos(pasta)); return a && Array.isArray(a.enviados) ? a.enviados : [] }

  return {
    async ler(pasta) {
      const d = lerLivro(pasta)
      if (!d) return null
      for (const o of d.ocorrencias) if (exigeCliente(o)) { const t = ocorrenciaDoKit(o); if (t) return t }
      return null
    },

    async avisar(pasta, id) {
      const { o } = achar(pasta, id)
      const t = ocorrenciaDoKit(o)
      const msg = { id, titulo: t.titulo, motivo: t.motivo, minutos: t.minutos }
      const ja = lerAvisos(pasta)
      const res = { celular: false, email: false }
      let mudou = false
      for (const canal of ['celular', 'email']) {
        if (ja.some((e) => e.id === id && e.canal === canal)) { res[canal] = true; continue } // uma vez só: não manda de novo
        const envia = canais[canal]
        if (typeof envia !== 'function') continue // sem canal ligado: não finge
        let ok = false
        try { ok = (await envia(msg)) === true } catch { ok = false }
        if (ok) { res[canal] = true; ja.push({ id, canal, em: agora().toISOString() }); mudou = true }
      }
      if (mudou) {
        const dir = pastaAtlas(raiz, pasta)
        gravarAtomico(require('node:path').join(dir, 'avisos.json'), JSON.stringify({ versao: 1, enviados: ja }) + '\n')
      }
      return res
    },

    async resolver(pasta, id, segredo) {
      const { o } = achar(pasta, id)
      const temSegredo = segredo !== undefined && segredo !== null && segredo !== ''
      // Ocorrência com `campo` pede uma chave: sem ela NÃO fecha (senão a linha seguiria sem a credencial).
      if (!temSegredo && o.campo && str(o.campo.rotulo)) throw new Error('segredo-obrigatorio')
      if (temSegredo) {
        // eslint-disable-next-line no-control-regex
        if (typeof segredo !== 'string' || segredo.length > MAX_SEGREDO || /[\u0000-\u001F\u007F]/.test(segredo)) throw new Error('segredo-invalido')
        if (!(o.campo && str(o.campo.rotulo))) throw new Error('campo-inexistente')
        const chave = `oc/${crypto.createHash('sha256').update(pasta).digest('hex').slice(0, 16)}/${id}`
        await cofre.guardar(chave, segredo) // falha (cofre-indisponivel) => nada é fechado
      }
      // Relê logo antes de gravar (a linha pode ter escrito no livro enquanto o cliente resolvia).
      const d = lerLivro(pasta)
      const atual = d && d.ocorrencias.find((x) => x && x.id === id)
      if (!atual || atual.status !== 'aberta') throw new Error('ocorrencia-inexistente')
      atual.status = 'resolvida'
      atual.resolvida_em = agora().toISOString()
      atual.nota_final = 'Resolvida pelo cliente no Atlas.'
      gravarLivro(pasta, d)
    },

    async adiar(pasta, id) {
      achar(pasta, id)
      const d = lerLivro(pasta)
      const atual = d && d.ocorrencias.find((x) => x && x.id === id)
      if (!atual || atual.status !== 'aberta') throw new Error('ocorrencia-inexistente')
      if (!Array.isArray(atual.tentativas)) atual.tentativas = []
      atual.tentativas.push({ em: agora().toISOString(), nota: 'Adiada pelo cliente no Atlas.' })
      gravarLivro(pasta, d)
    },
  }
}

module.exports = { criarOcorrencias, ocorrenciaDoKit, exigeCliente }
