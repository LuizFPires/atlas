// Transcrição em partes (23/11/2026, "a transcrição de áudio está muito lenta"): enquanto a pessoa fala, os trechos já falados
// vão sendo transcritos no Worker. Ao parar, falta só o finalzinho, e o texto aparece quase na hora.
// Corte sempre num respiro (o trecho mais silencioso perto do fim), para não partir uma palavra ao meio.
import type { Transcritor } from './voz-motor'

export const TAXA = 16000

/** Índice de corte entre `de` e `ate`: o meio da janela de 0,3 s mais silenciosa nos últimos 3 s. Sem respiro claro, `ate`. */
export function pontoDeCorte(audio: Float32Array, de: number, ate: number): number {
  const janela = Math.round(0.3 * TAXA)
  const passo = Math.round(0.05 * TAXA)
  const inicio = Math.max(de, ate - 3 * TAXA)
  let melhor = -1
  let menor = Infinity
  for (let i = inicio; i + janela <= ate; i += passo) {
    let e = 0
    for (let j = i; j < i + janela; j++) e += audio[j] * audio[j]
    e /= janela
    if (e < menor) { menor = e; melhor = i }
  }
  // Só conta como respiro se for bem mais baixo que a fala (RMS < 0,02).
  if (melhor < 0 || Math.sqrt(menor) > 0.02) return ate
  return melhor + Math.round(janela / 2)
}

export function criarTranscricaoEmPartes(t: Transcritor, o: { minSegundos?: number } = {}) {
  const min = (o.minSegundos ?? 12) * TAXA
  let cortado = 0
  const partes: Promise<string>[] = []
  const mandar = (seg: Float32Array) => {
    const p = t.transcrever(seg)
    p.catch(() => {}) // o erro aparece no terminar(); aqui só evita aviso de promessa sem dono
    partes.push(p)
  }
  return {
    /** Recebe o áudio gravado até agora; se já tem um trecho grande o bastante, manda transcrever. */
    async adiantar(ateAgora: Float32Array) {
      if (ateAgora.length - cortado < min) return
      const corte = pontoDeCorte(ateAgora, cortado, ateAgora.length)
      if (corte - cortado < min / 2) return
      mandar(ateAgora.slice(cortado, corte))
      cortado = corte
    },
    /** Áudio completo ao parar: transcreve o resto e junta tudo, na ordem. */
    async terminar(final: Float32Array): Promise<string> {
      const resto = final.slice(Math.min(cortado, final.length))
      if (resto.length > 0.3 * TAXA || partes.length === 0) mandar(resto)
      const textos = await Promise.all(partes)
      return textos.map((s) => s.trim()).filter(Boolean).join(' ')
    },
  }
}
