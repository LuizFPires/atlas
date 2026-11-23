// Teste de verdade da voz do Atlas (roda no CI, que tem internet): baixa o MESMO modelo do Whisper que o app usa,
// transcreve uma fala em português gerada pelo espeak-ng e confere as palavras.
// Uso: node scripts/teste-voz.mjs caminho/para/fala-16k-mono.f32
// O modelo e as opções TÊM de ser os mesmos de src/ui/voz-whisper.worker.ts (um teste do vitest confere).
import { readFileSync } from 'node:fs'
import { pipeline } from '@huggingface/transformers'

export const MODELO = 'onnx-community/whisper-base'
export const OPCOES = { language: 'portuguese', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 }

const arquivo = process.argv[2]
if (!arquivo) { console.error('faltou o arquivo de áudio'); process.exit(2) }
const bruto = readFileSync(arquivo)
const audio = new Float32Array(bruto.buffer, bruto.byteOffset, bruto.byteLength / 4)
const inicio = Date.now()
const asr = await pipeline('automatic-speech-recognition', MODELO, { dtype: 'q8' })
console.log(`modelo pronto em ${((Date.now() - inicio) / 1000).toFixed(1)} s`)
const t0 = Date.now()
const r = await asr(audio, OPCOES)
const texto = (Array.isArray(r) ? r.map((x) => x.text).join(' ') : r.text).trim()
console.log(`transcrito em ${((Date.now() - t0) / 1000).toFixed(1)} s: "${texto}"`)
const normal = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const faltando = ['agenda', 'barbearia'].filter((p) => !normal.includes(p))
if (faltando.length) { console.error(`não reconheceu: ${faltando.join(', ')}`); process.exit(1) }
console.log('voz ok')
