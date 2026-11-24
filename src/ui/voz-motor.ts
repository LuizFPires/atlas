import { criarAcumulador } from './voz-pcm'
// Motor de voz do Atlas. Dois caminhos:
//  - Site (navegador comum): reconhecimento de fala do próprio navegador (voz.ts).
//  - Atlas instalado (Electron): o reconhecimento do navegador NÃO funciona dentro de apps Electron (erro "network"),
//    então o Atlas grava o áudio e transcreve NO COMPUTADOR com o Whisper (decisão do Luiz em 22/11/2026): sem custo
//    por uso, o áudio não sai do computador e funciona sem internet depois da primeira vez (o modelo é baixado uma vez).
// O estado (preparando/ouvindo/escrevendo/erro) é um só para o app inteiro: <StatusVoz/> mostra para o cliente.

export type FaseVoz = 'livre' | 'preparando' | 'ouvindo' | 'escrevendo' | 'erro'
export interface EstadoVoz { fase: FaseVoz; /** 0..100 enquanto baixa o modelo na primeira vez. */ progresso?: number; recado?: string; /** Enquanto ouve: rascunho ao vivo do trecho ainda não confirmado (modelo rápido). */ rascunho?: string }

let estado: EstadoVoz = { fase: 'livre' }
const ouvintes = new Set<() => void>()
export const estadoVoz = () => estado
export function assinarVoz(f: () => void) { ouvintes.add(f); return () => { ouvintes.delete(f) } }
export function definirEstadoVoz(e: EstadoVoz) { estado = e; ouvintes.forEach((f) => f()) }

export const RECADO_SEM_MICROFONE = 'Não consegui usar o microfone. Confira se ele está ligado e se o Windows deixa o Atlas usar o microfone (Configurações > Privacidade > Microfone).'
export const RECADO_SEM_SOM = 'O microfone não mandou som. Confira no Windows qual microfone está ligado (Configurações > Sistema > Som > Entrada) e fale um pouco mais perto.'
export const RECADO_NAO_ENTENDI = 'Não consegui entender o que você falou. Fale um pouco mais perto do microfone e tente de novo, ou digite no campo.'
/** Pico abaixo disto = silêncio (o microfone não mandou som de verdade). */
export const PICO_SILENCIO = 0.003
export const soSilencio = (a: Float32Array) => { for (let i = 0; i < a.length; i++) if (Math.abs(a[i]) >= PICO_SILENCIO) return false; return true }
export const RECADO_NAO_ESCREVI = 'Não consegui escrever o que você falou. Tente de novo, ou digite no campo.'

/** Quem transcreve: o Whisper no computador (padrão) ou um falso nos testes. */
export interface Transcritor {
  preparar(onProgresso: (pct: number) => void): Promise<void>
  transcrever(audio16k: Float32Array): Promise<string>
}
/** Gravação em andamento: `parar` devolve o áudio em 16 kHz, mono. */
export interface Gravacao {
  parar(): Promise<Float32Array>
  cancelar(): void
  /** O áudio gravado até agora, sem parar (para ir transcrevendo em partes). */
  parcial?(): Promise<Float32Array>
}

let transcritor: Transcritor | null = null
let rapido: Transcritor | null | undefined
let gravador: () => Promise<Gravacao> = gravarDoMicrofone
let forcarWhisper = false
/** Só para testes: troca o transcritor/gravador e liga o caminho do Atlas instalado. */
export function usarMotorDeVoz(t: Transcritor | null, g?: () => Promise<Gravacao>, o: { forcar?: boolean; rapido?: Transcritor | null } = {}) {
  transcritor = t
  rapido = t ? (o.rapido ?? null) : undefined // nos testes, sem `rapido` não há rascunho
  gravador = g ?? gravarDoMicrofone
  if (o.forcar !== undefined) forcarWhisper = o.forcar
  definirEstadoVoz({ fase: 'livre' })
}

