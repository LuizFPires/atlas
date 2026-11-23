// Worker do Whisper (transcrição no computador). Roda fora da tela para não travar nada.
// Modelo: whisper-small (multilíngue), quantizado q8: no teste do CI acertou a frase inteira; o base errava palavras. Baixado uma vez do Hugging Face e guardado no cache do app.
// Os arquivos do motor (onnxruntime .wasm) vão junto do app em ./ort/ (nada de CDN): ver o plugin em vite.config.ts.
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

const MODELO = 'onnx-community/whisper-small'

env.allowLocalModels = false
env.useBrowserCache = true
const onnx = env.backends.onnx as { wasm?: { wasmPaths?: string; numThreads?: number } }
if (onnx.wasm) {
  onnx.wasm.wasmPaths = new URL('../ort/', import.meta.url).href
  // Vários núcleos do processador quando o Atlas libera o SharedArrayBuffer (main.cjs); senão, um só, como antes.
  const nucleos = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2
  onnx.wasm.numThreads = typeof SharedArrayBuffer !== 'undefined' ? Math.max(1, Math.min(4, nucleos - 1)) : 1
}

let asr: Promise<AutomaticSpeechRecognitionPipeline> | null = null
const progressoPorArquivo = new Map<string, { carregado: number; total: number }>()

function carregar() {
  if (!asr) {
    // `pipeline` tem tipos genéricos pesados demais para o TypeScript: chamamos por uma assinatura simples.
    const criar = pipeline as unknown as (tarefa: string, modelo: string, o: Record<string, unknown>) => Promise<AutomaticSpeechRecognitionPipeline>
    asr = criar('automatic-speech-recognition', MODELO, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (p: { status?: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status !== 'progress' || !p.file || !p.total) return
        progressoPorArquivo.set(p.file, { carregado: p.loaded ?? 0, total: p.total })
        let c = 0, t = 0
        for (const v of progressoPorArquivo.values()) { c += v.carregado; t += v.total }
        self.postMessage({ tipo: 'progresso', pct: t ? Math.min(99, Math.round((c / t) * 100)) : 0 })
      },
    })
    asr.catch(() => { asr = null })
  }
  return asr
}

// Uma transcrição por vez (os trechos chegam enquanto a pessoa ainda fala): fila simples, na ordem.
let fila: Promise<unknown> = Promise.resolve()
self.onmessage = (ev: MessageEvent) => { fila = fila.then(() => tratar(ev)) }

async function tratar(ev: MessageEvent) {
  const m = ev.data as { tipo: string; id: number; audio?: Float32Array }
  try {
    if (m.tipo === 'preparar') {
      await carregar()
      self.postMessage({ tipo: 'progresso', pct: 100 })
      self.postMessage({ tipo: 'texto', id: m.id, texto: '' })
      return
    }
    if (m.tipo === 'transcrever' && m.audio) {
      const t = await carregar()
      const r = await t(m.audio, { language: 'portuguese', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 })
      const texto = (Array.isArray(r) ? r.map((x) => x.text).join(' ') : r.text).trim()
      self.postMessage({ tipo: 'texto', id: m.id, texto })
    }
  } catch (e) {
    self.postMessage({ tipo: 'erro', id: m.id, erro: e instanceof Error ? e.message : String(e) })
  }
}
