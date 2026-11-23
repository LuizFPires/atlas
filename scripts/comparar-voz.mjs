// Experimento (temporário): compara modelos/precisões do Whisper na mesma fala.
import { readFileSync } from 'node:fs'
import { pipeline } from '@huggingface/transformers'
const bruto = readFileSync(process.argv[2])
const audio = new Float32Array(bruto.buffer, bruto.byteOffset, bruto.byteLength / 4)
const OP = { language: 'portuguese', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 }
const casos = [
  ['onnx-community/whisper-base', 'q8'],
  ['onnx-community/whisper-base', { encoder_model: 'fp32', decoder_model_merged: 'q4' }],
  ['onnx-community/whisper-base', 'fp32'],
  ['onnx-community/whisper-small', { encoder_model: 'fp32', decoder_model_merged: 'q4' }],
  ['onnx-community/whisper-small', 'q8'],
  ['onnx-community/whisper-large-v3-turbo', { encoder_model: 'q4', decoder_model_merged: 'q4' }],
]
for (const [m, dtype] of casos) {
  try {
    const t0 = Date.now()
    const asr = await pipeline('automatic-speech-recognition', m, { dtype })
    const t1 = Date.now()
    const r = await asr(audio, OP)
    console.log(`RESULTADO ${m} ${JSON.stringify(dtype)} carregar=${((t1 - t0) / 1000).toFixed(1)}s transcrever=${((Date.now() - t1) / 1000).toFixed(1)}s :: "${r.text.trim()}"`)
  } catch (e) { console.log(`RESULTADO ${m} ${JSON.stringify(dtype)} ERRO ${e.message}`) }
}
