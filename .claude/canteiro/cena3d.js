// Canteiro 3D — Three.js embutido, modelos feitos em código (sem downloads, sem custo).
// Lê o mesmo estado do painel 2D (window.canteiroEstado) e anima a obra.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const PAPEIS = {
  coordenador:   { nome: 'Mestre de obras',       capacete: 0xf4f1ea, colete: 0x2b3a55 },
  designer:      { nome: 'Arquiteta',             capacete: 0x9b7bff, colete: 0x3d3466 },
  escritor:      { nome: 'Eng. de planejamento',  capacete: 0xf5c542, colete: 0x6b5a22 },
  revisor:       { nome: 'Fiscal',                capacete: 0xff8a3d, colete: 0x5b3218 },
  implementador: { nome: 'Equipe de execução',    capacete: 0x4a9be8, colete: 0xe8762d },
  qa:            { nome: 'Inspetor de qualidade', capacete: 0x3fbf7f, colete: 0x1d4a35 },
  seguranca:     { nome: 'Técnico de segurança',  capacete: 0xffffff, colete: 0xd7263d },
  desempenho:    { nome: 'Eng. de desempenho',    capacete: 0x5ad1e6, colete: 0x1f4f5a },
  despachante:   { nome: 'Despachante (GitHub)',  capacete: 0xb8c0c8, colete: 0x3b4652 },
  plantonista:   { nome: 'Plantonista',           capacete: 0xe5604f, colete: 0x4a2420 },
  vistoriador:   { nome: 'Vistoriador',           capacete: 0xe8e2d0, colete: 0x6b5d2e },
  implantador:   { nome: 'Implantador',           capacete: 0xffd36b, colete: 0x2c4a6b },
  corretor:      { nome: 'Corretor',              capacete: 0xff6fa8, colete: 0x4a2440 },
};
const VERBO = { Read: 'lendo', Edit: 'construindo', MultiEdit: 'construindo', Write: 'construindo', Bash: 'rodando', Grep: 'procurando', Glob: 'procurando', Task: 'chamando equipe', Agent: 'chamando equipe', WebSearch: 'pesquisando', WebFetch: 'pesquisando' };

// Pensamentos de quem está esperando a vez (balão de pensamento, só para dar vida à cena).
const PENSA = {
  coordenador: ['conferindo o cronograma', 'de olho na obra', 'planejando o próximo passo'],
  designer: ['rabiscando ideias', 'escolhendo as cores'],
  escritor: ['relendo o PLAN', 'organizando as etapas'],
  revisor: ['separando o checklist', 'relendo o projeto'],
  implementador: ['afiando as ferramentas', 'esperando a próxima tarefa', 'um cafezinho e já volto ☕'],
  qa: ['preparando os testes', 'calibrando os instrumentos'],
  seguranca: ['conferindo as trancas', 'checando quem tem a chave'],
  desempenho: ['cronometrando o elevador', 'medindo o fluxo da obra'],
  despachante: ['de olho no GitHub', 'separando a papelada'],
  plantonista: ['de plantão', 'atento a imprevistos'],
  vistoriador: ['revisando o checklist do habite-se'],
  implantador: ['conferindo os servidores'],
  corretor: ['preparando o anúncio da loja'],
};
// Quando a obra espera algo de fora (CI do GitHub) ou o dono, a cena mostra isso em vez de parecer parada.
function esperaDe(E) {
  const ag = E.agentes || {}, c = ag.coordenador || {};
  if (c.ativo) return null;
  const min = c.ts ? Math.max(0, Math.round((Date.now() - c.ts) / 60000)) : 0;
  const pend = ((E.roteiro && E.roteiro.pendencias) || []).join(' ');
  if (/\bCI\b/.test(pend)) return { coord: `esperando a vistoria do GitHub (CI) · ${min} min`, desp: 'levei a obra para a vistoria do GitHub' };
  if (c.ferramenta === 'aguardando você') return { coord: 'aguardando você', desp: null };
  return null;
}

// ---------- geometria do canteiro (metros) ----------
const PRED = { x: 2, z: -2, w: 14, d: 12, pav: 10, h: 3.2 };
const ESCADA = { x: PRED.x + PRED.w / 2 + 1.4, z: PRED.z + PRED.d / 2 - 1 };
const LUGAR = {
  coordenador:   { ativo: [-7, 7],      parado: [-16.5, -8.2] },
  designer:      { ativo: [16, 14.2],   parado: [-17.5, 16.5] },
  escritor:      { ativo: [-20.5, -8.6], parado: [-15.5, 16.8] },
  revisor:       { ativo: [-18.6, -8.4], parado: [-19.5, 18] },
  implementador: { ativo: 'laje',       parado: [-14, 15.5] },
  qa:            { ativo: [6, 18.6],    parado: [-16.5, 19] },
  seguranca:     { ativo: [9.5, 18.6],  parado: [-18, 19.5] },
  desempenho:    { ativo: [12.5, 18.6], parado: [-19.5, 19.8] },
  despachante:   { ativo: [-3, 25.2],   parado: [-14.5, 18.5] },
  plantonista:   { ativo: [-15.5, -9.8], parado: [-21, 17.5] },
  vistoriador:   { ativo: [2, 6.5],     parado: [-22.5, 16] },
  implantador:   { ativo: [-24, -18.5], parado: [-22, 13.5] },
  corretor:      { ativo: [1, 25.2],    parado: [-13, 13] },
};

