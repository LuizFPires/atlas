// Projeção lon/lat → unidades do mapa e base enxuta de cidades (só nome, UF e posição; nenhum dado de pessoa).
// Fonte das coordenadas: valores geográficos públicos (IBGE / Wikipédia), arredondados em ~0,01°. Bastam para
// posicionar uma bolha num mapa simplificado; não servem para navegação.
import { CENTRO_UF } from './mapa-brasil'

/** lon/lat aproximado do centro geográfico de cada estado (IBGE/Wikipédia), usado só para ajustar a projeção. */
export const LONLAT_UF: Record<string, readonly [number, number]> = {
  RO: [-62.8, -10.9], AC: [-70.5, -9.0], AM: [-64.6, -4.2], RR: [-61.4, 2.1], PA: [-52.3, -3.9], AP: [-51.9, 1.4], TO: [-48.3, -10.2],
  MA: [-45.3, -5.0], PI: [-42.8, -7.7], CE: [-39.3, -5.2], RN: [-36.5, -5.8], PB: [-36.8, -7.1], PE: [-37.9, -8.4], AL: [-36.6, -9.6],
  SE: [-37.4, -10.6], BA: [-41.7, -12.6], MG: [-44.6, -18.5], ES: [-40.7, -19.6], RJ: [-42.7, -22.2], SP: [-48.6, -22.2], PR: [-51.6, -24.6],
  SC: [-50.5, -27.4], RS: [-53.5, -29.7], MS: [-54.5, -20.5], MT: [-56.1, -12.9], GO: [-49.6, -15.9], DF: [-47.8, -15.8],
}

/** Mínimos quadrados de y = a·x + b. */
function reta(xs: number[], ys: number[]): [number, number] {
  const n = xs.length, mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n
  let sxy = 0, sxx = 0
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2 })
  const a = sxy / sxx
  return [a, my - a * mx]
}

const ufs = Object.keys(LONLAT_UF).filter((u) => CENTRO_UF[u])
/** O mapa é equiretangular (linear): x = a·lon + b e y = c·lat + d, ajustados com os 27 centroides. */
const [A, B] = reta(ufs.map((u) => LONLAT_UF[u][0]), ufs.map((u) => CENTRO_UF[u][0]))
const [C, D] = reta(ufs.map((u) => LONLAT_UF[u][1]), ufs.map((u) => CENTRO_UF[u][1]))

/** Projeta (lon, lat) em graus para (x, y) no sistema de coordenadas dos caminhos do mapa. */
export function projetar(lon: number, lat: number): [number, number] {
  return [Math.round((A * lon + B) * 10) / 10, Math.round((C * lat + D) * 10) / 10]
}