/** Dentro do Atlas instalado (Electron) o reconhecimento do navegador não funciona: usa o Whisper. */
export const noAtlasInstalado = () => forcarWhisper || (typeof navigator !== 'undefined' && /\bElectron\//.test(navigator.userAgent))

export const gravacaoSuportada = () =>
  typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

export function transcritorAtual(): Transcritor {
  if (!transcritor) transcritor = criarTranscritorWhisper(temPlaca() ? MODELO_BOM : MODELO_BOM_SEM_PLACA)
  return transcritor
}
/** Whisper pequeno e rápido, só para o rascunho ao vivo (a pessoa vê as palavras quase na hora; o bom corrige depois). */
export function transcritorRapido(): Transcritor | null {
  if (rapido === undefined) rapido = criarTranscritorWhisper(MODELO_RAPIDO)
  return rapido
}
export const iniciarGravacao = () => gravador()

/** Grava do microfone direto em números (16 kHz mono, o formato do Whisper), sem decodificar arquivo: pegar o trecho de agora é
 *  só copiar o que já chegou (voz-pcm.ts). */
async function gravarDoMicrofone(): Promise<Gravacao> {
  const fluxo = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
  const ctx = new AudioContext()
  // Sem gesto recente (ex.: a Ajuda abrindo já ouvindo), o Chromium pode criar o áudio "suspenso": nada chega e a fala some.
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {})
  const fonte = ctx.createMediaStreamSource(fluxo)
  // ScriptProcessor: simples e presente em todo Chromium; 4096 amostras ≈ 85 ms a 48 kHz.
  const proc = ctx.createScriptProcessor(4096, 1, 1)
  const acc = criarAcumulador(ctx.sampleRate)
  proc.onaudioprocess = (e) => { acc.somar(e.inputBuffer.getChannelData(0)) }
  fonte.connect(proc)
  proc.connect(ctx.destination) // sem isso o Chromium não chama onaudioprocess (a saída é silêncio)
  const desligar = () => {
    try { proc.disconnect(); fonte.disconnect() } catch { /* já desligado */ }
    fluxo.getTracks().forEach((t) => t.stop())
    void ctx.close().catch(() => {})
  }
  return {
    cancelar: desligar,
    parcial: async () => acc.tudo(),
    parar: async () => { const tudo = acc.tudo(); desligar(); return tudo },
  }
}

/** Whisper num Worker (não trava a tela). O modelo é baixado uma vez e fica guardado no computador. */
/** Modelos: o bom confirma o texto; o rápido (base) desenha o rascunho ao vivo. Cada um no seu Worker (não disputam fila). */
export const MODELO_BOM = 'onnx-community/whisper-small'
/** Sem placa de vídeo (WebGPU), o small leva segundos demais no processador: usa o base, ~3x mais rápido (Luiz, 23/11/2026). */
export const MODELO_BOM_SEM_PLACA = 'onnx-community/whisper-base'
export const MODELO_RAPIDO = 'onnx-community/whisper-tiny'
const temPlaca = () => typeof navigator !== 'undefined' && 'gpu' in navigator

function criarTranscritorWhisper(modelo: string = MODELO_BOM): Transcritor {
  let worker: Worker | null = null
  let pronto: Promise<void> | null = null
  let seq = 0
  const pendentes = new Map<number, { ok: (t: string) => void; erro: (e: Error) => void }>()
  let aoProgresso: (pct: number) => void = () => {}
  const obter = () => {
    if (worker) return worker
    worker = new Worker(new URL('./voz-whisper.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (ev: MessageEvent) => {
      const m = ev.data as { tipo: string; id?: number; texto?: string; pct?: number; erro?: string }
      if (m.tipo === 'progresso' && typeof m.pct === 'number') aoProgresso(m.pct)
      if ((m.tipo === 'texto' || m.tipo === 'erro') && typeof m.id === 'number') {
        const p = pendentes.get(m.id)
        pendentes.delete(m.id)
        if (m.tipo === 'texto') p?.ok(m.texto ?? '')
        else p?.erro(new Error(m.erro ?? 'whisper'))
      }
    }
    return worker
  }
  const pedir = (msg: Record<string, unknown>, transferir: Transferable[] = []) => new Promise<string>((ok, erro) => {
    const id = ++seq
    pendentes.set(id, { ok, erro })
    obter().postMessage({ ...msg, id, modelo }, transferir)
  })
  return {
    preparar(onProgresso) {
      aoProgresso = onProgresso
      if (!pronto) pronto = pedir({ tipo: 'preparar' }).then(() => undefined).catch((e) => { pronto = null; throw e })
      return pronto
    },
    transcrever: (audio) => pedir({ tipo: 'transcrever', audio }, [audio.buffer]),
  }
}