export function iniciar(palco, obterEstado) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'cena3d';
  palco.prepend(renderer.domElement);

  const cena = new THREE.Scene();
  const ceu = new THREE.Color(0x8fb8de);
  cena.background = ceu;
  cena.fog = new THREE.Fog(ceu, 110, 260);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
  camera.position.set(58, 62, 66);
  const controles = new OrbitControls(camera, renderer.domElement);
  controles.target.set(0, 10, 3);
  controles.enableDamping = true;
  controles.minDistance = 28; controles.maxDistance = 170;
  controles.maxPolarAngle = 1.42;
  controles.autoRotateSpeed = 0.35;
  let ultimoToque = 0;
  controles.addEventListener('start', () => { ultimoToque = performance.now(); controles.autoRotate = false; });

  // luzes
  const hemi = new THREE.HemisphereLight(0xdfeeff, 0x5a4630, 0.8);
  cena.add(hemi);
  const sol = new THREE.DirectionalLight(0xfff1dc, 2.2);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 220 });
  sol.shadow.bias = -0.0005;
  cena.add(sol, sol.target);

  // ---------- texturas desenhadas em canvas ----------
  const tex = (w, h, desenhar, rep) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    desenhar(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (rep) t.repeat.set(...rep);
    t.anisotropy = 4;
    return t;
  };
  const ruido = (g, w, h, base, var_, n) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < n; i++) { const v = (Math.random() - .5) * var_; g.fillStyle = `rgba(${v > 0 ? '255,240,220' : '40,25,10'},${Math.abs(v)})`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 2 + Math.random() * 3); } };
  const texTerra = tex(256, 256, (g, w, h) => ruido(g, w, h, '#8a6a47', .22, 2600), [10, 10]);
  const texGrama = tex(256, 256, (g, w, h) => ruido(g, w, h, '#4e6b3a', .18, 2600), [40, 40]);
  const texTijolo = tex(128, 64, (g, w, h) => {
    g.fillStyle = '#d9cbb6'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = -1; x < 5; x++) {
      const o = y % 2 ? 16 : 0; g.fillStyle = `hsl(${14 + Math.random() * 8},${48 + Math.random() * 12}%,${40 + Math.random() * 8}%)`;
      g.fillRect(x * 32 + o + 1, y * 8 + 1, 30, 6);
    }
  });
  const fachada = () => tex(256, 128, (g, w, h) => {
    g.fillStyle = '#e9e4da'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#cfc8bb'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 10, w, 10);
    for (let i = 0; i < 4; i++) { g.fillStyle = '#2d4a64'; g.fillRect(i * 64 + 8, 26, 48, 82); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(i * 64 + 10, 28, 14, 78); g.fillStyle = '#9aa3ab'; g.fillRect(i * 64 + 31, 26, 2, 82); }
  });
  const fachadaLuz = () => tex(256, 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) if (Math.random() > .35) { g.fillStyle = `hsl(${38 + Math.random() * 10},90%,${55 + Math.random() * 15}%)`; g.fillRect(i * 64 + 8, 26, 48, 82); }
  });

  // ---------- materiais ----------
  const M = (cor, extra = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: .85, metalness: 0, ...extra });
  const mat = {
    terra: M(0xffffff, { map: texTerra }), grama: M(0xffffff, { map: texGrama }),
    concreto: M(0xb9b3a8), concretoClaro: M(0xd6d0c4), laje: M(0xc4beb2),
    aco: M(0x8c949c, { metalness: .6, roughness: .45 }), amarelo: M(0xf2b430, { roughness: .5 }),
    laranja: M(0xf2a33a, { roughness: .6 }), tapume: M(0xe9e5dc), azul: M(0x2f5f8f, { roughness: .6 }),
    madeira: M(0x9b7346), pneu: M(0x1d1d1f), vidro: M(0x9fc3e6, { roughness: .1, metalness: .2, emissive: 0x000000 }),
    asfalto: M(0x3a3d42), faixa: M(0xe8e3d6), pele: M(0xd9a77c), calca: M(0x2f3640), refletivo: M(0xfff3b0, { emissive: 0x6b6440 }),
    tijolo: M(0xffffff, { map: texTijolo }), branco: M(0xf4f1ea), verde: M(0x3fbf7f),
    lampada: M(0xfff1c2, { emissive: 0xffd27a, emissiveIntensity: 0 }),
  };
  const caixa = (w, h, d, m, x = 0, y = 0, z = 0, sombra = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z); mesh.castShadow = sombra; mesh.receiveShadow = true; return mesh;
  };
  const cilindro = (r, h, m, seg = 12) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); c.castShadow = true; c.receiveShadow = true; return c; };

  // ---------- terreno, rua, tapume ----------
  const grama = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), mat.grama);
  grama.rotation.x = -Math.PI / 2; grama.position.y = -.05; grama.receiveShadow = true; cena.add(grama);
  const terra = new THREE.Mesh(new THREE.PlaneGeometry(56, 50), mat.terra);
  terra.rotation.x = -Math.PI / 2; terra.position.set(-1, 0, 2); terra.receiveShadow = true; cena.add(terra);
  const rua = caixa(240, .06, 10, mat.asfalto, 0, 0, 33, false); cena.add(rua);
  for (let x = -110; x < 110; x += 8) cena.add(caixa(4, .07, .3, mat.faixa, x, .01, 33, false));
  // tapume com portão aberto na frente
  const tap = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1), p = caixa(len, 2.2, .15, mat.tapume, (x1 + x2) / 2, 1.1, (z1 + z2) / 2);
    p.rotation.y = -Math.atan2(z2 - z1, x2 - x1); cena.add(p);
    const faixa = caixa(len, .35, .17, mat.laranja, (x1 + x2) / 2, 1.9, (z1 + z2) / 2, false); faixa.rotation.y = p.rotation.y; cena.add(faixa);
  };
  tap(-29, -23, 27, -23); tap(-29, -23, -29, 27); tap(27, -23, 27, 27); tap(-29, 27, -10, 27); tap(4, 27, 27, 27);

  // ---------- prédio, construído por fases ----------
  const pavs = [];
  const fundacao = caixa(PRED.w + 1.2, .4, PRED.d + 1.2, mat.concreto, PRED.x, .2, PRED.z); cena.add(fundacao);
  const colunasXZ = [];
  for (const fx of [0, .5, 1]) for (const fz of [0, .5, 1]) if (!(fx === .5 && fz === .5)) colunasXZ.push([PRED.x - PRED.w / 2 + .35 + fx * (PRED.w - .7), PRED.z - PRED.d / 2 + .35 + fz * (PRED.d - .7)]);
  for (let i = 0; i < PRED.pav; i++) {
    const g = new THREE.Group(); g.position.y = .4 + i * PRED.h; cena.add(g);
    const cols = colunasXZ.map(([x, z]) => { const c = caixa(.6, PRED.h, .6, mat.concreto, x, PRED.h / 2, z); g.add(c); return c; });
    const laje = caixa(PRED.w + .4, .35, PRED.d + .4, mat.laje, PRED.x, PRED.h - .17, PRED.z); g.add(laje);
    const tijolos = [], faces = [];
    const lados = [[PRED.w, PRED.x, PRED.z + PRED.d / 2, 0], [PRED.w, PRED.x, PRED.z - PRED.d / 2, Math.PI], [PRED.d, PRED.x + PRED.w / 2, PRED.z, -Math.PI / 2], [PRED.d, PRED.x - PRED.w / 2, PRED.z, Math.PI / 2]];
    for (const [len, x, z, rot] of lados) {
      const t = caixa(len - .6, PRED.h - .35, .25, mat.tijolo.clone(), x, (PRED.h - .35) / 2, z); t.rotation.y = rot;
      t.material.map = texTijolo.clone(); t.material.map.repeat.set(len / 2, 1.4); t.material.map.needsUpdate = true; g.add(t); tijolos.push(t);
      const mapa = fachada(), luz = fachadaLuz(); mapa.repeat.set(len / 4, 1); luz.repeat.set(len / 4, 1);
      const f = caixa(len + .02, PRED.h - .35, .3, new THREE.MeshStandardMaterial({ map: mapa, emissiveMap: luz, emissive: 0xffffff, emissiveIntensity: 0, roughness: .5, metalness: .1 }), x, (PRED.h - .35) / 2, z);
      f.rotation.y = rot; g.add(f); faces.push(f);
    }
    pavs.push({ g, cols, laje, tijolos, faces });
  }
  // cobertura (só aparece em 100%)
  const cobertura = new THREE.Group(); cena.add(cobertura);
  cobertura.add(caixa(PRED.w + .6, .9, .3, mat.concretoClaro, PRED.x, .45, PRED.z + PRED.d / 2 + .1));
  cobertura.add(caixa(PRED.w + .6, .9, .3, mat.concretoClaro, PRED.x, .45, PRED.z - PRED.d / 2 - .1));
  cobertura.add(caixa(.3, .9, PRED.d + .6, mat.concretoClaro, PRED.x + PRED.w / 2 + .1, .45, PRED.z));
  cobertura.add(caixa(.3, .9, PRED.d + .6, mat.concretoClaro, PRED.x - PRED.w / 2 - .1, .45, PRED.z));
  cobertura.add(caixa(4, 2.4, 3, mat.concretoClaro, PRED.x - 3, 1.2, PRED.z - 2));
  const mastro = cilindro(.08, 5, mat.branco); mastro.position.set(PRED.x + 5, 2.5, PRED.z + 4); cobertura.add(mastro);
  const bandeira = caixa(2.2, 1.3, .05, mat.verde, PRED.x + 6.15, 4.3, PRED.z + 4); cobertura.add(bandeira);

  // andaime + escada de acesso (no pavimento em obra)
  const andaime = new THREE.Group(); cena.add(andaime);
  const tubo = (x1, y1, z1, x2, y2, z2) => {
    const a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2), len = a.distanceTo(b);
    const t = cilindro(.06, len, mat.laranja, 6); t.position.copy(a).lerp(b, .5);
    t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); andaime.add(t);
  };
  const az = PRED.z + PRED.d / 2 + 1.2, ax = PRED.x + PRED.w / 2 + 1.2;
  for (let x = PRED.x - PRED.w / 2; x <= PRED.x + PRED.w / 2 + .01; x += 2.8) { tubo(x, 0, az, x, PRED.h * 2, az); tubo(x, 0, az + .9, x, PRED.h * 2, az + .9); }
  for (let z = PRED.z - PRED.d / 2; z <= PRED.z + PRED.d / 2 + .01; z += 3) { tubo(ax, 0, z, ax, PRED.h * 2, z); tubo(ax + .9, 0, z, ax + .9, PRED.h * 2, z); }
  for (const y of [PRED.h * .5, PRED.h, PRED.h * 1.5, PRED.h * 2]) {
    tubo(PRED.x - PRED.w / 2, y, az, PRED.x + PRED.w / 2, y, az); tubo(PRED.x - PRED.w / 2, y, az + .9, PRED.x + PRED.w / 2, y, az + .9);
    tubo(ax, y, PRED.z - PRED.d / 2, ax, y, PRED.z + PRED.d / 2); tubo(ax + .9, y, PRED.z - PRED.d / 2, ax + .9, y, PRED.z + PRED.d / 2);
    andaime.add(caixa(PRED.w, .08, .9, mat.madeira, PRED.x, y, az + .45, false));
  }

  // ---------- grua ----------
  const grua = new THREE.Group(); grua.position.set(16, 0, -13); cena.add(grua);
  const ALT = 40;
  grua.add(caixa(3, .8, 3, mat.concreto, 0, .4, 0));
  for (const [x, z] of [[-.7, -.7], [.7, -.7], [-.7, .7], [.7, .7]]) { const p = cilindro(.12, ALT, mat.amarelo, 6); p.position.set(x, ALT / 2, z); grua.add(p); }
  for (let y = 2; y < ALT; y += 2.5) { grua.add(caixa(1.5, .1, .1, mat.amarelo, 0, y, -.7, false)); grua.add(caixa(1.5, .1, .1, mat.amarelo, 0, y, .7, false)); grua.add(caixa(.1, .1, 1.5, mat.amarelo, -.7, y, 0, false)); grua.add(caixa(.1, .1, 1.5, mat.amarelo, .7, y, 0, false)); }
  const giro = new THREE.Group(); giro.position.y = ALT; grua.add(giro);
  giro.add(caixa(2.2, 2, 2.2, mat.amarelo, 0, 1, 0));
  giro.add(caixa(1.5, 1.4, 1.6, mat.vidro, 1.2, .6, 0));
  giro.add(caixa(26, .8, 1, mat.amarelo, 10, 2.4, 0));
  giro.add(caixa(10, .7, 1, mat.amarelo, -5, 2.4, 0));
  giro.add(caixa(3, 2.2, 1.6, mat.concreto, -8.5, 1.4, 0));
  const torre = cilindro(.15, 5, mat.amarelo, 6); torre.position.set(0, 5, 0); giro.add(torre);
  const carro = new THREE.Group(); giro.add(carro); carro.add(caixa(1.2, .5, 1.2, mat.aco, 0, 1.8, 0));
  const cabo = cilindro(.04, 1, mat.aco, 4); carro.add(cabo);
  const carga = new THREE.Group(); carro.add(carga);
  carga.add(caixa(2.4, .25, 1.6, mat.madeira, 0, 0, 0)); for (let i = 0; i < 3; i++) carga.add(caixa(.7, .5, 1.4, mat.tijolo, -.8 + i * .8, .38, 0));

  // ---------- escritório (contêineres), almoxarifado, prancheta, vistoria ----------
  const conteiner = (x, y, z, cor) => {
    const g = new THREE.Group(); g.position.set(x, y, z);
    g.add(caixa(6.1, 2.6, 2.45, M(cor, { roughness: .6 }), 0, 1.3, 0));
    for (let i = -2; i <= 2; i++) g.add(caixa(.08, 2.5, 2.5, M(new THREE.Color(cor).multiplyScalar(.8).getHex()), i * 1.2, 1.3, 0, false));
    const j1 = caixa(1.4, .9, .06, mat.vidro, -1.2, 1.6, 1.25, false), j2 = caixa(1.4, .9, .06, mat.vidro, 1.2, 1.6, 1.25, false);
    g.add(j1, j2); g.userData.janelas = [j1, j2]; cena.add(g); return g;
  };
  const esc1 = conteiner(-19, 0, -12, 0x2f5f8f), esc2 = conteiner(-19, 2.6, -12, 0x3a7a5f);
  const placa = caixa(4, 1, .1, M(0xf2a33a), -19, 5.9, -10.7, false); cena.add(placa);
  // almoxarifado
  const almox = new THREE.Group(); almox.position.set(-19, 0, 15); cena.add(almox);
  for (const [x, z] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) { const p = cilindro(.12, 6, mat.aco, 6); p.position.set(x, 3, z); almox.add(p); }
  const telhado = caixa(9.2, .15, 7.2, M(0x8a96a3, { metalness: .4, roughness: .5 }), 0, 6.05, 0); telhado.rotation.x = .06; almox.add(telhado);
  for (let i = 0; i < 4; i++) { almox.add(caixa(1.4, .2, 1.1, mat.madeira, -2.5 + i * 1.7, .1, -1.6)); almox.add(caixa(1.2, .5 + (i % 3) * .3, 1, mat.tijolo, -2.5 + i * 1.7, .45 + (i % 3) * .15, -1.6)); }
  for (let i = 0; i < 3; i++) { const s = cilindro(.45, .9, M(0xcfcac0)); s.position.set(-2.5 + i * 1.1, .45, 1.6); almox.add(s); }
  // prancheta
  const pranch = new THREE.Group(); pranch.position.set(16, 0, 12); cena.add(pranch);
  pranch.add(caixa(2.4, .1, 1.4, mat.madeira, 0, 1.1, 0));
  for (const [x, z] of [[-1, -.55], [1, -.55], [-1, .55], [1, .55]]) pranch.add(caixa(.1, 1.1, .1, mat.aco, x, .55, z));
  const planta = caixa(1.9, .02, 1.1, M(0x9fc3e6, { emissive: 0x0d2a44 }), 0, 1.17, 0, false); pranch.add(planta);
  // vistoria
  const vist = new THREE.Group(); vist.position.set(6, 0, 16.6); cena.add(vist);
  vist.add(caixa(3, .9, 1.2, M(0x55606b), 0, .45, 0));
  vist.add(caixa(1.3, .8, .08, mat.pneu, 0, 1.4, -.3));
  const tela = caixa(1.15, .66, .02, M(0x0f1a14, { emissive: 0x3fbf7f, emissiveIntensity: .2 }), 0, 1.4, -.25, false); vist.add(tela);
  // betoneira
  const bet = new THREE.Group(); bet.position.set(-6, 0, 13); cena.add(bet);
  bet.add(caixa(1.6, .3, 1, mat.aco, 0, .55, 0));
  for (const z of [-.55, .55]) { const r = cilindro(.35, .2, mat.pneu); r.rotation.x = Math.PI / 2; r.position.set(-.4, .35, z); bet.add(r); }
  const tambor = new THREE.Mesh(new THREE.CylinderGeometry(.55, .85, 1.6, 14), mat.laranja); tambor.castShadow = true;
  const eixo = new THREE.Group(); eixo.position.set(.2, 1.4, 0); eixo.rotation.z = -.9; eixo.add(tambor); bet.add(eixo);
  // postes de luz
  const lamps = [];
  for (const [x, z] of [[-26, -20], [24, -20], [-26, 24], [24, 24]]) {
    const p = cilindro(.12, 8, mat.aco, 6); p.position.set(x, 4, z); cena.add(p);
    const l = caixa(1.2, .3, .6, mat.lampada, x, 8, z, false); cena.add(l);
    const luz = new THREE.PointLight(0xffd59a, 0, 40, 1.6); luz.position.set(x, 7.6, z); cena.add(luz); lamps.push(luz);
  }

  // ---------- caminhão (chega a cada milestone concluído) ----------
  const cam = new THREE.Group(); cena.add(cam);
  cam.add(caixa(2.4, 2.2, 2.4, M(0xd94f3d, { roughness: .5 }), 3.2, 1.6, 0));
  cam.add(caixa(1.2, 1, 2.3, mat.vidro, 3.9, 2.1, 0, false));
  cam.add(caixa(5, .5, 2.4, mat.aco, -.6, .9, 0));
  const cacamba = caixa(4.6, 1.6, 2.4, M(0xf2b430, { roughness: .5 }), -.8, 1.95, 0); cam.add(cacamba);
  for (const x of [-2.4, .2, 3.2]) for (const z of [-1.2, 1.2]) { const r = cilindro(.5, .35, mat.pneu); r.rotation.x = Math.PI / 2; r.position.set(x, .5, z); cam.add(r); }
  const CAM = { fase: 'fora', t: 0, ultimoConcluido: null };
  const posFora = new THREE.Vector3(-90, 0, 33), posRua = new THREE.Vector3(-3, 0, 33), posObra = new THREE.Vector3(-3, 0, 21);
  cam.position.copy(posFora);

  // ---------- trabalhadores ----------
  const pessoas = {};
  for (const [k, p] of Object.entries(PAPEIS)) {
    const g = new THREE.Group(); g.scale.setScalar(2.2);
    const pernaE = new THREE.Group(), pernaD = new THREE.Group(), bracoE = new THREE.Group(), bracoD = new THREE.Group();
    pernaE.position.set(-.13, .85, 0); pernaD.position.set(.13, .85, 0);
    pernaE.add(caixa(.18, .85, .2, mat.calca, 0, -.42, 0)); pernaD.add(caixa(.18, .85, .2, mat.calca, 0, -.42, 0));
    pernaE.add(caixa(.2, .12, .3, mat.pneu, 0, -.82, .05)); pernaD.add(caixa(.2, .12, .3, mat.pneu, 0, -.82, .05));
    const colete = M(p.colete, { roughness: .7 });
    g.add(caixa(.5, .65, .3, colete, 0, 1.18, 0));
    g.add(caixa(.52, .07, .32, mat.refletivo, 0, 1.12, 0, false));
    bracoE.position.set(-.33, 1.45, 0); bracoD.position.set(.33, 1.45, 0);
    bracoE.add(caixa(.14, .6, .16, colete, 0, -.28, 0)); bracoD.add(caixa(.14, .6, .16, colete, 0, -.28, 0));
    bracoE.add(caixa(.12, .12, .12, mat.pele, 0, -.62, 0)); bracoD.add(caixa(.12, .12, .12, mat.pele, 0, -.62, 0));
    const cabeca = new THREE.Mesh(new THREE.SphereGeometry(.2, 14, 10), mat.pele); cabeca.position.y = 1.72; cabeca.castShadow = true;
    const capacete = new THREE.Mesh(new THREE.SphereGeometry(.24, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(p.capacete, { roughness: .35 }));
    capacete.position.y = 1.78; capacete.castShadow = true;
    const aba = cilindro(.3, .04, M(p.capacete, { roughness: .35 }), 14); aba.position.y = 1.78;
    g.add(pernaE, pernaD, bracoE, bracoD, cabeca, capacete, aba);
    const [x, z] = LUGAR[k].parado; g.position.set(x, 0, z);
    cena.add(g);
    const balao = document.createElement('div'); balao.className = 'balao3d';
    balao.style.setProperty('--cor', '#' + p.capacete.toString(16).padStart(6, '0'));
    balao.innerHTML = '<div class="bx"><span class="tx"></span><i class="pts"><b></b><b></b><b></b></i></div>';
    palco.appendChild(balao);
    pessoas[k] = { g, pernaE, pernaD, bracoE, bracoD, balao, tx: balao.querySelector('.tx'), fase: Math.random() * 6, rota: [],
      alvoTxt: '', vistoTxt: '', letras: 0, tipo: '', proxPensa: performance.now() + 3000 + Math.random() * 12000, pensaAte: 0, pensaTxt: '',
      vagar: new THREE.Vector3(), proxVagar: 0 };
  }

  // ---------- clicar num trabalhador abre a ficha dele ----------
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let apertou = null;
  renderer.domElement.addEventListener('pointerdown', e => { apertou = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!apertou || Math.hypot(e.clientX - apertou[0], e.clientY - apertou[1]) > 6) return; // foi arrastar, não clicar
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    let melhor = null, dist = Infinity;
    for (const [k, p] of Object.entries(pessoas)) {
      const hit = ray.intersectObject(p.g, true)[0];
      if (hit && hit.distance < dist) { dist = hit.distance; melhor = k; }
      // perto o bastante do boneco também vale (eles são pequenos de longe)
      const c = p.g.position.clone(); c.y += 2; const d = ray.ray.distanceToPoint(c);
      if (!hit && d < 1.6 && ray.ray.origin.distanceTo(c) < dist) { dist = ray.ray.origin.distanceTo(c); melhor = k; }
    }
    if (melhor) window.dispatchEvent(new CustomEvent('canteiro:agente', { detail: melhor }));
  });

  // ---------- fogos na entrega ----------
  const N_FOGOS = 600;
  const fogosGeo = new THREE.BufferGeometry();
  const fPos = new Float32Array(N_FOGOS * 3), fVel = new Float32Array(N_FOGOS * 3), fCor = new Float32Array(N_FOGOS * 3);
  fogosGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  fogosGeo.setAttribute('color', new THREE.BufferAttribute(fCor, 3));
  const fogos = new THREE.Points(fogosGeo, new THREE.PointsMaterial({ size: .6, vertexColors: true, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
  fogos.visible = false; cena.add(fogos);
  let fogosT = 99;
  const estourar = (topo) => {
    const cores = [0xf2a33a, 0x3fbf7f, 0x4a9be8, 0xff5d73, 0xfff1c2];
    for (let i = 0; i < N_FOGOS; i++) {
      const b = i % 5, cx = PRED.x - 8 + b * 4, cy = topo + 14 + (b % 2) * 4;
      fPos.set([cx, cy, PRED.z], i * 3);
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), v = 6 + Math.random() * 4;
      fVel.set([Math.sin(ph) * Math.cos(th) * v, Math.cos(ph) * v, Math.sin(ph) * Math.sin(th) * v], i * 3);
      const c = new THREE.Color(cores[b]); fCor.set([c.r, c.g, c.b], i * 3);
    }
    fogosGeo.attributes.position.needsUpdate = true; fogosGeo.attributes.color.needsUpdate = true;
    fogosT = 0; fogos.visible = true;
  };

  // ---------- dia e noite ----------
  const horaFixa = Number(new URLSearchParams(location.search).get('hora'));
  // Atlas (M43, Luiz 24/11/2026): no app, os balões técnicos ("rodando gh run list…") somem; o Atlas mostra um balão só, em português simples.
  const semBaloes = new URLSearchParams(location.search).get('baloes') === '0';
  const corDia = new THREE.Color(0x8fb8de), corNoite = new THREE.Color(0x0b1222), corPor = new THREE.Color(0xe59a6a);
  function ambiente() {
    const d = new Date(), h = Number.isFinite(horaFixa) && horaFixa > 0 ? horaFixa : d.getHours() + d.getMinutes() / 60;
    const ang = (h - 6) / 12 * Math.PI; // 6h nasce, 18h se põe
    const alt = Math.sin(ang), luz = THREE.MathUtils.clamp(alt * 1.6 + .15, 0, 1);
    const por = THREE.MathUtils.clamp(1 - Math.abs(alt) * 4, 0, 1) * (alt > -.25 ? 1 : 0);
    sol.position.set(Math.cos(ang) * 80, Math.max(alt, .12) * 90, 40);
    sol.intensity = .12 + 2.3 * luz;
    sol.color.setHSL(.09, .6, .55 + .4 * luz - .1 * por);
    hemi.intensity = .25 + .7 * luz;
    ceu.copy(corNoite).lerp(corDia, luz).lerp(corPor, por * .55);
    cena.fog.color.copy(ceu);
    renderer.toneMappingExposure = .75 + .35 * luz;
    return 1 - luz; // noite: 0 (dia) a 1 (noite)
  }

  // ---------- redimensionar ----------
  const medir = () => {
    const r = palco.getBoundingClientRect(); if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    renderer.domElement.style.width = r.width + 'px'; renderer.domElement.style.height = r.height + 'px';
    camera.aspect = r.width / r.height;
    camera.position.setLength(r.width < 600 ? 150 : 112);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(medir); ro.observe(palco); medir();

  // ---------- laço ----------
  let pctVisto = 0, ultimo = performance.now(), rodando = true, noiteCache = 0, contaAmb = 0;
  const v3 = new THREE.Vector3();
  function topoObra(p) { const cheio = p / 100 * PRED.pav; return .4 + Math.min(PRED.pav, Math.floor(cheio)) * PRED.h + (cheio % 1 > .35 && cheio < PRED.pav ? PRED.h : 0); }

  function quadro(t) {
    if (!rodando) return;
    requestAnimationFrame(quadro);
    const dt = Math.min(.1, (t - ultimo) / 1000); ultimo = t;
    const E = obterEstado() || {};
    const ag = E.agentes || {};
    const alvoPct = E.plano ? E.plano.pct : 0;
    pctVisto += (alvoPct - pctVisto) * Math.min(1, dt * 1.2);
    if (Math.abs(alvoPct - pctVisto) < .05) pctVisto = alvoPct;

    if (contaAmb++ % 30 === 0) noiteCache = ambiente();
    const noite = noiteCache;
    lamps.forEach(l => (l.intensity = noite * 60)); mat.lampada.emissiveIntensity = noite * 2.5;
    [...esc1.userData.janelas, ...esc2.userData.janelas].forEach(j => { j.material = noite > .3 ? mat.lampada : mat.vidro; });

    // prédio por fases: pilares → laje → alvenaria → fachada
    const cheio = pctVisto / 100 * PRED.pav;
    pavs.forEach((pv, i) => {
      const f = THREE.MathUtils.clamp(cheio - i, 0, 1);
      pv.g.visible = f > 0;
      const fc = THREE.MathUtils.clamp(f / .35, 0, 1);
      pv.cols.forEach(c => { c.scale.y = Math.max(.001, fc); c.position.y = PRED.h * fc / 2; });
      pv.laje.visible = f >= .35;
      const ft = THREE.MathUtils.clamp((f - .45) / .3, 0, 1);
      pv.tijolos.forEach(m => { m.visible = ft > 0 && f < .8; m.scale.y = Math.max(.001, ft); m.position.y = (PRED.h - .35) * ft / 2; });
      pv.faces.forEach(m => { m.visible = f >= .8; m.material.emissiveIntensity = noite * 1.4; });
    });
    const emObra = Math.min(PRED.pav - 1, Math.floor(cheio));
    andaime.visible = pctVisto > 0 && pctVisto < 100;
    andaime.position.y = Math.max(0, emObra - 1) * PRED.h;
    cobertura.visible = pctVisto >= 99.9; cobertura.position.y = .4 + PRED.pav * PRED.h;
    bandeira.rotation.y = Math.sin(t / 400) * .25;
    const topo = topoObra(pctVisto);

    // máquinas reagem a quem está trabalhando
    const exec = ag.implementador && ag.implementador.ativo;
    const alvoGiro = exec ? -0.9 + Math.sin(t / 3500) * 1.1 : -0.9;
    giro.rotation.y += (alvoGiro - giro.rotation.y) * Math.min(1, dt * .8);
    carro.position.x = 8 + (exec ? (Math.sin(t / 2800) + 1) * 6 : 3);
    const desce = exec ? 6 + (Math.sin(t / 1900) + 1) * 8 : 8;
    cabo.scale.y = desce; cabo.position.y = 1.6 - desce / 2; carga.position.y = 1.4 - desce;
    eixo.children[0].rotation.y += dt * (exec ? 4 : .3);
    const vistoria = ag.qa && ag.qa.ativo;
    tela.material.emissiveIntensity = vistoria ? 1 + Math.sin(t / 120) * .4 : .15;
    planta.material.emissiveIntensity = ag.designer && ag.designer.ativo ? 1.2 : .2;

    // caminhão: chega quando um milestone é concluído
    const concl = E.plano ? E.plano.milestones.filter(m => m.status === 'concluido').length : 0;
    if (CAM.ultimoConcluido === null) CAM.ultimoConcluido = concl;
    if (concl > CAM.ultimoConcluido && CAM.fase === 'fora') { CAM.fase = 'chegando'; CAM.t = 0; }
    CAM.ultimoConcluido = Math.max(CAM.ultimoConcluido, concl);
    CAM.t += dt;
    if (CAM.fase === 'chegando') {
      const k = Math.min(1, CAM.t / 5); cam.position.lerpVectors(posFora, posRua, 1 - Math.pow(1 - k, 2)); cam.rotation.y = 0;
      if (k >= 1) { CAM.fase = 'entrando'; CAM.t = 0; }
    } else if (CAM.fase === 'entrando') {
      const k = Math.min(1, CAM.t / 2.5); cam.position.lerpVectors(posRua, posObra, k); cam.rotation.y = -Math.PI / 2 * Math.min(1, k * 3);
      if (k >= 1) { CAM.fase = 'descarregando'; CAM.t = 0; }
    } else if (CAM.fase === 'descarregando') {
      cacamba.rotation.z = Math.sin(Math.min(1, CAM.t / 3) * Math.PI) * -.6; cacamba.position.y = 1.95 + Math.abs(cacamba.rotation.z) * .9;
      if (CAM.t > 4) { CAM.fase = 'saindo'; CAM.t = 0; }
    } else if (CAM.fase === 'saindo') {
      const k = Math.min(1, CAM.t / 6); cam.rotation.y = 0;
      cam.position.set(THREE.MathUtils.lerp(-3, 95, k), 0, 33);
      if (k >= 1) { CAM.fase = 'fora'; cam.position.copy(posFora); }
    }

    // fogos ao entregar
    if (pctVisto >= 99.9 && fogosT > 4) estourar(topo);
    if (fogos.visible) {
      fogosT += dt;
      for (let i = 0; i < N_FOGOS; i++) { fVel[i * 3 + 1] -= 6 * dt; for (let a = 0; a < 3; a++) fPos[i * 3 + a] += fVel[i * 3 + a] * dt; }
      fogosGeo.attributes.position.needsUpdate = true;
      fogos.material.opacity = Math.max(0, 1 - fogosT / 2.6);
      if (fogosT > 2.6 && pctVisto < 99.9) fogos.visible = false;
    }

    // pessoas
    const r = renderer.domElement.getBoundingClientRect();
    const esp = esperaDe(E);
    let pensando = 0;
    for (const [k, p] of Object.entries(pessoas)) {
      const a = ag[k] || {};
      const desp = k === 'despachante' && esp && esp.desp; // na espera do CI, o despachante vai até o portão
      const emCampo = a.ativo || desp;
      const lugar = LUGAR[k][emCampo ? 'ativo' : 'parado'];
      let destino = lugar === 'laje' ? new THREE.Vector3(PRED.x - 2 + (p.fase % 3), topo, PRED.z + 1) : new THREE.Vector3(lugar[0], 0, lugar[1]);
      // parado não é estátua: dá uns passos pelo almoxarifado/escritório de tempos em tempos
      if (!emCampo) {
        if (t > p.proxVagar) { p.vagar.set((Math.random() - .5) * 3.2, 0, (Math.random() - .5) * 2.4); p.proxVagar = t + 6000 + Math.random() * 9000; }
        destino.add(p.vagar);
      }
      // sobe e desce pelo andaime
      const pos = p.g.position;
      let alvo = destino;
      if (Math.abs(destino.y - pos.y) > .2) {
        const pe = new THREE.Vector3(ESCADA.x, pos.y, ESCADA.z);
        alvo = pos.distanceTo(pe) > .4 ? pe : new THREE.Vector3(ESCADA.x, destino.y, ESCADA.z);
      }
      v3.copy(alvo).sub(pos);
      const dist = v3.length();
      const andando = dist > .15;
      if (andando) {
        const passo = Math.min(dist, (Math.abs(v3.y) > .1 ? 4 : emCampo ? 7 : 2.6) * dt);
        pos.addScaledVector(v3.normalize(), passo);
        if (Math.abs(v3.y) < .5) { const ang = Math.atan2(v3.x, v3.z); p.g.rotation.y += ((ang - p.g.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 8); }
      } else if (emCampo) {
        const olhar = lugar === 'laje' ? Math.PI : k === 'coordenador' ? -2.4 : (k === 'qa' || k === 'seguranca' || k === 'desempenho') ? Math.PI : 0;
        p.g.rotation.y += (olhar - p.g.rotation.y) * Math.min(1, dt * 3);
      } else {
        p.g.rotation.y += (Math.sin(t / 4200 + p.fase) * 1.3 - p.g.rotation.y) * Math.min(1, dt * .8); // olha em volta
      }
      const ritmo = t / (andando ? 140 : 180) + p.fase;
      const sw = andando ? Math.sin(ritmo) * .7 : 0;
      p.pernaE.rotation.x = sw; p.pernaD.rotation.x = -sw;
      if (emCampo && !andando) {
        p.bracoD.rotation.x = -1.2 + Math.sin(ritmo * 2.2) * .6; p.bracoE.rotation.x = -.5;
      } else if (!andando) {
        const cafe = Math.max(0, Math.sin(t / 2600 + p.fase * 3) - .55) * 3.4; // de vez em quando leva a mão à boca
        p.bracoD.rotation.x = -cafe; p.bracoE.rotation.x = Math.sin(t / 900 + p.fase) * .08;
      } else { p.bracoD.rotation.x = -sw; p.bracoE.rotation.x = sw; }
      p.g.scale.y = 2.2 * (1 + Math.sin(t / 700 + p.fase) * .012); // respiração
      // balão: fala (o que está fazendo de verdade) ou pensamento (esperando a vez)
      let txt = '', tipo = 'fala';
      if (a.ativo) { const alvo = /^(Task|Agent)$/.test(a.ferramenta) && PAPEIS[a.alvo] ? PAPEIS[a.alvo].nome : a.alvo; txt = ((VERBO[a.ferramenta] || a.ferramenta || 'trabalhando') + (alvo ? ' ' + alvo : '')).trim(); }
      else if (k === 'coordenador' && esp) { txt = esp.coord; tipo = 'espera'; }
      else if (desp) { txt = esp.desp; tipo = 'espera'; }
      else if (a.ferramenta === 'entregou' && Date.now() - a.ts < 20000) txt = '✓ entreguei o serviço';
      else {
        if (t > p.proxPensa && pensando < 2) { const l = PENSA[k] || ['esperando a vez']; p.pensaTxt = l[Math.floor(Math.random() * l.length)]; p.pensaAte = t + 5500; p.proxPensa = t + 14000 + Math.random() * 16000; }
        if (t < p.pensaAte) { txt = p.pensaTxt; tipo = 'pensa'; pensando++; }
      }
      if (semBaloes) txt = '';
      if (txt !== p.alvoTxt) { p.alvoTxt = txt; p.letras = 0; }
      if (txt) {
        v3.copy(pos); v3.y += 5.2; v3.project(camera);
        const vis = v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1;
        p.balao.style.display = vis ? 'block' : 'none';
        if (vis) {
          if (p.tipo !== tipo) { p.balao.className = 'balao3d ' + tipo; p.tipo = tipo; }
          p.letras = Math.min(txt.length, p.letras + dt * 70); // efeito de digitação
          const mostra = txt.slice(0, Math.ceil(p.letras));
          if (p.vistoTxt !== mostra) { p.tx.textContent = mostra; p.vistoTxt = mostra; }
          p.balao.style.transform = `translate(${(v3.x * .5 + .5) * r.width}px,${(-v3.y * .5 + .5) * r.height}px) translate(-50%,-100%)`;
        }
      } else { p.balao.style.display = 'none'; p.tipo = ''; }
    }

    if (!controles.autoRotate && performance.now() - ultimoToque > 25000) controles.autoRotate = true;
    controles.update();
    renderer.render(cena, camera);
  }
  ultimoToque = performance.now() - 20000;
  requestAnimationFrame(quadro);

  return {
    parar() { rodando = false; ro.disconnect(); renderer.dispose(); renderer.domElement.remove(); Object.values(pessoas).forEach(p => p.balao.remove()); },
    nome: PAPEIS,
  };
}
