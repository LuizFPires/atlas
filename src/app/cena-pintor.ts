// Cena 3D da espera dos estilos (F06b): um celular flutuando em luz de estúdio, com a tela sendo pintada por um pincel que
// voa sobre ela, parte por parte (barra do topo, botões, textos, cartões, botão principal), soltando gotinhas de tinta.
// Sem personagem (pedido do Luiz em 22/11/2026). Three.js carregado sob demanda (só nesta tela). Sem WebGL, Pintor.tsx mostra o SVG.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

const LIMA = '#C6F135'
const AZUL = '#1D3557'
const OURO = '#D8B45A'
const CINZA = '#C9CCC4'

export interface CenaPintor { parar(): void }

/** Etapas da pintura no ciclo (0..1): onde o pincel trabalha (u,v da tela, 0..1 de cima para baixo) e com que cor. */
const ETAPAS: { de: number; ate: number; v: number; u0: number; u1: number; cor: string }[] = [
  { de: 0.04, ate: 0.16, v: 0.1, u0: 0.1, u1: 0.9, cor: LIMA },
  { de: 0.18, ate: 0.28, v: 0.2, u0: 0.1, u1: 0.9, cor: AZUL },
  { de: 0.3, ate: 0.42, v: 0.31, u0: 0.1, u1: 0.85, cor: CINZA },
  { de: 0.44, ate: 0.58, v: 0.47, u0: 0.12, u1: 0.88, cor: OURO },
  { de: 0.6, ate: 0.74, v: 0.86, u0: 0.12, u1: 0.88, cor: AZUL },
]

const passo = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)))

/** Onde o pincel está no momento t, e se está encostado na tela. */
export function alvoDoPincel(t: number): { u: number; v: number; cor: string; tocando: boolean } {
  for (const e of ETAPAS) {
    if (t >= e.de && t <= e.ate) {
      const p = passo(t, e.de, e.ate)
      const ida = (p * 3) % 1
      const vaiVolta = Math.floor(p * 3) % 2 === 0 ? ida : 1 - ida
      return { u: e.u0 + (e.u1 - e.u0) * vaiVolta, v: e.v + (Math.floor(p * 3) - 1) * 0.018, cor: e.cor, tocando: true }
    }
  }
  const prox = ETAPAS.find((e) => e.de > t) ?? ETAPAS[0]
  return { u: 0.5, v: prox.v - 0.04, cor: prox.cor, tocando: false }
}

/** A tela do celular sendo pintada até o momento t. */
function pintarTela(ctx: CanvasRenderingContext2D, t: number) {
  const W = ctx.canvas.width, H = ctx.canvas.height
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#FBF8F1'); g.addColorStop(1, '#F1ECE0')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const m = 34, iw = W - m * 2
  const traco = (x: number, y: number, w: number, h: number, r: number, cor: string, p: number, contorno = false) => {
    if (p <= 0) return
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(x, y, Math.max(h, w * p), h, r)
    if (contorno) { ctx.strokeStyle = cor; ctx.lineWidth = 5; ctx.stroke() } else { ctx.fillStyle = cor; ctx.fill() }
    if (p < 1 && !contorno) {
      ctx.globalAlpha = 0.25
      for (let i = 0; i < 6; i++) { ctx.fillStyle = '#fff'; ctx.fillRect(x + w * p - 10, y + (h / 6) * i, 10, 2) }
    }
    ctx.restore()
  }
  const [e1, e2, e3, e4, e5] = ETAPAS.map((e) => passo(t, e.de, e.ate))
  traco(m, H * 0.06, iw, 80, 18, LIMA, e1)
  if (e1 >= 1) { ctx.fillStyle = '#141619'; ctx.font = '700 30px system-ui, sans-serif'; ctx.fillText('Marcar horário', m + 24, H * 0.06 + 50) }
  for (let i = 0; i < 3; i++) traco(m + i * (iw / 3 + 3), H * 0.18, iw / 3 - 12, 44, 22, i === 0 ? AZUL : '#9AA19A', passo(e2, i / 3, (i + 1) / 3), i !== 0)
  traco(m, H * 0.29, iw * 0.92, 18, 9, CINZA, passo(e3, 0, 0.5))
  traco(m, H * 0.33, iw * 0.66, 18, 9, CINZA, passo(e3, 0.5, 1))
  traco(m, H * 0.4, iw / 2 - 10, iw / 2 - 10, 22, OURO, passo(e4, 0, 0.55))
  traco(m + iw / 2 + 10, H * 0.4, iw / 2 - 10, iw / 2 - 10, 22, '#9AA19A', passo(e4, 0.55, 1), true)
  traco(m, H * 0.82, iw, 84, 42, AZUL, e5)
  if (e5 >= 1) { ctx.fillStyle = '#FFFFFF'; ctx.font = '700 34px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Marcar', W / 2, H * 0.82 + 54); ctx.textAlign = 'start' }
  if (t > 0.9) { ctx.fillStyle = `rgba(247,243,234,${passo(t, 0.9, 1)})`; ctx.fillRect(0, 0, W, H) }
}

