// Diagnóstico da obra (M41, O4 aprovado pelo Luiz em 24/11/2026). Quando o vigia desiste de religar sozinho, o Atlas faz 10
// conferências e mostra cada uma com ✓ ou ✗ e uma dica de leigo. Nenhuma conferência trava as outras (cada uma tem tempo máximo)
// e nada aqui mostra senha, chave ou caminho técnico.
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { pastaDaObra, lerJson } = require('./obra-fs.cjs')
const { limparFala } = require('./vigia.cjs')

const ESPACO_MINIMO = 1e9 // 1 GB

function criarDiagnostico({ raiz, internet, claudeEstado, contas, kitDiretorio, espacoLivre, tempoMaxMs = 15_000 }) {
  const comTempo = (p) => Promise.race([Promise.resolve().then(p), new Promise((r) => setTimeout(() => r(undefined), tempoMaxMs))]).catch(() => undefined)

  async function diagnosticar(pasta) {
    let dir = null
    try { dir = pastaDaObra(raiz, pasta) } catch { dir = null }
    const linha = (() => { try { return dir ? lerJson(path.join(dir, '.atlas', 'linha.json')) : null } catch { return null } })()
    const [net, claude, sit] = await Promise.all([comTempo(() => internet()), comTempo(() => claudeEstado()), comTempo(() => contas.situacao())])
    const pastaOk = (() => { try { if (!dir) return false; fs.accessSync(dir, fs.constants.W_OK); return true } catch { return false } })()
    const kitOk = (() => { try { const k = kitDiretorio(pasta); return !!k && fs.existsSync(k) } catch { return false } })()
    const livre = (() => { try { return Number(espacoLivre(dir || raiz)) } catch { return NaN } })()
    const cotaAcabou = !!linha && linha.estado === 'parou' && linha.motivo === 'cota'
    const linhaRuim = !!linha && linha.estado === 'parou' && ['erro', 'sem-avanco', 'precisa-voce', 'kit-faltando', 'kit-indisponivel'].includes(linha.motivo)
    const c = (nome, ok, dica) => ({ nome, ok: !!ok, ...(ok ? {} : { dica }) })
    return [
      c('Internet', net === true, 'Sem internet agora. Confira o Wi-Fi ou o cabo; a obra volta sozinha quando a internet voltar.'),
      c('Claude ligado', !!(claude && claude.conectado), 'O Claude deste computador saiu da conta. Abra o Atlas e entre de novo com a sua conta do Claude.'),
      c('Cota do Claude', !cotaAcabou, 'A cota do seu plano do Claude acabou. A obra volta sozinha quando ela renovar.'),
      c('GitHub', !!(sit && sit.github && sit.github.ligado), 'O GitHub não está ligado. Abra "Contas ligadas" e ligue de novo.'),
      c('Supabase', !!(sit && sit.supabase && sit.supabase.ligado), 'O Supabase não está ligado. Abra "Contas ligadas" e ligue de novo.'),
      c('Vercel', !!(sit && sit.hosp && sit.hosp.ligado), 'A Vercel não está ligada. Abra "Contas ligadas" e ligue de novo.'),
      c('Pasta da obra', pastaOk, 'O Atlas não consegue escrever na pasta da obra. Confira se ela não foi movida ou apagada.'),
      c('Instruções da obra', kitOk, 'O Atlas não conseguiu baixar as instruções da obra. Confira a internet e toque em "Tentar de novo".'),
      c('Espaço no disco', Number.isFinite(livre) ? livre >= ESPACO_MINIMO : true, 'Falta espaço no computador. Libere pelo menos 1 GB e toque em "Tentar de novo".'),
      c('Trabalho da etapa', !linhaRuim, limparFala(linha && linha.fala) || 'A linha de produção parou no meio da etapa. A Ajuda do Atlas já sabe o que aconteceu e resolve com você.'),
    ]
  }

  /** Economia de tokens: o vigia só religa a linha quando o básico está de pé (sem isso, o Claude roda e falha, gastando cota). */
  async function podeTrabalhar(pasta) {
    let dir = null
    try { dir = pastaDaObra(raiz, pasta) } catch { dir = null }
    const [net, claude] = await Promise.all([comTempo(() => internet()), comTempo(() => claudeEstado())])
    if (net === false) return { ok: false, motivo: 'Sem internet agora. A obra volta sozinha quando a internet voltar.' }
    if (claude && claude.conectado === false) return { ok: false, motivo: 'O Claude deste computador saiu da conta. Abra o Atlas e entre de novo com a sua conta do Claude.' }
    try { if (!dir) throw new Error('sem-pasta'); fs.accessSync(dir, fs.constants.W_OK) } catch { return { ok: false, motivo: 'O Atlas não consegue escrever na pasta da obra. Confira se ela não foi movida ou apagada.' } }
    try { const livre = Number(espacoLivre(dir)); if (Number.isFinite(livre) && livre < ESPACO_MINIMO) return { ok: false, motivo: 'Falta espaço no computador. Libere pelo menos 1 GB; a obra volta sozinha.' } } catch { /* sem medida: segue */ }
    return { ok: true }
  }

  return { diagnosticar, podeTrabalhar }
}

module.exports = { criarDiagnostico }
