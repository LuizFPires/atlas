// F13 Entrega: regras puras (sem tela). O endereço do sistema vem do que o M22 publicou (PontePublicar.publicarNoAr) e é DADO:
// só vira link se for http/https, sem usuário, senha, porta nem caminho, e de um endereço do próprio sistema (.vercel.app ou .com.br do cliente).
import qrcode from 'qrcode-generator'
import { dominioValido } from './ponte-publicar'

const HOST_VERCEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$/

/**
 * Aceita "slug.vercel.app", "https://slug.vercel.app" ou "meusite.com.br" (e www.). Devolve a origem (https:// ou http://) ou null.
 * Recusa esquemas que não são http/https, usuário/senha, porta, IP, localhost, caminho e qualquer host que não seja do sistema.
 */
export function enderecoDoSistema(bruto: string | null | undefined): string | null {
  if (typeof bruto !== 'string') return null
  const t = bruto.trim()
  if (!t || t.length > 120 || /\s/.test(t)) return null
  let u: URL
  try { u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`) } catch { return null }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  if (u.username || u.password || u.port || u.search || u.hash || (u.pathname !== '/' && u.pathname !== '')) return null
  const h = u.hostname.toLowerCase()
  const base = h.startsWith('www.') ? h.slice(4) : h
  if (!HOST_VERCEL.test(h) && !dominioValido(base)) return null
  return `${u.protocol}//${h}`
}

/** Matriz do QR (true = quadradinho escuro), gerada aqui dentro: nenhum serviço externo recebe o endereço. */
export function matrizQr(texto: string): boolean[][] {
  const q = qrcode(0, 'M')
  q.addData(texto, 'Byte')
  q.make()
  const n = q.getModuleCount()
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => q.isDark(y, x)))
}

/** Caminho SVG da matriz (um retângulo por quadradinho escuro). */
export function caminhoQr(m: boolean[][]): string {
  let d = ''
  m.forEach((linha, y) => linha.forEach((escuro, x) => { if (escuro) d += `M${x} ${y}h1v1h-1z` }))
  return d
}

/** Recado pronto para a equipe. O link é o já validado. */
export function recadoEquipe(sistema: string, link: string): string {
  return `Oi! O nosso sistema ${sistema} já está no ar. Abra neste link e, no celular, toque em "Adicionar à tela inicial" para virar um aplicativo: ${link}`
}

/** Link do WhatsApp (host fixo wa.me; só o texto muda). */
export function linkWhatsapp(recado: string): string {
  return `https://wa.me/?text=${encodeURIComponent(recado)}`
}
