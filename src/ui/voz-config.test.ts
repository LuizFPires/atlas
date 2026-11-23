// O teste de voz do CI (scripts/teste-voz.mjs) precisa usar o MESMO modelo e as MESMAS opções do app.
const mod = (n: string) => import(/* @vite-ignore */ n)
test('o teste de voz do CI usa o mesmo modelo e as mesmas opções do Whisper do app', async () => {
  const fs = await mod('node:fs') as { readFileSync: (p: string, e: string) => string }
  const worker = fs.readFileSync('src/ui/voz-whisper.worker.ts', 'utf8')
  const script = fs.readFileSync('scripts/teste-voz.mjs', 'utf8')
  const modelo = /MODELO = '([^']+)'/.exec(worker)?.[1]
  expect(modelo).toBeTruthy()
  expect(script).toContain(`MODELO = '${modelo}'`)
  expect(worker).toContain("language: 'portuguese', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5")
  expect(script).toContain("language: 'portuguese', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5")
  expect(worker).toContain("dtype: 'q8'")
  expect(script).toContain("dtype: 'q8'")
})
