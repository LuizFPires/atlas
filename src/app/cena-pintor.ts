// Cena 3D do pintor (F06b): enquanto o Claude monta os 3 estilos, um pintor de boina pinta no cavalete a tela de um celular.
// Three.js carregado sob demanda (só nesta tela). A "arte" é um CanvasTexture desenhado por partes, em ciclo.
// Sem WebGL, quem chama mostra o pintor em SVG (Pintor.tsx).
import * as THREE from 'three'

const LIMA = '#C6F135'
const PINTURA = ['#C6F135', '#1D3557', '#D8B45A', '#E5534B', '#2563EB']

export interface CenaPintor { parar(): void }

/** Desenha a arte até o momento t (0..1) do ciclo: celular, barra do topo, botões, textos, cartões, botão principal. */
function pintarArte(ctx: CanvasRenderingContext2D, t: number) {
  const W = ctx.canvas.width, H = ctx.canvas.height
  ctx.fillStyle = '#F4F0E6'
  ctx.fillRect(0, 0, W, H)
  // textura de tela de pintura
  ctx.globalAlpha = 0.05
  for (let y = 0; y < H; y += 6) { ctx.fillStyle = y % 12 ? '#000' : '#fff'; ctx.fillRect(0, y, W, 1) }
  ctx.globalAlpha = 1
  const f = (a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)))
  const pincel = (x: number, y: number, w: number, h: number, r: number, cor: string, p: number, contorno = false) => {
    if (p <= 0) return
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(x, y, w * p, h, r)
    if (contorno) { ctx.strokeStyle = cor; ctx.lineWidth = 6; ctx.stroke() } else { ctx.fillStyle = cor; ctx.fill() }
    ctx.restore()
  }
  // celular
  const px = W * 0.2, py = H * 0.08, pw = W * 0.6, ph = H * 0.84
  const p0 = f(0, 0.12)
  if (p0 > 0) {
    ctx.save()
    ctx.strokeStyle = '#23272C'; ctx.lineWidth = 10; ctx.lineCap = 'round'
    ctx.setLineDash([(pw + ph) * 2 * p0, 99999])
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 40); ctx.stroke()
    ctx.restore()
  }
  const ix = px + 22, iw = pw - 44
  pincel(ix, py + 26, iw, 64, 14, LIMA, f(0.12, 0.22))
  for (let i = 0; i < 3; i++) pincel(ix + i * (iw / 3 + 2), py + 112, iw / 3 - 10, 34, 17, i === 0 ? '#1D3557' : '#9AA19A', f(0.22 + i * 0.03, 0.3 + i * 0.03), i !== 0)
  pincel(ix, py + 172, iw * 0.9, 16, 8, '#C9CCC4', f(0.34, 0.42))
  pincel(ix, py + 200, iw * 0.65, 16, 8, '#C9CCC4', f(0.4, 0.47))
  pincel(ix, py + 246, iw / 2 - 8, iw / 2 - 8, 18, '#D8B45A', f(0.47, 0.56))
  pincel(ix + iw / 2 + 8, py + 246, iw / 2 - 8, iw / 2 - 8, 18, '#9AA19A', f(0.52, 0.6), true)
  pincel(ix, py + ph - 110, iw, 64, 32, '#1D3557', f(0.6, 0.7))
  if (f(0.68, 0.74) > 0) {
    ctx.globalAlpha = f(0.68, 0.74)
    ctx.fillStyle = '#FFFFFF'; ctx.font = '700 30px system-ui, sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('Marcar', ix + iw / 2, py + ph - 68)
    ctx.globalAlpha = 1
  }
  // fim do ciclo: a tela "seca" e recomeça
  if (t > 0.9) { ctx.fillStyle = `rgba(244,240,230,${(t - 0.9) / 0.1})`; ctx.fillRect(0, 0, W, H) }
}

const mat = (cor: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.6, metalness: 0.05, ...o })

function malha(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) {
  const k = new THREE.Mesh(geo, m)
  k.position.set(x, y, z)
  k.castShadow = true
  k.receiveShadow = true
  return k
}

