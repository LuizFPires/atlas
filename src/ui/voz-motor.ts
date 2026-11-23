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
  if (!transcritor) transcritor = criarTranscritorWhisper()
  return transcritor
}
/** Whisper pequeno e rápido, só para o rascunho ao vivo (a pessoa vê as palavras quase na hora; o bom corrige depois). */
export function transcritorRapido(): Transcritor | null {
  if (rapido === undefined) rapido = criarTranscritorWhisper(MODELO_RAPIDO)
  return rapido
}
export const iniciarGravacao = () => gravador()

/** Grava do microfone e, ao parar, converte para 16 kHz mono (o formato que o Whisper espera). */
async function gravarDoMicrofone(): Promise<Gravacao> {
  const fluxo = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
  const rec = new MediaRecorder(fluxo)
  const partes: Blob[] = []
  rec.ondataavailable = (e) => { if (e.data.size) partes.push(e.data) }
  rec.start(1000)
  const desligar = () => fluxo.getTracks().forEach((t) => t.stop())
  // Decodifica tudo o que já foi gravado (os pedaços do MediaRecorder só tocam juntos, a partir do primeiro).
  const decodificar = async () => {
    const bruto = await new Blob(partes, { type: rec.mimeType }).arrayBuffer()
    const ctx = new AudioContext({ sampleRate: 16000 })
    try { return (await ctx.decodeAudioData(bruto)).getChannelData(0).slice() } finally { void ctx.close() }
  }
  return {
    cancelar() { try { rec.stop() } catch { /* já parado */ } desligar() },
    parcial: () => decodificar(),
    parar: () => new Promise<Float32Array>((ok, erro) => {
      rec.onstop = async () => {
        desligar()
        try { ok(await decodificar()) } catch (e) { erro(e) }
      }
      try { rec.stop() } catch (e) { erro(e) }
    }),
  }
}

/** Whisper num Worker (não trava a tela). O modelo é baixado uma vez e fica guardado no computador. */
/** Modelos: o bom confirma o texto; o rápido (base) desenha o rascunho ao vivo. Cada um no seu Worker (não disputam fila). */
export const MODELO_BOM = 'onnx-community/whisper-small'
export const MODELO_RAPIDO = 'onnx-community/whisper-base'

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