export function montarCenaPintor(canvas: HTMLCanvasElement, { parado = false }: { parado?: boolean } = {}): CenaPintor {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const cena = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
  camera.position.set(0.15, 0.15, 5.5)
  camera.lookAt(0, 0, 0)

  // luz de estúdio: chave suave, recorte lima atrás, preenchimento frio
  cena.add(new THREE.HemisphereLight('#e6ecff', '#15171a', 0.7))
  const chave = new THREE.DirectionalLight('#fff3e2', 2.2)
  chave.position.set(1.2, 5, 3)
  chave.castShadow = true
  chave.shadow.mapSize.set(1024, 1024)
  chave.shadow.radius = 8
  Object.assign(chave.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 })
  cena.add(chave)
  const recorte = new THREE.PointLight(LIMA, 18, 7)
  recorte.position.set(-1.8, 1.2, -1.2)
  cena.add(recorte)
  const frio = new THREE.DirectionalLight('#9fb4ff', 0.6)
  frio.position.set(-4, -1, 3)
  cena.add(frio)

  // sombra num chão invisível
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.16 }))
  chao.rotation.x = -Math.PI / 2
  chao.position.y = -1.45
  chao.receiveShadow = true
  cena.add(chao)

  // o celular
  const celular = new THREE.Group()
  const corpo = new THREE.Mesh(new RoundedBoxGeometry(1.12, 2.24, 0.12, 6, 0.13), new THREE.MeshPhysicalMaterial({ color: '#1b1e22', metalness: 0.6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15 }))
  corpo.castShadow = true
  celular.add(corpo)
  const arte = document.createElement('canvas')
  arte.width = 512; arte.height = 1040
  const actx = arte.getContext('2d')!
  const textura = new THREE.CanvasTexture(arte)
  textura.colorSpace = THREE.SRGBColorSpace
  textura.anisotropy = 4
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.08), new THREE.MeshStandardMaterial({ map: textura, emissive: '#ffffff', emissiveMap: textura, emissiveIntensity: 0.55, roughness: 0.35 }))
  tela.position.z = 0.062
  celular.add(tela)
  const ilha = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.06, 0.012, 3, 0.03), new THREE.MeshStandardMaterial({ color: '#0d0f11', roughness: 0.4 }))
  ilha.position.set(0, 0.97, 0.07)
  celular.add(ilha)
  cena.add(celular)

  // o pincel (a ponta fica na origem do grupo)
  const pincel = new THREE.Group()
  const cabo = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.046, 0.8, 20), new THREE.MeshPhysicalMaterial({ color: '#141619', roughness: 0.25, clearcoat: 1 }))
  cabo.position.y = 0.63
  const virola = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.22, 20), new THREE.MeshStandardMaterial({ color: '#c9ccd2', metalness: 1, roughness: 0.25 }))
  virola.position.y = 0.13
  const cerdas = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 20), new THREE.MeshStandardMaterial({ color: LIMA, roughness: 0.55 }))
  cerdas.rotation.x = Math.PI
  cerdas.position.y = 0.1
  const anel = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.008, 8, 20), new THREE.MeshStandardMaterial({ color: LIMA, roughness: 0.4 }))
  anel.rotation.x = Math.PI / 2
  anel.position.y = 0.92
  for (const k of [cabo, virola, cerdas, anel]) { k.castShadow = true; pincel.add(k) }
  cena.add(pincel)

  // gotinhas de tinta
  const gotas = Array.from({ length: 22 }, () => {
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshStandardMaterial({ color: LIMA, roughness: 0.2, transparent: true }))
    g.visible = false
    cena.add(g)
    return { g, vel: new THREE.Vector3(), vida: 0 }
  })
  let proxGota = 0

  const ajustar = () => {
    const w = canvas.clientWidth || 440, h = canvas.clientHeight || 300
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(ajustar) : null
  ro?.observe(canvas)
  ajustar()

  const CICLO = 8
  const ponta = new THREE.Vector3(0.9, 0.6, 0.9)
  const alvoMundo = new THREE.Vector3()
  let quadro = 0
  let ultimaArte = -1
  let antes = performance.now()
  const inicio = antes
  const desenhar = (agora: number) => {
    const dt = Math.min(0.05, Math.max(0, (agora - antes) / 1000))
    antes = agora
    const s = parado ? CICLO * 0.735 : (agora - inicio) / 1000
    const t = (s % CICLO) / CICLO
    // o celular flutua e gira devagar, mostrando o brilho da moldura
    celular.rotation.set(-0.05 + Math.sin(s * 0.6) * 0.03, -0.42 + Math.sin(s * 0.35) * 0.12, 0.03)
    celular.position.y = Math.sin(s * 1.1) * 0.05
    celular.updateMatrixWorld()
    // o pincel segue o ponto da tela que está sendo pintado
    const a = alvoDoPincel(t)
    alvoMundo.set((a.u - 0.5) * 1.0, (0.5 - a.v) * 2.08, 0.075 + (a.tocando ? 0 : 0.35)).applyMatrix4(celular.matrixWorld)
    ponta.lerp(alvoMundo, parado ? 1 : Math.min(1, dt * 9))
    pincel.position.copy(ponta)
    pincel.rotation.set(0.75, 0.2, -0.85 + (a.tocando ? Math.sin(s * 14) * 0.06 : 0))
    ;(cerdas.material as THREE.MeshStandardMaterial).color.set(a.cor)
    ;(anel.material as THREE.MeshStandardMaterial).color.set(a.cor)
    if (a.tocando && !parado && agora > proxGota) {
      proxGota = agora + 110
      const livre = gotas.find((x) => x.vida <= 0)
      if (livre) {
        livre.vida = 1
        livre.g.visible = true
        livre.g.position.copy(ponta)
        ;(livre.g.material as THREE.MeshStandardMaterial).color.set(a.cor)
        livre.vel.set((Math.random() - 0.5) * 0.9, Math.random() * 0.6 + 0.2, Math.random() * 0.6 + 0.2)
      }
    }
    for (const x of gotas) {
      if (x.vida <= 0) continue
      x.vida -= dt * 1.1
      x.vel.y -= dt * 2.2
      x.g.position.addScaledVector(x.vel, dt)
      ;(x.g.material as THREE.MeshStandardMaterial).opacity = Math.max(0, x.vida)
      x.g.scale.setScalar(0.6 + Math.max(0, x.vida) * 0.6)
      if (x.vida <= 0) x.g.visible = false
    }
    const tq = Math.round(t * 160)
    if (tq !== ultimaArte) { ultimaArte = tq; pintarTela(actx, t); textura.needsUpdate = true }
    renderer.render(cena, camera)
    if (!parado) quadro = requestAnimationFrame(desenhar)
  }
  quadro = requestAnimationFrame(desenhar)

  return {
    parar() {
      cancelAnimationFrame(quadro)
      ro?.disconnect()
      cena.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        const mm = m.material as THREE.Material | THREE.Material[] | undefined
        ;(Array.isArray(mm) ? mm : mm ? [mm] : []).forEach((x) => x.dispose())
      })
      textura.dispose()
      renderer.dispose()
    },
  }
}
