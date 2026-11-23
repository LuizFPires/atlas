// Áudio cru do microfone para o Whisper, sem decodificar arquivo (Luiz, 23/11/2026: "está extremamente lento").
// Antes, a cada segundo o Atlas decodificava a gravação INTEIRA (MediaRecorder + decodeAudioData) para pegar o trecho novo; com a
// fala crescendo, isso pesava cada vez mais e disputava o processador com o Whisper. Agora os pedaços chegam já em números
// (Float32) e cada um é convertido para 16 kHz uma vez só.

/** Reamostra (média dos vizinhos) de `de` Hz para `para` Hz. Mesma taxa: devolve o próprio array. */
export function reamostrar(x: Float32Array, de: number, para: number): Float32Array {
  if (de === para) return x
  const razao = de / para
  const n = Math.floor(x.length / razao)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const ini = Math.floor(i * razao)
    const fim = Math.min(x.length, Math.floor((i + 1) * razao))
    let s = 0
    for (let j = ini; j < fim; j++) s += x[j]
    out[i] = fim > ini ? s / (fim - ini) : x[ini] ?? 0
  }
  return out
}

/** Junta os pedaços do microfone, já em 16 kHz. `tudo()` só copia (barato), não reprocessa. */
export function criarAcumulador(taxaOrigem: number) {
  const pedacos: Float32Array[] = []
  let total = 0
  return {
    somar(p: Float32Array) { const r = reamostrar(p, taxaOrigem, 16000); pedacos.push(r === p ? p.slice() : r); total += pedacos[pedacos.length - 1].length },
    tudo(): Float32Array {
      const out = new Float32Array(total)
      let k = 0
      for (const p of pedacos) { out.set(p, k); k += p.length }
      return out
    },
  }
}