export function montarCenaPintor(canvas: HTMLCanvasElement, { parado = false }: { parado?: boolean } = {}): CenaPintor {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const cena = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)

  // luzes: chave quente com sombra, contraluz lima, preenchimento frio
  cena.add(new THREE.HemisphereLight('#dfe6ff', '#1a1c20', 0.55))
  const chave = new THREE.DirectionalLight('#ffe9cf', 2.4)
  chave.position.set(3.5, 6, 4)
  chave.castShadow = true
  chave.shadow.mapSize.set(1024, 1024)
  chave.shadow.radius = 6
  Object.assign(chave.shadow.camera, { left: -4, right: 4, top: 4, bottom: -2 })
  cena.add(chave)
  const contra = new THREE.PointLight(LIMA, 4, 7)
  contra.position.set(-1.6, 2.8, -2.6)
  cena.add(contra)
  const prenchimento = new THREE.DirectionalLight('#9fb4ff', 0.5)
  prenchimento.position.set(-4, 2, 3)
  cena.add(prenchimento)

  // chão: tablado de madeira escura em disco
  const chao = malha(new THREE.CylinderGeometry(3.4, 3.4, 0.12, 64), mat('#1f1d1b', { roughness: 0.9 }), 0, -0.06, 0)
  chao.castShadow = false
  cena.add(chao)

  // cavalete
  const madeira = mat('#8B5E3C', { roughness: 0.75 })
  const cavalete = new THREE.Group()
  const perna = (x: number, z: number, rx: number, rz: number) => { const p = malha(new THREE.CylinderGeometry(0.035, 0.045, 2.5, 10), madeira, x, 1.18, z); p.rotation.set(rx, 0, rz); cavalete.add(p) }
  perna(-0.42, 0.05, -0.08, -0.1); perna(0.42, 0.05, -0.08, 0.1); perna(0, -0.45, 0.32, 0)
  cavalete.add(malha(new THREE.BoxGeometry(1.0, 0.06, 0.16), madeira, 0, 0.62, 0.12))
  // tela com a arte (CanvasTexture)
  const arte = document.createElement('canvas')
  arte.width = 512; arte.height = 768
  const actx = arte.getContext('2d')!
  const textura = new THREE.CanvasTexture(arte)
  textura.colorSpace = THREE.SRGBColorSpace
  textura.anisotropy = 4
  const borda = mat('#e9e3d6')
  const tela = malha(new THREE.BoxGeometry(0.96, 1.42, 0.05), [borda, borda, borda, borda, new THREE.MeshStandardMaterial({ map: textura, roughness: 0.9, emissive: '#ffffff', emissiveMap: textura, emissiveIntensity: 0.45 }), borda] as unknown as THREE.Material, 0, 1.4, 0.17)
  tela.rotation.x = -0.08
  cavalete.add(tela)
  cavalete.position.set(0.55, 0, -0.1)
  cavalete.rotation.y = -0.38
  cena.add(cavalete)

  // pintor
  const pele = mat('#E2BC94', { roughness: 0.55 })
  const camisa = mat('#3B4250')
  const calca = mat('#23272C')
  const avental = mat('#2A3A12', { roughness: 0.8 })
  const lima = mat(LIMA, { roughness: 0.45, emissive: '#3a4a10', emissiveIntensity: 0.25 })
  const pintor = new THREE.Group()
  const capsula = (r: number, l: number, m: THREE.Material, x: number, y: number, z: number) => malha(new THREE.CapsuleGeometry(r, l, 8, 16), m, x, y, z)
  pintor.add(capsula(0.1, 0.62, calca, -0.13, 0.42, 0), capsula(0.1, 0.62, calca, 0.13, 0.42, 0))
  pintor.add(malha(new THREE.BoxGeometry(0.2, 0.08, 0.32), mat('#15171a'), -0.13, 0.04, 0.06), malha(new THREE.BoxGeometry(0.2, 0.08, 0.32), mat('#15171a'), 0.13, 0.04, 0.06))
  const tronco = capsula(0.27, 0.5, camisa, 0, 1.2, 0)
  tronco.scale.set(1, 1, 0.75)
  pintor.add(tronco)
  const av = malha(new THREE.CylinderGeometry(0.25, 0.3, 0.75, 24, 1, true, -0.9, 1.8), avental, 0, 1.05, 0.02)
  av.material = avental.clone(); (av.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide
  pintor.add(av)
  const cabeca = new THREE.Group()
  cabeca.position.set(0, 1.78, 0)
  cabeca.add(malha(new THREE.SphereGeometry(0.22, 32, 24), pele))
  cabeca.add(malha(new THREE.SphereGeometry(0.04, 12, 10), pele, 0, -0.01, 0.22))
  const olho = mat('#16181b', { roughness: 0.3 })
  cabeca.add(malha(new THREE.SphereGeometry(0.022, 10, 8), olho, -0.075, 0.04, 0.19), malha(new THREE.SphereGeometry(0.022, 10, 8), olho, 0.075, 0.04, 0.19))
  const boina = malha(new THREE.SphereGeometry(0.26, 32, 16), lima, 0.03, 0.15, -0.01)
  boina.scale.set(1.05, 0.32, 1.05)
  boina.rotation.z = -0.25
  cabeca.add(boina, malha(new THREE.SphereGeometry(0.035, 10, 8), lima, -0.02, 0.24, 0))
  pintor.add(cabeca)

  // braço esquerdo com a paleta
  const bracoE = new THREE.Group()
  bracoE.position.set(-0.3, 1.45, 0)
  bracoE.add(capsula(0.07, 0.42, camisa, 0, -0.25, 0))
  const antebracoE = new THREE.Group()
  antebracoE.position.set(0, -0.48, 0)
  antebracoE.rotation.x = -1.2
  antebracoE.add(capsula(0.06, 0.32, pele, 0, -0.2, 0))
  const paleta = malha(new THREE.CylinderGeometry(0.24, 0.24, 0.025, 32), mat('#C8A57A', { roughness: 0.5 }), -0.05, -0.42, 0.04)
  paleta.rotation.set(1.2, 0, 0.3)
  PINTURA.forEach((c, i) => { const g = malha(new THREE.SphereGeometry(0.035, 12, 8), mat(c, { roughness: 0.25 }), Math.cos(i * 1.2) * 0.14, 0.02, Math.sin(i * 1.2) * 0.14); g.scale.y = 0.5; paleta.add(g) })
  antebracoE.add(paleta)
  bracoE.add(antebracoE)
  bracoE.rotation.z = 0.35
  pintor.add(bracoE)

  // braço do pincel (o que se mexe)
  const ombro = new THREE.Group()
  ombro.position.set(0.3, 1.45, 0)
  ombro.add(capsula(0.07, 0.42, camisa, 0, -0.25, 0))
  const cotovelo = new THREE.Group()
  cotovelo.position.set(0, -0.48, 0)
  cotovelo.add(capsula(0.06, 0.32, pele, 0, -0.2, 0))
  const pincel = new THREE.Group()
  pincel.position.set(0, -0.42, 0)
  pincel.add(malha(new THREE.CylinderGeometry(0.014, 0.02, 0.5, 8), madeira, 0, -0.18, 0))
  const ponta = malha(new THREE.ConeGeometry(0.03, 0.09, 12), mat(LIMA, { roughness: 0.3 }), 0, -0.47, 0)
  ponta.rotation.x = Math.PI
  pincel.add(ponta)
  cotovelo.add(pincel)
  ombro.add(cotovelo)
  pintor.add(ombro)

  pintor.position.set(-0.55, 0, 0.62)
  pintor.rotation.y = 1.05
  cena.add(pintor)

  // ajuste de tamanho
  const ajustar = () => {
    const w = canvas.clientWidth || 440, h = canvas.clientHeight || 300
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(ajustar) : null
  ro?.observe(canvas)
  ajustar()

  const CICLO = 7.5
  let quadro = 0
  let ultimaArte = -1
  const inicio = performance.now()
  const desenhar = (agora: number) => {
    const s = parado ? CICLO * 0.8 : (agora - inicio) / 1000
    const t = (s % CICLO) / CICLO
    // câmera passeia devagar em volta
    const ang = parado ? 0.15 : Math.sin(s * 0.22) * 0.28 + 0.12
    camera.position.set(Math.sin(ang) * 5.6, 2.35, Math.cos(ang) * 5.6)
    camera.lookAt(0.05, 1.2, 0)
    // braço pinta em pinceladas; corpo e cabeça acompanham
    ombro.rotation.set(-1.25 + Math.sin(s * 5.2) * 0.12, 0, -0.05 + Math.sin(s * 2.6) * 0.1)
    cotovelo.rotation.set(-0.25 + Math.sin(s * 5.2 + 0.6) * 0.15, 0, 0)
    pincel.rotation.x = -0.15 + Math.sin(s * 5.2 + 1.1) * 0.15
    pintor.rotation.z = Math.sin(s * 1.3) * 0.02
    cabeca.rotation.set(Math.sin(s * 0.9) * 0.05, -0.15 + Math.sin(s * 0.7) * 0.1, Math.sin(s * 1.1) * 0.05)
    ;(ponta.material as THREE.MeshStandardMaterial).color.set(PINTURA[Math.floor(t * 6) % PINTURA.length])
    const tq = Math.round(t * 120)
    if (tq !== ultimaArte) { ultimaArte = tq; pintarArte(actx, t); textura.needsUpdate = true }
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