export interface Cidade { nome: string; uf: string; lon: number; lat: number }
export const CIDADES: Cidade[] = [
  // Capitais
  { nome: 'Porto Velho', uf: 'RO', lon: -63.90, lat: -8.76 }, { nome: 'Rio Branco', uf: 'AC', lon: -67.81, lat: -9.97 },
  { nome: 'Manaus', uf: 'AM', lon: -60.02, lat: -3.12 }, { nome: 'Boa Vista', uf: 'RR', lon: -60.67, lat: 2.82 },
  { nome: 'Belém', uf: 'PA', lon: -48.50, lat: -1.46 }, { nome: 'Macapá', uf: 'AP', lon: -51.07, lat: 0.03 },
  { nome: 'Palmas', uf: 'TO', lon: -48.33, lat: -10.18 }, { nome: 'São Luís', uf: 'MA', lon: -44.30, lat: -2.53 },
  { nome: 'Teresina', uf: 'PI', lon: -42.80, lat: -5.09 }, { nome: 'Fortaleza', uf: 'CE', lon: -38.54, lat: -3.73 },
  { nome: 'Natal', uf: 'RN', lon: -35.21, lat: -5.79 }, { nome: 'João Pessoa', uf: 'PB', lon: -34.86, lat: -7.12 },
  { nome: 'Recife', uf: 'PE', lon: -34.88, lat: -8.05 }, { nome: 'Maceió', uf: 'AL', lon: -35.74, lat: -9.67 },
  { nome: 'Aracaju', uf: 'SE', lon: -37.07, lat: -10.91 }, { nome: 'Salvador', uf: 'BA', lon: -38.51, lat: -12.97 },
  { nome: 'Belo Horizonte', uf: 'MG', lon: -43.94, lat: -19.92 }, { nome: 'Vitória', uf: 'ES', lon: -40.34, lat: -20.32 },
  { nome: 'Rio de Janeiro', uf: 'RJ', lon: -43.17, lat: -22.91 }, { nome: 'São Paulo', uf: 'SP', lon: -46.63, lat: -23.55 },
  { nome: 'Curitiba', uf: 'PR', lon: -49.27, lat: -25.43 }, { nome: 'Florianópolis', uf: 'SC', lon: -48.55, lat: -27.60 },
  { nome: 'Porto Alegre', uf: 'RS', lon: -51.23, lat: -30.03 }, { nome: 'Campo Grande', uf: 'MS', lon: -54.65, lat: -20.44 },
  { nome: 'Cuiabá', uf: 'MT', lon: -56.10, lat: -15.60 }, { nome: 'Goiânia', uf: 'GO', lon: -49.25, lat: -16.68 },
  { nome: 'Brasília', uf: 'DF', lon: -47.93, lat: -15.78 },
  // Minas Gerais
  { nome: 'Uberlândia', uf: 'MG', lon: -48.28, lat: -18.92 }, { nome: 'Contagem', uf: 'MG', lon: -44.05, lat: -19.93 },
  { nome: 'Juiz de Fora', uf: 'MG', lon: -43.35, lat: -21.76 }, { nome: 'Montes Claros', uf: 'MG', lon: -43.86, lat: -16.73 },
  { nome: 'Uberaba', uf: 'MG', lon: -47.93, lat: -19.75 }, { nome: 'Betim', uf: 'MG', lon: -44.20, lat: -19.97 },
  { nome: 'Ipatinga', uf: 'MG', lon: -42.54, lat: -19.47 }, { nome: 'Itabira', uf: 'MG', lon: -43.23, lat: -19.62 },
  { nome: 'Governador Valadares', uf: 'MG', lon: -41.95, lat: -18.85 }, { nome: 'Divinópolis', uf: 'MG', lon: -44.88, lat: -20.14 },
  { nome: 'Poços de Caldas', uf: 'MG', lon: -46.56, lat: -21.79 }, { nome: 'Varginha', uf: 'MG', lon: -45.43, lat: -21.55 },
  { nome: 'Patos de Minas', uf: 'MG', lon: -46.52, lat: -18.58 }, { nome: 'Teófilo Otoni', uf: 'MG', lon: -41.51, lat: -17.86 },
  // São Paulo
  { nome: 'Campinas', uf: 'SP', lon: -47.06, lat: -22.91 }, { nome: 'Santos', uf: 'SP', lon: -46.33, lat: -23.96 },
  { nome: 'Ribeirão Preto', uf: 'SP', lon: -47.81, lat: -21.18 }, { nome: 'Sorocaba', uf: 'SP', lon: -47.46, lat: -23.50 },
  { nome: 'São José do Rio Preto', uf: 'SP', lon: -49.38, lat: -20.82 }, { nome: 'Guarulhos', uf: 'SP', lon: -46.53, lat: -23.46 },
  { nome: 'São José dos Campos', uf: 'SP', lon: -45.89, lat: -23.22 }, { nome: 'Bauru', uf: 'SP', lon: -49.06, lat: -22.31 },
  { nome: 'Presidente Prudente', uf: 'SP', lon: -51.39, lat: -22.13 },
  // Rio de Janeiro
  { nome: 'Niterói', uf: 'RJ', lon: -43.10, lat: -22.88 }, { nome: 'Campos dos Goytacazes', uf: 'RJ', lon: -41.32, lat: -21.75 },
  { nome: 'Petrópolis', uf: 'RJ', lon: -43.18, lat: -22.51 }, { nome: 'Volta Redonda', uf: 'RJ', lon: -44.10, lat: -22.52 },
  // Paraná
  { nome: 'Londrina', uf: 'PR', lon: -51.16, lat: -23.31 }, { nome: 'Maringá', uf: 'PR', lon: -51.94, lat: -23.42 },
  { nome: 'Cascavel', uf: 'PR', lon: -53.46, lat: -24.96 }, { nome: 'Ponta Grossa', uf: 'PR', lon: -50.16, lat: -25.09 },
  { nome: 'Foz do Iguaçu', uf: 'PR', lon: -54.59, lat: -25.52 },
  // Rio Grande do Sul
  { nome: 'Caxias do Sul', uf: 'RS', lon: -51.18, lat: -29.17 }, { nome: 'Pelotas', uf: 'RS', lon: -52.34, lat: -31.77 },
  { nome: 'Santa Maria', uf: 'RS', lon: -53.81, lat: -29.68 }, { nome: 'Passo Fundo', uf: 'RS', lon: -52.41, lat: -28.26 },
  // Santa Catarina
  { nome: 'Joinville', uf: 'SC', lon: -48.85, lat: -26.30 }, { nome: 'Blumenau', uf: 'SC', lon: -49.07, lat: -26.92 },
  { nome: 'Chapecó', uf: 'SC', lon: -52.62, lat: -27.10 },
  // Bahia
  { nome: 'Feira de Santana', uf: 'BA', lon: -38.97, lat: -12.27 }, { nome: 'Vitória da Conquista', uf: 'BA', lon: -40.84, lat: -14.87 },
  { nome: 'Ilhéus', uf: 'BA', lon: -39.05, lat: -14.79 }, { nome: 'Juazeiro', uf: 'BA', lon: -40.50, lat: -9.42 },
  { nome: 'Barreiras', uf: 'BA', lon: -45.00, lat: -12.15 },
  // Pernambuco
  { nome: 'Caruaru', uf: 'PE', lon: -35.98, lat: -8.28 }, { nome: 'Petrolina', uf: 'PE', lon: -40.50, lat: -9.39 },
  { nome: 'Olinda', uf: 'PE', lon: -34.86, lat: -8.01 },
  // Outros polos do interior
  { nome: 'Anápolis', uf: 'GO', lon: -48.95, lat: -16.33 }, { nome: 'Rio Verde', uf: 'GO', lon: -50.92, lat: -17.80 },
  { nome: 'Dourados', uf: 'MS', lon: -54.81, lat: -22.22 }, { nome: 'Rondonópolis', uf: 'MT', lon: -54.64, lat: -16.47 },
  { nome: 'Sinop', uf: 'MT', lon: -55.50, lat: -11.86 }, { nome: 'Santarém', uf: 'PA', lon: -54.71, lat: -2.44 },
  { nome: 'Marabá', uf: 'PA', lon: -49.12, lat: -5.37 }, { nome: 'Imperatriz', uf: 'MA', lon: -47.49, lat: -5.52 },
  { nome: 'Juazeiro do Norte', uf: 'CE', lon: -39.32, lat: -7.21 }, { nome: 'Campina Grande', uf: 'PB', lon: -35.88, lat: -7.23 },
  { nome: 'Mossoró', uf: 'RN', lon: -37.34, lat: -5.19 }, { nome: 'Vila Velha', uf: 'ES', lon: -40.29, lat: -20.33 },
  { nome: 'Ji-Paraná', uf: 'RO', lon: -61.95, lat: -10.88 }, { nome: 'Araguaína', uf: 'TO', lon: -48.20, lat: -7.19 },
]

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const chave = (uf: string, nome: string) => `${uf.toUpperCase()}|${semAcento(nome)}`
const POR_CHAVE = new Map(CIDADES.map((c) => [chave(c.uf, c.nome), c]))
/** Acha a cidade da base pelo nome (sem diferenciar acento/maiúscula) e UF; desconhecida → undefined (nunca chuta posição). */
export const acharCidade = (uf: string, nome: string) => POR_CHAVE.get(chave(uf, nome))
/** Posição da cidade no mapa, ou null se ela não estiver na base. */
export function posicaoCidade(uf: string, nome: string): [number, number] | null {
  const c = acharCidade(uf, nome)
  return c ? projetar(c.lon, c.lat) : null
}
